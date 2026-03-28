import re


def _normalize_text(value: str) -> str:
    value = (value or "").strip().lower()
    value = re.sub(r"[^a-z0-9\s]+", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def _token_overlap(a: str, b: str) -> float:
    set_a = set(_normalize_text(a).split())
    set_b = set(_normalize_text(b).split())
    if not set_a or not set_b:
        return 0.0
    inter = len(set_a & set_b)
    denom = max(len(set_a), len(set_b))
    return inter / denom


def calibrate_side_effects_with_evidence(
    side_effects: list,
    drug_name: str,
    evidence_index: dict | None
) -> tuple[list, dict]:
    """
    Adjust side-effect probabilities using real-world signal priors.
    Evidence index format:
      {
        "ibuprofen": {
          "total_reports": 1000,
          "reactions": {"dyspepsia": 120, "headache": 210}
        }
      }
    """
    if not evidence_index:
        return side_effects, {
            "enabled": False,
            "authenticity_score": 0.0,
            "matched_reactions": 0,
            "total_reports": 0,
        }

    drug_key = _normalize_text(drug_name)
    drug_data = evidence_index.get(drug_key)
    if not drug_data:
        return side_effects, {
            "enabled": True,
            "authenticity_score": 0.1,
            "matched_reactions": 0,
            "total_reports": 0,
        }

    total_reports = max(int(drug_data.get("total_reports", 0)), 0)
    reaction_counts = drug_data.get("reactions", {})
    if not reaction_counts or total_reports <= 0:
        return side_effects, {
            "enabled": True,
            "authenticity_score": 0.2,
            "matched_reactions": 0,
            "total_reports": total_reports,
        }

    calibrated = []
    matched = 0

    for se in side_effects:
        effect = se.get("effect", "")
        best_term = None
        best_score = 0.0
        for term in reaction_counts.keys():
            sim = _token_overlap(effect, term)
            if sim > best_score:
                best_score = sim
                best_term = term

        prob = float(se.get("probability", 0.0))
        evidence_strength = 0.0
        observed_prob = 0.0
        if best_term and best_score >= 0.35:
            matched += 1
            raw = reaction_counts[best_term]
            # Bayesian smoothing avoids extreme probabilities from sparse counts.
            observed_prob = (raw + 1.0) / (total_reports + 50.0)
            evidence_strength = raw / total_reports

        # Blend simulator probability with evidence prior.
        # Weight rises with both overlap quality and report volume.
        report_weight = min(1.0, total_reports / 300.0)
        # Keep evidence influential but avoid washing out dose- and patient-dependent ML signal.
        blend_weight = min(0.5, report_weight * best_score)
        if observed_prob > 0 and best_score >= 0.6 and total_reports >= 30:
            blend_weight = max(blend_weight, 0.2)
        # Hard cap: population-level priors must not collapse per-patient probabilities.
        blend_weight = min(0.12, blend_weight * 0.45)
        if observed_prob > 0:
            blended = prob * (1.0 - blend_weight) + observed_prob * blend_weight
        else:
            blended = prob
        calibrated_prob = round(min(0.98, max(0.01, blended)), 3)

        updated = dict(se)
        updated["probability"] = calibrated_prob
        updated["evidence_term"] = best_term if best_score >= 0.35 else None
        updated["evidence_overlap"] = round(best_score, 3)
        updated["evidence_blend_weight"] = round(blend_weight, 3)
        calibrated.append(updated)

    # Keep only model side-effects (no synthetic insertion), then recalibrate probabilities.
    calibrated.sort(key=lambda x: x.get("probability", 0.0), reverse=True)

    authenticity = min(
        1.0,
        (0.4 if total_reports >= 100 else 0.2)
        + (matched / max(1, len(side_effects))) * 0.6,
    )

    return calibrated, {
        "enabled": True,
        "authenticity_score": round(authenticity, 3),
        "matched_reactions": matched,
        "evidence_enriched_effects": 0,
        "total_reports": total_reports,
    }

