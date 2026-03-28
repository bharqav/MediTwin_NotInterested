import csv
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote_plus

import httpx


ROOT = Path(__file__).resolve().parents[1]
EVIDENCE_DIR = ROOT / "data" / "evidence"
RAW_DIR = EVIDENCE_DIR / "raw"
META_DIR = EVIDENCE_DIR / "meta"

OPENFDA_FAERS_URL = "https://api.fda.gov/drug/event.json?limit=50"
DAILYMED_SPL_URL = "https://dailymed.nlm.nih.gov/dailymed/services/v2/spls.json?pagesize=100"
DAILYMED_DRUGNAMES_URL = "https://dailymed.nlm.nih.gov/dailymed/services/v2/drugnames.json?pagesize=500"
DAILYMED_RXCUIS_URL = "https://dailymed.nlm.nih.gov/dailymed/services/v2/rxcuis.json?pagesize=500"
DAILYMED_SPLS_URL = "https://dailymed.nlm.nih.gov/dailymed/services/v2/spls.json?pagesize=200"
RXNAV_RXCUI_URL = "https://rxnav.nlm.nih.gov/REST/rxcui.json?name={name}"
CHEMBL_DRUG_WARNING_URL = "https://www.ebi.ac.uk/chembl/api/data/drug_warning.json?limit=200"
CHEMBL_DRUG_INDICATION_URL = "https://www.ebi.ac.uk/chembl/api/data/drug_indication.json?limit=200"
CHEMBL_MECHANISM_URL = "https://www.ebi.ac.uk/chembl/api/data/mechanism.json?limit=200"


def _ensure_dirs():
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    META_DIR.mkdir(parents=True, exist_ok=True)


