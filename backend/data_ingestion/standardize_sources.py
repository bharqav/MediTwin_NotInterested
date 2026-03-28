import csv
import json
import re
from collections import defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
EVIDENCE_DIR = ROOT / "data" / "evidence"
RAW_DIR = EVIDENCE_DIR / "raw"


def _norm_text(value: str) -> str:
    value = (value or "").strip().lower()
    value = re.sub(r"[^a-z0-9\s]+", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def _age_band(age: int | None) -> str:
    if age is None:
        return "unknown"
    if age < 18:
        return "0-17"
    if age < 40:
        return "18-39"
    if age < 65:
        return "40-64"
    return "65+"


def _std_sex(raw: str) -> str:
    raw = (raw or "").lower()
    if raw in ("1", "male", "m"):
        return "male"
    if raw in ("2", "female", "f"):
        return "female"
    return "unknown"


def build_standardized_signals():
    faers_file = RAW_DIR / "faers_targeted_events.json"
    sample_faers_file = RAW_DIR / "faers_openfda_sample.json"
    rxnorm_file = RAW_DIR / "rxnorm_mappings.csv"
    out_file = EVIDENCE_DIR / "standardized_signals.csv"
    out_file.parent.mkdir(parents=True, exist_ok=True)

    if faers_file.exists():
        faers_payload = json.loads(faers_file.read_text(encoding="utf-8"))
        query_rows = faers_payload.get("queries", [])
    elif sample_faers_file.exists():
        # Fallback to generic openFDA sample format.
        sample_payload = json.loads(sample_faers_file.read_text(encoding="utf-8"))
        query_rows = [
            {
                "drug_name": "",
                "meta_total": int(sample_payload.get("meta", {}).get("results", {}).get("total", 0)),
                "results": sample_payload.get("results", []),
            }
        ]
    else:
        raise FileNotFoundError(f"Missing source files: {faers_file} and {sample_faers_file}")

    rx_map = {}
    if rxnorm_file.exists():
        with rxnorm_file.open("r", encoding="utf-8") as f:
            for r in csv.DictReader(f):
                rx_map[_norm_text(r.get("drug_name", ""))] = (r.get("rxcui") or "").strip()

    counts = defaultdict(int)
    totals = defaultdict(int)

    for query_block in query_rows:
        target_drug = _norm_text(query_block.get("drug_name", ""))
        results = query_block.get("results", [])
        if not isinstance(results, list):
            continue
        total_reports = max(int(query_block.get("meta_total", 0)), len(results))
        fallback_rxcui = rx_map.get(target_drug, "NA")

        for item in results:
            patient = item.get("patient", {})
            drugs = patient.get("drug", [])
            reactions = patient.get("reaction", [])
            if not reactions:
                continue

            sex = _std_sex(str(patient.get("patientsex", "")))
            age_val = patient.get("patientonsetage")
            try:
                age_num = int(float(age_val)) if age_val is not None else None
            except Exception:
                age_num = None
            age_band = _age_band(age_num)

            # Prefer queried drug for cleaner denominator, but still capture route/dose hints.
            route = "unknown"
            dose_unit = "unknown"
            if drugs:
                top_drug = drugs[0]
                route = _norm_text(top_drug.get("drugadministrationroute", "")) or "unknown"
                dose_unit = _norm_text(top_drug.get("drugstructuredosagenumbunit", "")) or "unknown"

            effective_drug = target_drug
            if not effective_drug and drugs:
                effective_drug = _norm_text(drugs[0].get("medicinalproduct", ""))
            if not effective_drug:
                continue
            effective_rxcui = fallback_rxcui or rx_map.get(effective_drug, "NA")

            totals[(effective_drug, effective_rxcui)] = max(
                totals[(effective_drug, effective_rxcui)],
                total_reports,
            )

            for rxn in reactions[:6]:
                meddra_pt = _norm_text(rxn.get("reactionmeddrapt", ""))
                if not meddra_pt:
                    continue
                counts[(effective_drug, effective_rxcui, meddra_pt, route, dose_unit, age_band, sex)] += 1

    with out_file.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=[
                "drug_name",
                "rxcui",
                "reaction_meddra_pt",
                "route",
                "dose_unit",
                "age_band",
                "sex",
                "case_count",
                "total_reports_for_drug",
            ],
        )
        writer.writeheader()
        for key, case_count in sorted(counts.items(), key=lambda x: x[1], reverse=True):
            drug_name, rxcui, meddra_pt, route, dose_unit, age_band, sex = key
            if case_count <= 0:
                continue
            writer.writerow(
                {
                    "drug_name": drug_name,
                    "rxcui": rxcui or "NA",
                    "reaction_meddra_pt": meddra_pt,
                    "route": route or "unknown",
                    "dose_unit": dose_unit or "unknown",
                    "age_band": age_band or "unknown",
                    "sex": sex or "unknown",
                    "case_count": case_count,
                    "total_reports_for_drug": totals[(drug_name, rxcui)],
                }
            )

    print(f"Wrote standardized signals: {out_file}")


if __name__ == "__main__":
    build_standardized_signals()
