def compute_risk_score(
    side_effects: list,
    interaction_flags: list,
    contraindication_alerts: list,
    pk_modifiers: dict,
    profile: dict
) -> dict:
    """Composite risk score 0-100 using weighted formula."""
    severity_weights = {"low": 0.3, "mild": 0.6, "moderate": 1.0, "severe": 2.0}
    se_score = sum(
        se["probability"] * severity_weights.get(se["severity"], 1.0)
        for se in side_effects
    )
    se_component = min(60, se_score * 15)

    interaction_severity_map = {"mild": 5, "moderate": 12, "severe": 25}
    interaction_component = min(25, sum(
        interaction_severity_map.get(flag.get("severity", "mild"), 5)
        for flag in interaction_flags
    ))

    contra_score = sum(
        15 if c["type"] == "absolute" else 8
        for c in contraindication_alerts
    )
    contra_component = min(15, contra_score)

    total = round(se_component + interaction_component + contra_component)
    total = min(100, max(0, total))

    return {
        "risk_score": total,
        "risk_breakdown": {
            "side_effect_risk": round(se_component),
            "interaction_risk": round(interaction_component),
            "contraindication_risk": round(contra_component)
        }
    }
