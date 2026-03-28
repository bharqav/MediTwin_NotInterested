import json
import os
import csv


def load_data():
    """Load drug and drug class databases from JSON files."""
    data_dir = os.path.join(os.path.dirname(__file__), "data")

    with open(os.path.join(data_dir, "drugs.json"), "r") as f:
        drug_db = json.load(f)

    with open(os.path.join(data_dir, "drug_classes.json"), "r") as f:
        drug_classes_db = json.load(f)

    return drug_db, drug_classes_db


def load_evidence_index():
    """
    Load standardized evidence signals if available.
    CSV schema:
      drug_name,reaction_meddra_pt,case_count,total_reports_for_drug
    """
    data_dir = os.path.join(os.path.dirname(__file__), "data")
    signals_csv = os.path.join(data_dir, "evidence", "standardized_signals.csv")
    if not os.path.exists(signals_csv):
        return {}

    index = {}
    with open(signals_csv, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            drug = (row.get("drug_name") or "").strip().lower()
            reaction = (row.get("reaction_meddra_pt") or "").strip().lower()
            if not drug or not reaction:
                continue

            case_count = int(float(row.get("case_count") or 0))
            total_reports = int(float(row.get("total_reports_for_drug") or 0))
            if total_reports < 5 or case_count <= 0:
                continue

            bucket = index.setdefault(drug, {"total_reports": total_reports, "reactions": {}})
            if total_reports > bucket.get("total_reports", 0):
                bucket["total_reports"] = total_reports
            bucket["reactions"][reaction] = bucket["reactions"].get(reaction, 0) + case_count

    return index
