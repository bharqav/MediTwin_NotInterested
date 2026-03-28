from __future__ import annotations

from typing import Dict, List, Tuple


SEVERITY_BANDS = {
    "critical": 0.85,
    "high": 0.65,
    "moderate": 0.40,
}

CONFLICT_PHRASES = {
    "critical": ["fine", "normal", "no concern", "safe", "stable", "everything looks fine"],
    "high": ["minimal", "mild only", "no issue", "not significant"],
    "moderate": ["no notable effect", "nothing significant"],
}


def _score_band(score: float) -> str:
    if score >= SEVERITY_BANDS["critical"]:
        return "critical"
    if score >= SEVERITY_BANDS["high"]:
        return "high"
    if score >= SEVERITY_BANDS["moderate"]:
        return "moderate"
    return "low"


def _text_conflicts(text: str, band: str) -> bool:
    lowered = (text or "").lower()
    return any(phrase in lowered for phrase in CONFLICT_PHRASES.get(band, []))


def _max_organ_scores(ml_outputs: dict) -> Dict[str, float]:
    max_scores: Dict[str, float] = {}
    for tp in ml_outputs.get("timeline", []):
        for organ, data in tp.get("organ_effects", {}).items():
            score = float(data.get("effect_score", 0))
            max_scores[organ] = max(max_scores.get(organ, 0.0), score)
    return max_scores


def validate_llm_against_ml(ml_outputs: dict, llm_output: dict) -> dict:
    """
    Compare LLM narrative tone against ML numeric severity.
    Returns violations and whether a regeneration should be attempted.
    """
    violations: List[dict] = []
    correction_overlay: List[str] = []

    summary_text = f"{llm_output.get('summary', '')} {llm_output.get('risk_score_explanation', '')}"

    top_organs = sorted(_max_organ_scores(ml_outputs).items(), key=lambda x: x[1], reverse=True)[:3]
    for organ, score in top_organs:
        band = _score_band(score)
        if band in ("critical", "high") and _text_conflicts(summary_text, band):
            violations.append(
                {
                    "type": "summary_conflict",
                    "organ": organ,
                    "ml_score": round(score, 3),
                    "expected_band": band,
                    "llm_text_excerpt": summary_text[:240],
                }
            )
            correction_overlay.append(
                f"{organ.title()} risk is {band.upper()} ({score:.2f}) but narrative downplays severity."
            )

    llm_timeline_map = {tp.get("time_hours"): tp for tp in llm_output.get("timeline", [])}
    for ml_tp in ml_outputs.get("timeline", []):
        llm_tp = llm_timeline_map.get(ml_tp.get("time_hours"))
        if not llm_tp:
            continue
        for organ, organ_data in ml_tp.get("organ_effects", {}).items():
            score = float(organ_data.get("effect_score", 0))
            band = _score_band(score)
            if band not in ("critical", "high", "moderate"):
                continue
            llm_desc = (
                llm_tp.get("organ_effects", {})
                .get(organ, {})
                .get("description", "")
            )
            if _text_conflicts(llm_desc, band):
                violations.append(
                    {
                        "type": "organ_description_conflict",
                        "time_hours": ml_tp.get("time_hours"),
                        "organ": organ,
                        "ml_score": round(score, 3),
                        "expected_band": band,
                        "llm_text_excerpt": str(llm_desc)[:240],
                    }
                )

    return {
        "ok": len(violations) == 0,
        "should_regenerate": len(violations) > 0,
        "violation_count": len(violations),
        "violations": violations,
        "correction_overlay": correction_overlay,
    }


def build_guardian_regen_feedback(guardian_result: dict) -> str:
    """
    Convert violations into deterministic retry instructions for the LLM.
    """
    if guardian_result.get("violation_count", 0) == 0:
        return ""

    lines = [
        "GUARDIAN VALIDATION FAILED.",
        "You downplayed ML-computed severity. Regenerate JSON and keep numeric values unchanged.",
        "Do NOT use reassuring terms if any organ has high/critical score.",
        "Violations:",
    ]
    for v in guardian_result.get("violations", [])[:8]:
        lines.append(
            f"- {v.get('type')} organ={v.get('organ')} score={v.get('ml_score')} expected={v.get('expected_band')}"
        )
    lines.append("Regenerate full JSON now with clinically consistent wording.")
    return "\n".join(lines)

