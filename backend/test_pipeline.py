"""Manual smoke script for the ML pipeline.

Prefer automated checks: pytest tests/test_pipeline.py (from backend/)
"""
import json
import sys
sys.path.insert(0, ".")

from ml_pipeline.pipeline import run_ml_pipeline

with open("data/drugs.json") as f:
    drug_db = json.load(f)
with open("data/drug_classes.json") as f:
    drug_classes = json.load(f)

profile = {
    "age": 45, "sex": "female", "weight_kg": 68, "height_cm": 162,
    "bmi": 25.9, "conditions": ["type_2_diabetes", "hypertension"],
    "medications": [{"name": "Metformin", "dose_mg": 500, "frequency": "twice_daily"}],
    "allergies": [], "egfr": 68, "alt": 32, "ast": 28,
    "smoking": False, "alcohol": "occasional"
}

drug = {"name": "Ibuprofen", "dose_mg": 400, "route": "oral",
        "frequency": "three_times_daily", "duration_days": 5}

result = run_ml_pipeline(profile, drug, drug_db, drug_classes)
ml = result["ml_outputs"]

print(f"PK Modifiers: renal={ml['pk_modifiers']['renal_clearance_mod']}, hepatic={ml['pk_modifiers']['hepatic_clearance_mod']}")
print(f"Risk Score: {ml['risk_score']}/100")
print(f"  SE: {ml['risk_breakdown']['side_effect_risk']}, Int: {ml['risk_breakdown']['interaction_risk']}, Contra: {ml['risk_breakdown']['contraindication_risk']}")
print(f"Timeline points: {len(ml['timeline'])}")
print(f"Side effects: {len(ml['predicted_side_effects'])}")
for se in ml['predicted_side_effects'][:3]:
    print(f"  - {se['effect']}: {se['probability']:.2%} ({se['severity']})")
print(f"Interactions: {len(ml['interaction_flags'])}")
for f in ml['interaction_flags']:
    print(f"  - {f['drug_a']} + {f['drug_b']} ({f['severity']})")
print(f"Contraindications: {len(ml['contraindication_alerts'])}")
for c in ml['contraindication_alerts']:
    print(f"  - [{c['type']}] {c['condition']}")
print("\n✓ ML Pipeline test passed!")
