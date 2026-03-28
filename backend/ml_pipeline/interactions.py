def check_interactions(
    simulated_drug_class: str,
    current_medications: list,
    drug_db: list,
    drug_classes_db: list
) -> list:
    """Rule-based CYP450 and pharmacodynamic interaction checker."""
    flags = []
    drug_to_class = {d["name"].lower(): d["drug_class_id"] for d in drug_db}

    sim_class_data = next(
        (dc for dc in drug_classes_db if dc["class_id"] == simulated_drug_class), None
    )
    if not sim_class_data:
        return []

    for med in current_medications:
        med_class = drug_to_class.get(med["name"].lower())
        if not med_class:
            continue

        for interaction in sim_class_data.get("known_interactions", []):
            if interaction["interacts_with_class"] == med_class:
                flags.append({
                    "drug_a": sim_class_data["class_name"],
                    "drug_b": med["name"],
                    "mechanism": interaction["mechanism"],
                    "severity": interaction["severity"],
                    "cyp_pathway": interaction.get("cyp_pathway"),
                    "clinical_effect": "",
                    "recommendation": ""
                })

    return flags
