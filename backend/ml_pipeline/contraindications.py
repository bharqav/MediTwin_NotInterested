CONDITION_MAP = {
    "ckd_stage_3_plus": lambda p: (p.get("egfr") or 100) < 60,
    "ckd_stage_4_plus": lambda p: (p.get("egfr") or 100) < 30,
    "active_gi_bleed": lambda p: "gi_bleed" in p.get("conditions", []),
    "hypertension": lambda p: "hypertension" in p.get("conditions", []),
    "diabetes": lambda p: any("diabet" in c for c in p.get("conditions", [])),
    "heart_failure": lambda p: "heart_failure" in p.get("conditions", []),
    "liver_disease": lambda p: "liver_disease" in p.get("conditions", []) or (p.get("alt") or 0) > 120,
    "pregnancy_trimester3": lambda p: "pregnancy_t3" in p.get("conditions", []),
    "aspirin_allergy": lambda p: "aspirin" in [a.lower() for a in p.get("allergies", [])],
    "penicillin_allergy": lambda p: "penicillin" in [a.lower() for a in p.get("allergies", [])],
    "asthma": lambda p: "asthma" in p.get("conditions", []),
    "rheumatoid_arthritis": lambda p: "rheumatoid_arthritis" in p.get("conditions", []),
    "epilepsy": lambda p: "epilepsy" in p.get("conditions", []),
    "copd": lambda p: "copd" in p.get("conditions", []),
    "peripheral_neuropathy": lambda p: "peripheral_neuropathy" in p.get("conditions", []),
}


def check_contraindications(drug_class_data: dict, profile: dict) -> list:
    """Check patient conditions against drug contraindications."""
    alerts = []
    for contra in drug_class_data.get("contraindications", []):
        condition_key = contra["condition"]
        check_fn = CONDITION_MAP.get(condition_key)
        if check_fn and check_fn(profile):
            alerts.append({
                "type": contra["type"],
                "condition": condition_key,
                "reason": contra["reason"],
                "recommendation": ""
            })
    return alerts
