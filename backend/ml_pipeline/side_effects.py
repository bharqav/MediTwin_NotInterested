def compute_side_effects(
    drug_class_data: dict,
    pk_modifiers: dict,
    profile: dict,
    dose_normalized: float = 1.0,
) -> list:
    """Adjust base side effect probabilities using patient-specific modifiers."""
    conditions = profile.get("conditions", []) or []
    cond_lower = [str(c).lower() for c in conditions]
    renal_mod = pk_modifiers["renal_clearance_mod"]
    hepatic_mod = pk_modifiers["hepatic_clearance_mod"]
    absorption_mod = pk_modifiers.get("absorption_mod", 1.0)
    vd_mod = pk_modifiers.get("vd_mod", 1.0)
    age = profile["age"]
    smoking = bool(profile.get("smoking"))
    n_meds = len(profile.get("medications") or [])
    n_conditions = len(conditions)

    scored = []
    for se in drug_class_data["known_side_effects"]:
        base_prob = se["base_probability"]
        renal_amp = se.get("renal_amplifier", 1.0)
        hepatic_amp = se.get("hepatic_amplifier", 1.0)
        eff_lower = (se.get("effect") or "").lower()

        # Make adverse-event probability dose-sensitive so UI/outputs respond to dose changes.
        dose_factor = min(2.0, max(0.4, float(dose_normalized) ** 0.85))
        adjusted_prob = base_prob * dose_factor
        adjusted_prob *= (1 + (1 - renal_mod) * (renal_amp - 1))
        adjusted_prob *= (1 + (1 - hepatic_mod) * (hepatic_amp - 1))

        if age >= 65:
            adjusted_prob *= 1.25
        elif age <= 30:
            adjusted_prob *= 0.92

        # Absorption / mucosal exposure (older adults often have reduced absorption modulation).
        if any(x in eff_lower for x in ("gi", "gastro", "stomach", "dyspep", "nausea", "intestinal", "vomit", "epigastric")):
            adjusted_prob *= 1.0 + (1.0 - absorption_mod) * 0.45
        # Distribution: habitus shifts exposure for vascular / fluid / some CNS symptoms.
        if any(x in eff_lower for x in ("headache", "dizz", "vertigo", "fluid", "retention", "edema", "hypertension")):
            adjusted_prob *= 1.0 + (vd_mod - 1.0) * 0.35

        # Polypharmacy burden (metabolism, interactions, cumulative toxicity).
        if any(x in eff_lower for x in ("liver", "hepat", "renal", "kidney", "platelet", "bleed")):
            adjusted_prob *= 1.0 + min(0.45, n_meds * 0.07)
        elif n_meds >= 2:
            adjusted_prob *= 1.0 + min(0.18, (n_meds - 1) * 0.05)

        # Comorbidity count (general vulnerability).
        adjusted_prob *= 1.0 + min(0.4, n_conditions * 0.06)

        if smoking and any(x in eff_lower for x in ("gi", "bleed", "ulcer", "gastro", "stomach")):
            adjusted_prob *= 1.15

        if "hypertension" in cond_lower and "fluid retention" in eff_lower:
            adjusted_prob *= 1.4
        if any("diabet" in c for c in cond_lower) and "renal" in eff_lower:
            adjusted_prob *= 1.3
        if any(c in cond_lower for c in ("copd", "asthma")) and any(
            x in eff_lower for x in ("nausea", "dizz", "headache", "cough", "bronch")
        ):
            adjusted_prob *= 1.12
        if any(c in cond_lower for c in ("epilepsy", "seizure")) and any(
            x in eff_lower for x in ("dizz", "headache", "cns", "sedat", "somnolence")
        ):
            adjusted_prob *= 1.18

        final_prob = round(min(0.98, max(0.01, adjusted_prob)), 3)

        severity = "low"
        if final_prob >= 0.75:
            severity = "moderate"
        elif final_prob >= 0.3:
            severity = "mild"

        if "severe" in se["effect"].lower() or "bleed" in se["effect"].lower():
            severity = "severe" if final_prob >= 0.2 else "moderate"

        scored.append({
            "effect": se["effect"],
            "probability": final_prob,
            "onset_hours": 0.5,
            "duration_hours": 6,
            "severity": severity,
            "explanation": ""
        })

    scored.sort(key=lambda x: x["probability"], reverse=True)
    return scored[:8]
