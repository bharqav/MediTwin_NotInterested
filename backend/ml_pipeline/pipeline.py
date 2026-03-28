from .pk_modifiers import compute_pk_modifiers
from .organ_effects import compute_organ_effects
from .side_effects import compute_side_effects
from .evidence_calibration import calibrate_side_effects_with_evidence
from .interactions import check_interactions
from .contraindications import check_contraindications
from .risk_score import compute_risk_score


def run_ml_pipeline(
    profile: dict,
    drug: dict,
    drug_db: list,
    drug_classes_db: list,
    evidence_index: dict | None = None
) -> dict:
    """Full ML pipeline run. Returns numeric simulation dict ready for LLM enrichment."""
    drug_entry = next(
        (d for d in drug_db if d["name"].lower() == drug["name"].lower()), None
    )
    if not drug_entry:
        raise ValueError(f"Drug not found in database: {drug['name']}")

    drug_class_id = drug_entry["drug_class_id"]
    drug_class_data = next(
        (dc for dc in drug_classes_db if dc["class_id"] == drug_class_id), None
    )
    if not drug_class_data:
        raise ValueError(f"Drug class not found: {drug_class_id}")

    pk_modifiers = compute_pk_modifiers(profile)

    typical_dose = drug_entry.get("typical_dose_mg", drug["dose_mg"])
    dose_normalized = drug["dose_mg"] / typical_dose if typical_dose else 1.0
    frequency = drug.get("frequency", "three_times_daily")
    duration_days = drug.get("duration_days", 3)
    timeline = compute_organ_effects(
        drug_class_data, pk_modifiers, dose_normalized, profile,
        frequency=frequency, duration_days=duration_days
    )

    side_effects = compute_side_effects(
        drug_class_data=drug_class_data,
        pk_modifiers=pk_modifiers,
        profile=profile,
        dose_normalized=dose_normalized,
    )
    side_effects, evidence_meta = calibrate_side_effects_with_evidence(
        side_effects=side_effects,
        drug_name=drug.get("name", ""),
        evidence_index=evidence_index,
    )

    interaction_flags = check_interactions(
        drug_class_id,
        profile.get("medications", []),
        drug_db,
        drug_classes_db
    )

    contraindication_alerts = check_contraindications(drug_class_data, profile)

    risk_data = compute_risk_score(
        side_effects, interaction_flags, contraindication_alerts, pk_modifiers, profile
    )

    return {
        "ml_outputs": {
            "pk_modifiers": pk_modifiers,
            "drug_class": drug_class_data["class_name"],
            "timeline": timeline,
            "predicted_side_effects": side_effects,
            "evidence_meta": evidence_meta,
            "interaction_flags": interaction_flags,
            "contraindication_alerts": contraindication_alerts,
            "peak_time_hours": drug_class_data["typical_peak_hours"],
            "half_life_hours": drug_class_data["typical_half_life_hours"],
            "clearance_time_hours": drug_class_data["typical_clearance_hours"],
            **risk_data
        }
    }
