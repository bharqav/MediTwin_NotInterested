import random
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from ml_pipeline.pipeline import run_ml_pipeline
from groq_enricher import enrich_with_groq, groq_client, build_fallback_result

router = APIRouter()


class PopulationConfig(BaseModel):
    n: int = 20
    age_min: int = 18
    age_max: int = 85
    sex_distribution: str = "equal"
    kidney_function: str = "mixed"
    diabetic_pct: int = 20
    hypertension_pct: int = 20


class PopulationRequest(BaseModel):
    drug: dict
    config: PopulationConfig


def generate_patient_profile(config: PopulationConfig) -> dict:
    """Generate a random patient profile based on population config."""
    age = random.randint(config.age_min, config.age_max)

    if config.sex_distribution == "equal":
        sex = random.choice(["male", "female"])
    elif config.sex_distribution == "male_heavy":
        sex = random.choices(["male", "female"], weights=[70, 30])[0]
    else:
        sex = random.choices(["male", "female"], weights=[30, 70])[0]

    weight_kg = random.randint(50, 110)
    height_cm = random.randint(150, 190)
    bmi = round(weight_kg / ((height_cm / 100) ** 2), 1)

    # Kidney function
    if config.kidney_function == "normal":
        egfr = random.randint(80, 120)
    elif config.kidney_function == "impaired_heavy":
        egfr = random.choices(
            [random.randint(15, 40), random.randint(40, 70), random.randint(70, 120)],
            weights=[40, 35, 25]
        )[0]
    else:  # mixed
        egfr = random.choices(
            [random.randint(20, 50), random.randint(50, 80), random.randint(80, 120)],
            weights=[25, 35, 40]
        )[0]

    alt = random.randint(15, 80)

    conditions = []
    if random.randint(1, 100) <= config.diabetic_pct:
        conditions.append("type_2_diabetes")
    if random.randint(1, 100) <= config.hypertension_pct:
        conditions.append("hypertension")
    if age >= 65 and random.random() < 0.3:
        conditions.append("osteoarthritis")

    return {
        "age": age, "sex": sex, "weight_kg": weight_kg,
        "height_cm": height_cm, "bmi": bmi, "egfr": egfr,
        "alt": alt, "conditions": conditions,
        "medications": [], "allergies": [],
        "smoking": random.random() < 0.15,
        "alcohol": random.choice(["none", "occasional", "moderate"])
    }


@router.post("/simulate/population")
async def simulate_population(req: PopulationRequest):
    try:
        from main import drug_db, drug_classes_db, evidence_index

        results = []
        risk_scores = []

        for i in range(min(req.config.n, 50)):
            profile = generate_patient_profile(req.config)
            try:
                ml_result = run_ml_pipeline(
                    profile=profile,
                    drug=req.drug,
                    drug_db=drug_db,
                    drug_classes_db=drug_classes_db,
                    evidence_index=evidence_index,
                )
                ml_out = ml_result["ml_outputs"]
                risk_scores.append(ml_out["risk_score"])
                results.append({
                    "patient_id": i + 1,
                    "profile": profile,
                    "risk_score": ml_out["risk_score"],
                    "risk_breakdown": ml_out["risk_breakdown"],
                    "top_side_effect": ml_out["predicted_side_effects"][0]["effect"] if ml_out["predicted_side_effects"] else "None",
                    "top_se_probability": ml_out["predicted_side_effects"][0]["probability"] if ml_out["predicted_side_effects"] else 0,
                    "interaction_count": len(ml_out["interaction_flags"]),
                    "contraindication_count": len(ml_out["contraindication_alerts"]),
                    "pk_modifiers": ml_out["pk_modifiers"]
                })
            except Exception as e:
                print(f"Patient {i+1} failed: {e}")
                continue

        # Aggregate stats
        if not risk_scores:
            raise ValueError("No successful simulations")

        se_incidence = {}
        for r in results:
            effect = r["top_side_effect"]
            se_incidence[effect] = se_incidence.get(effect, 0) + 1

        mean_risk = round(sum(risk_scores) / len(risk_scores), 1)
        high_risk_count = sum(1 for s in risk_scores if s > 60)

        # Subgroup analysis
        renal_impaired = [r for r in results if r["pk_modifiers"]["renal_clearance_mod"] < 0.75]
        renal_impaired_mean = round(sum(r["risk_score"] for r in renal_impaired) / len(renal_impaired), 1) if renal_impaired else 0

        return {
            "success": True,
            "total_patients": len(results),
            "mean_risk_score": mean_risk,
            "high_risk_count": high_risk_count,
            "risk_distribution": risk_scores,
            "side_effect_incidence": se_incidence,
            "most_prevalent_side_effect": max(se_incidence, key=se_incidence.get) if se_incidence else "None",
            "subgroup_analysis": {
                "renal_impaired_count": len(renal_impaired),
                "renal_impaired_mean_risk": renal_impaired_mean
            },
            "individual_results": results
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Population simulation failed: {str(e)}")
