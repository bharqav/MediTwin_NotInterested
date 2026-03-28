import logging
import time

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from ml_pipeline.pipeline import run_ml_pipeline
from groq_enricher import enrich_with_groq
from guardian import validate_llm_against_ml, build_guardian_regen_feedback

logger = logging.getLogger(__name__)

router = APIRouter()


class SimulateRequest(BaseModel):
    profile: dict
    drugs: list
    subject_id: str | None = None


def _apply_dose_safety_overlay(enriched: dict, ml_outputs: dict, current_dose_mg: float):
    max_organ = 0.0
    for tp in ml_outputs.get("timeline", []):
        for data in tp.get("organ_effects", {}).values():
            max_organ = max(max_organ, float(data.get("effect_score", 0.0)))

    has_absolute_contra = any(c.get("type") == "absolute" for c in ml_outputs.get("contraindication_alerts", []))
    has_alerts = bool(ml_outputs.get("interaction_flags")) or bool(ml_outputs.get("contraindication_alerts"))
    risk_score = float(ml_outputs.get("risk_score", 0.0))

    if has_absolute_contra or risk_score >= 65 or max_organ >= 0.65:
        guidance = "DOSE_DOWN"
        suggested = round(max(1.0, current_dose_mg * 0.75), 1)
        reason = (
            "Numeric safety overlay: elevated model risk/organ burden detected; "
            "dose reduction is recommended."
        )
    elif risk_score <= 20 and (not has_alerts) and max_organ < 0.25:
        guidance = "DOSE_UP"
        suggested = round(current_dose_mg * 1.1, 1)
        reason = (
            "Numeric safety overlay: low modeled risk and no alerts; "
            "a cautious dose increase can be considered."
        )
    else:
        guidance = "MAINTAIN_DOSE"
        suggested = round(current_dose_mg, 1)
        reason = (
            "Numeric safety overlay: current modeled exposure-risk profile supports "
            "maintaining this dose."
        )

    enriched["dose_guidance"] = guidance
    enriched["suggested_dose_mg"] = suggested
    enriched["dose_guidance_reason"] = reason


@router.post("/simulate")
async def simulate(req: SimulateRequest):
    t0 = time.perf_counter()
    drug_name = (req.drugs[0] or {}).get("name", "?") if req.drugs else "?"
    subj = req.subject_id or "-"
    try:
        from main import drug_db, drug_classes_db, evidence_index, simulation_cache, make_cache_key

        cache_key = make_cache_key(req.profile, req.drugs[0], req.subject_id)
        if cache_key in simulation_cache:
            total_ms = (time.perf_counter() - t0) * 1000
            logger.info(
                "simulate_done cache_hit=true drug=%s subject_id=%s total_ms=%.1f",
                drug_name,
                subj,
                total_ms,
            )
            return {"success": True, "simulation": simulation_cache[cache_key]}

        t_ml = time.perf_counter()
        ml_result = run_ml_pipeline(
            profile=req.profile,
            drug=req.drugs[0],
            drug_db=drug_db,
            drug_classes_db=drug_classes_db,
            evidence_index=evidence_index,
        )
        ms_ml = (time.perf_counter() - t_ml) * 1000

        t_g = time.perf_counter()
        enriched = await enrich_with_groq(
            profile=req.profile,
            drug=req.drugs[0],
            ml_outputs=ml_result["ml_outputs"]
        )
        ms_groq = (time.perf_counter() - t_g) * 1000
        ms_groq_retry = 0.0
        did_regen = False

        guardian = validate_llm_against_ml(ml_result["ml_outputs"], enriched)
        if guardian["should_regenerate"]:
            did_regen = True
            regen_feedback = build_guardian_regen_feedback(guardian)
            t_r = time.perf_counter()
            enriched_retry = await enrich_with_groq(
                profile=req.profile,
                drug=req.drugs[0],
                ml_outputs=ml_result["ml_outputs"],
                guardian_feedback=regen_feedback,
            )
            ms_groq_retry = (time.perf_counter() - t_r) * 1000
            guardian_retry = validate_llm_against_ml(ml_result["ml_outputs"], enriched_retry)
            if guardian_retry["ok"]:
                enriched = enriched_retry
                guardian = guardian_retry
            else:
                # Fall back to ML-grounded correction overlay if retry still conflicts.
                enriched["guardian"] = {
                    "status": "corrected_overlay",
                    "violation_count": guardian_retry["violation_count"],
                    "correction_overlay": guardian_retry["correction_overlay"],
                    "violations": guardian_retry["violations"],
                }
        else:
            enriched["guardian"] = {"status": "ok", "violation_count": 0}

        current_dose = float(req.drugs[0].get("dose_mg", 0) or 0)
        if current_dose > 0:
            _apply_dose_safety_overlay(
                enriched=enriched,
                ml_outputs=ml_result["ml_outputs"],
                current_dose_mg=current_dose,
            )

        simulation_cache[cache_key] = enriched

        total_ms = (time.perf_counter() - t0) * 1000
        logger.info(
            "simulate_done cache_hit=false drug=%s subject_id=%s ms_ml=%.1f ms_groq=%.1f "
            "ms_groq_retry=%.1f total_ms=%.1f guardian_regen=%s",
            drug_name,
            subj,
            ms_ml,
            ms_groq,
            ms_groq_retry,
            total_ms,
            did_regen,
        )

        return {"success": True, "simulation": enriched}

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Simulation failed: {str(e)}")