def _sha256_bytes(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def _write_bytes(path: Path, content: bytes):
    path.write_bytes(content)
    return {
        "source_url": "",
        "download_timestamp": datetime.now(timezone.utc).isoformat(),
        "sha256": _sha256_bytes(content),
        "version_quarter": "",
        "path": str(path),
    }


def _extract_quarter_from_faers(results: list[dict]) -> str:
    dates = [r.get("receiptdate", "") for r in results if r.get("receiptdate")]
    if not dates:
        return "unknown"
    y = dates[0][:4]
    m = int(dates[0][4:6]) if len(dates[0]) >= 6 else 1
    q = ((m - 1) // 3) + 1
    return f"{y}Q{q}"


def _get_json_with_retries(client: httpx.Client, url: str, attempts: int = 3):
    last_exc = None
    for _ in range(attempts):
        try:
            r = client.get(url)
            r.raise_for_status()
            return r
        except Exception as e:
            last_exc = e
    raise last_exc


def _collect_targeted_faers(client: httpx.Client, max_drugs: int = 20, per_drug_limit: int = 20):
    """
    Pull targeted FAERS/openFDA event samples for project drugs.
    This avoids bulk downloads while increasing relevance and coverage.
    """
    target_file = ROOT / "data" / "evidence" / "target_drugs_20.json"
    if target_file.exists():
        target = json.loads(target_file.read_text(encoding="utf-8"))
        names = [d.get("name") for d in target if d.get("name")]
    else:
        drugs_file = ROOT / "data" / "drugs.json"
        drugs = json.loads(drugs_file.read_text(encoding="utf-8"))
        names = [d.get("name") for d in drugs if d.get("name")]
    names = names[:max_drugs]
    receivedate_start = "20240101"
    receivedate_end = datetime.now(timezone.utc).strftime("%Y%m%d")

    existing_map = {}
    out = RAW_DIR / "faers_targeted_events.json"
    if out.exists():
        try:
            existing = json.loads(out.read_text(encoding="utf-8"))
            for q in existing.get("queries", []):
                if q.get("drug_name"):
                    existing_map[q["drug_name"].lower()] = q
        except Exception:
            existing_map = {}

    payload = {"queries": []}
    for name in names:
        query = f'patient.drug.medicinalproduct:"{name}" AND receivedate:[{receivedate_start} TO {receivedate_end}]'
        url = f"https://api.fda.gov/drug/event.json?search={quote_plus(query)}&limit={per_drug_limit}"
        entry = {
            "drug_name": name,
            "source_url": url,
            "fetched_at": datetime.now(timezone.utc).isoformat(),
            "results": [],
            "meta_total": 0,
            "status": "ok",
        }
        try:
            r = _get_json_with_retries(client, url, attempts=2)
            body = r.json()
            entry["results"] = body.get("results", [])
            entry["meta_total"] = int(body.get("meta", {}).get("results", {}).get("total", 0))
        except Exception as e:
            entry["status"] = f"error_{type(e).__name__}"
            cached = existing_map.get(name.lower())
            if cached:
                entry["results"] = cached.get("results", [])
                entry["meta_total"] = cached.get("meta_total", 0)
                entry["status"] = "cache_fallback"
        payload["queries"].append(entry)

    content = json.dumps(payload, ensure_ascii=True).encode("utf-8")
    out.write_bytes(content)
    return out, content, payload


def collect():
    _ensure_dirs()
    client = httpx.Client(timeout=8.0, follow_redirects=True)
    source_registry = []

    # 1) Generic openFDA/FAERS sample
    r = _get_json_with_retries(client, OPENFDA_FAERS_URL, attempts=3)
    faers_content = r.content
    faers_json = r.json()
    faers_path = RAW_DIR / "faers_openfda_sample.json"
    faers_meta = _write_bytes(faers_path, faers_content)
    faers_meta["source_url"] = OPENFDA_FAERS_URL
    faers_meta["version_quarter"] = _extract_quarter_from_faers(faers_json.get("results", []))
    source_registry.append(faers_meta)

    # 1b) Targeted FAERS pulls for project drugs (higher relevance)
    targeted_path, targeted_content, targeted_payload = _collect_targeted_faers(
        client=client,
        max_drugs=20,
        per_drug_limit=20,
    )
    source_registry.append(
        {
            "source_url": "https://api.fda.gov/drug/event.json",
            "download_timestamp": datetime.now(timezone.utc).isoformat(),
            "sha256": _sha256_bytes(targeted_content),
            "version_quarter": _extract_quarter_from_faers(
                [
                    r
                    for q in targeted_payload.get("queries", [])
                    for r in q.get("results", [])[:1]
                ]
            ),
            "path": str(targeted_path),
        }
    )

    # 2) DailyMed SPL sample
    r = _get_json_with_retries(client, DAILYMED_SPL_URL, attempts=3)
    dm_content = r.content
    dm_json = r.json()
    dm_path = RAW_DIR / "dailymed_spl_sample.json"
    dm_meta = _write_bytes(dm_path, dm_content)
    dm_meta["source_url"] = DAILYMED_SPL_URL
    dm_meta["version_quarter"] = datetime.now(timezone.utc).strftime("%YQ") + str(((datetime.now(timezone.utc).month - 1) // 3) + 1)
    source_registry.append(dm_meta)

    # 2b) DailyMed web-service resources (as requested)
    for url, name in [
        (DAILYMED_DRUGNAMES_URL, "dailymed_drugnames.json"),
        (DAILYMED_RXCUIS_URL, "dailymed_rxcuis.json"),
        (DAILYMED_SPLS_URL, "dailymed_spls.json"),
    ]:
        try:
            rr = _get_json_with_retries(client, url, attempts=2)
            content = rr.content
            path = RAW_DIR / name
            path.write_bytes(content)
            source_registry.append(
                {
                    "source_url": url,
                    "download_timestamp": datetime.now(timezone.utc).isoformat(),
                    "sha256": _sha256_bytes(content),
                    "version_quarter": datetime.now(timezone.utc).strftime("%YQ")
                    + str(((datetime.now(timezone.utc).month - 1) // 3) + 1),
                    "path": str(path),
                }
            )
        except Exception:
            pass

    # 3) RxNorm map for known project drugs (small online mapping)
    drugs_file = ROOT / "data" / "drugs.json"
    drugs = json.loads(drugs_file.read_text(encoding="utf-8"))
    mapping_rows = []
    for d in drugs[:200]:
        name = d.get("name")
        if not name:
            continue
        url = RXNAV_RXCUI_URL.format(name=quote_plus(name))
        try:
            resp = _get_json_with_retries(client, url, attempts=2)
        except Exception:
            mapping_rows.append({"drug_name": name, "rxcui": ""})
            continue
        payload = resp.json()
        rxcui = ""
        id_group = payload.get("idGroup", {})
        if id_group.get("rxnormId"):
            rxcui = id_group["rxnormId"][0]
        mapping_rows.append({"drug_name": name, "rxcui": rxcui})

    rxnorm_csv = RAW_DIR / "rxnorm_mappings.csv"
    with rxnorm_csv.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["drug_name", "rxcui"])
        writer.writeheader()
        writer.writerows(mapping_rows)
    rxnorm_content = rxnorm_csv.read_bytes()
    source_registry.append(
        {
            "source_url": "https://rxnav.nlm.nih.gov/REST/rxcui.json",
            "download_timestamp": datetime.now(timezone.utc).isoformat(),
            "sha256": _sha256_bytes(rxnorm_content),
            "version_quarter": datetime.now(timezone.utc).strftime("%Y-%m"),
            "path": str(rxnorm_csv),
        }
    )

    # 4) ChEMBL enrichment snapshots
    for url, name in [
        (CHEMBL_DRUG_WARNING_URL, "chembl_drug_warning.json"),
        (CHEMBL_DRUG_INDICATION_URL, "chembl_drug_indication.json"),
        (CHEMBL_MECHANISM_URL, "chembl_mechanism.json"),
    ]:
        try:
            rr = _get_json_with_retries(client, url, attempts=2)
            content = rr.content
            path = RAW_DIR / name
            path.write_bytes(content)
            source_registry.append(
                {
                    "source_url": url,
                    "download_timestamp": datetime.now(timezone.utc).isoformat(),
                    "sha256": _sha256_bytes(content),
                    "version_quarter": datetime.now(timezone.utc).strftime("%Y-%m"),
                    "path": str(path),
                }
            )
        except Exception:
            pass

    registry_path = META_DIR / "source_registry.json"
    registry_path.write_text(json.dumps(source_registry, indent=2), encoding="utf-8")
    print(f"Wrote source registry to {registry_path}")


if __name__ == "__main__":
    collect()
