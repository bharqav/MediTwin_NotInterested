def compute_pk_modifiers(profile: dict) -> dict:
    """Compute patient-specific pharmacokinetic adjustment coefficients."""
    egfr = profile.get("egfr")
    alt = profile.get("alt")
    age = profile["age"]
    weight = profile["weight_kg"]
    bmi = profile["bmi"]

    # Renal clearance modifier (eGFR CKD staging)
    if egfr is None:
        renal_mod = 1.0
    elif egfr < 15:
        renal_mod = 0.15
    elif egfr < 30:
        renal_mod = 0.30
    elif egfr < 45:
        renal_mod = 0.55
    elif egfr < 60:
        renal_mod = 0.70
    elif egfr < 90:
        renal_mod = 0.88
    else:
        renal_mod = 1.0

    # Hepatic clearance modifier (ALT elevation)
    ULN = 40
    if alt is None:
        hepatic_mod = 1.0
    elif alt > 5 * ULN:
        hepatic_mod = 0.20
    elif alt > 3 * ULN:
        hepatic_mod = 0.45
    elif alt > 1.5 * ULN:
        hepatic_mod = 0.72
    else:
        hepatic_mod = 1.0

    # Age-related absorption modifier
    if age >= 75:
        absorption_mod = 0.75
    elif age >= 65:
        absorption_mod = 0.88
    elif age <= 12:
        absorption_mod = 1.15
    else:
        absorption_mod = 1.0

    # Volume of distribution modifier
    if bmi >= 35:
        vd_mod = 1.35
    elif bmi >= 30:
        vd_mod = 1.18
    elif bmi < 18.5:
        vd_mod = 0.85
    else:
        vd_mod = 1.0

    return {
        "renal_clearance_mod": round(renal_mod, 3),
        "hepatic_clearance_mod": round(hepatic_mod, 3),
        "absorption_mod": round(absorption_mod, 3),
        "vd_mod": round(vd_mod, 3),
        "combined_clearance_mod": round((renal_mod * 0.5 + hepatic_mod * 0.5), 3)
    }
