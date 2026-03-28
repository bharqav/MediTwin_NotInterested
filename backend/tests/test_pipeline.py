"""Unit tests for the numeric ML pipeline (no HTTP, no Groq)."""

import pytest

from data_loader import load_data, load_evidence_index
from ml_pipeline.pipeline import run_ml_pipeline


@pytest.fixture(scope="module")
def drug_data():
    drug_db, drug_classes_db = load_data()
    evidence_index = load_evidence_index()
    return drug_db, drug_classes_db, evidence_index


PROFILE_BASE = {
    "age": 45,
    "sex": "female",
    "weight_kg": 68,
    "height_cm": 162,
    "bmi": 25.9,
    "conditions": ["type_2_diabetes", "hypertension"],
    "medications": [{"name": "Metformin", "dose_mg": 500, "frequency": "twice_daily"}],
    "allergies": [],
    "egfr": 68,
    "alt": 32,
    "ast": 28,
    "smoking": False,
    "alcohol": "occasional",
}

DRUG_IBU = {
    "name": "Ibuprofen",
    "dose_mg": 400,
    "route": "oral",
    "frequency": "three_times_daily",
    "duration_days": 5,
}


def test_run_ml_pipeline_produces_timeline_and_risk(drug_data):
    drug_db, drug_classes_db, evidence_index = drug_data
    out = run_ml_pipeline(PROFILE_BASE, DRUG_IBU, drug_db, drug_classes_db, evidence_index)
    ml = out["ml_outputs"]
    assert "timeline" in ml and len(ml["timeline"]) >= 1
    assert 0 <= float(ml.get("risk_score", -1)) <= 100
    assert "predicted_side_effects" in ml and isinstance(ml["predicted_side_effects"], list)
    assert "pk_modifiers" in ml


def test_unknown_drug_raises(drug_data):
    drug_db, drug_classes_db, evidence_index = drug_data
    bad = {**DRUG_IBU, "name": "TotallyFakeDrugXYZ123"}
    with pytest.raises(ValueError, match="not found"):
        run_ml_pipeline(PROFILE_BASE, bad, drug_db, drug_classes_db, evidence_index)
