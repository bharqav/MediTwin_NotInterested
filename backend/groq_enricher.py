import os
import json
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

groq_client = None
GROQ_API_KEY = os.environ.get("GROQ_API_KEY")
if GROQ_API_KEY and GROQ_API_KEY != "your_groq_api_key_here":
    groq_client = Groq(api_key=GROQ_API_KEY)


def format_organ_scores(tp):
    parts = []
    for organ, data in tp["organ_effects"].items():
        parts.append(f"{organ}: {data['effect_score']}")
    return ", ".join(parts)


def format_side_effects(side_effects):
    lines = []
    for se in side_effects:
        lines.append(f"- {se['effect']}: probability={se['probability']}, severity={se['severity']}")
    return "\n".join(lines)


def format_interactions(flags):
    if not flags:
        return "None detected"
    lines = []
    for f in flags:
        lines.append(f"- {f['drug_a']} + {f['drug_b']}: {f['mechanism']} (severity: {f['severity']})")
    return "\n".join(lines)


def format_contraindications(alerts):
    if not alerts:
        return "None detected"
    lines = []
    for a in alerts:
        lines.append(f"- [{a['type']}] {a['condition']}: {a['reason']}")
    return "\n".join(lines)


def merge_organ_driver_summaries_from_ml(enriched: dict, ml_outputs: dict) -> None:
    """Re-attach ML-computed organ driver text; the LLM response often omits it."""
    ml_by_t = {tp["time_hours"]: tp for tp in ml_outputs.get("timeline", [])}
    for tp in enriched.get("timeline") or []:
        ml_tp = ml_by_t.get(tp.get("time_hours"))
        if not ml_tp:
            continue
        out = tp.setdefault("organ_effects", {})
        for organ, ml_od in (ml_tp.get("organ_effects") or {}).items():
            ds = ml_od.get("driver_summary")
            if not ds:
                continue
            cell = out.setdefault(organ, {})
            if ml_od.get("effect_score") is not None:
                cell["effect_score"] = ml_od["effect_score"]
            cell["driver_summary"] = ds


def _max_organ_scores_across_timeline(ml_outputs: dict) -> dict[str, float]:
    """Peak effect_score per organ over the simulated timeline."""
    peak: dict[str, float] = {}
    for tp in ml_outputs.get("timeline", []):
        for organ, data in (tp.get("organ_effects") or {}).items():
            sc = float((data or {}).get("effect_score", 0.0) or 0.0)
            peak[organ] = max(peak.get(organ, 0.0), sc)
    return peak


def _organ_for_side_effect(effect: str) -> str | None:
    e = (effect or "").lower()
    if any(x in e for x in ("headache", "migraine", "cephal")):
        return "brain"
    if any(x in e for x in ("gi", "gastro", "stomach", "bleed", "dyspeps", "nausea", "intestinal", "vomit")):
        return "stomach"
    if any(x in e for x in ("renal", "kidney", "fluid retention")):
        return "kidneys"
    if any(x in e for x in ("hepat", "liver")):
        return "liver"
    if any(x in e for x in ("platelet", "bleed", "bloodstream")):
        return "bloodstream"
    if any(x in e for x in ("hypertension", "heart", "cardio")):
        return "heart"
    if "brain" in e or "cns" in e:
        return "brain"
    if "lung" in e:
        return "lungs"
    return None


def _profile_anchor_sentence(profile: dict | None) -> str:
    if not profile:
        return ""
    conds = ", ".join(profile.get("conditions", []) or []) or "none listed"
    return (
        f" The input profile (conditions: {conds}; eGFR {profile.get('egfr', 'unknown')}) "
        f"is what this simulation used to modulate exposure and organ scores."
    )


def _build_alert_cause_from_ml(
    problem: str,
    ml_outputs: dict,
    profile: dict | None,
    drug: dict | None,
    *,
    side_effect: dict | None = None,
    interaction: dict | None = None,
    contraindication: dict | None = None,
) -> str:
    """Deterministic, ML-grounded explanation (used when LLM is weak or fallback)."""
    p = profile or {}
    pk = ml_outputs.get("pk_modifiers", {})
    renal_pct = float(pk.get("renal_clearance_mod", 1.0)) * 100
    hep_pct = float(pk.get("hepatic_clearance_mod", 1.0)) * 100
    peaks = _max_organ_scores_across_timeline(ml_outputs)
    dose_mg = float((drug or {}).get("dose_mg", 0) or 0)
    drug_name = (drug or {}).get("name", "the drug")

    parts = []

    if side_effect:
        eff = side_effect.get("effect", problem)
        prob = float(side_effect.get("probability", 0.0))
        organ = _organ_for_side_effect(eff)
        oscore = peaks.get(organ, 0.0) if organ else max(peaks.values()) if peaks else 0.0
        parts.append(
            f"The simulation assigns this adverse outcome a probability of about {prob:.0%} for {drug_name} at {dose_mg:.0f}mg given this patient's profile."
        )
        if organ:
            parts.append(
                f"Related organ load peaks around {oscore:.2f} (0–1 scale) for {organ}, consistent with the drug class and dose-normalized exposure in the model."
            )
        parts.append(
            f"Renal clearance is modeled at ~{renal_pct:.0f}% and hepatic clearance at ~{hep_pct:.0f}% of baseline, which shapes how risk concentrates across organs in this run."
        )
        return " ".join(parts) + _profile_anchor_sentence(p)

    if interaction:
        parts.append(
            f"An interaction is flagged between {interaction.get('drug_a', '')} and {interaction.get('drug_b', '')}: {interaction.get('mechanism', '')}."
        )
        parts.append(
            f"Overall simulated risk score is {ml_outputs.get('risk_score', 0)}/100 with interaction component {ml_outputs.get('risk_breakdown', {}).get('interaction_risk', 0)}."
        )
        return " ".join(parts) + _profile_anchor_sentence(p)

    if contraindication:
        parts.append(
            f"Contraindication context ({contraindication.get('type', '')}): {contraindication.get('reason', '')}."
        )
        parts.append(
            f"Modeled contraindication risk contribution is {ml_outputs.get('risk_breakdown', {}).get('contraindication_risk', 0)} on a 0–100 scale."
        )
        return " ".join(parts) + _profile_anchor_sentence(p)

    if peaks:
        top_org = max(peaks, key=peaks.get)
        parts.append(
            f"Peak modeled stress for {top_org} is {peaks.get(top_org, 0):.2f} under {drug_name} {dose_mg:.0f}mg in this simulation."
        )
    else:
        parts.append(
            f"The simulation run for {drug_name} {dose_mg:.0f}mg still flags this headline risk based on aggregate scoring (risk {ml_outputs.get('risk_score', 0)}/100)."
        )
    parts.append(
        f"Patient modifiers (renal ~{renal_pct:.0f}%, hepatic ~{hep_pct:.0f}% of baseline) explain how exposure maps to organ-level scores in MediTwin."
    )
    return " ".join(parts) + _profile_anchor_sentence(p)


def _alert_cause_is_weak(cause: str) -> bool:
    if not cause or len(cause.strip()) < 80:
        return True
    low = cause.lower()
    generic = (
        "modeled side-effect probability is elevated",
        "multiple patient and drug factors",
        "elevated for this patient profile",
        "track symptoms progression and hydration status over 24-72 hours",
    )
    return any(g in low for g in generic)


def _bucket_from_text(s: str) -> str:
    s = (s or "").lower()
    if any(x in s for x in ("gi", "gastro", "stomach", "nausea", "dyspeps", "intestinal", "vomit", "epigastric")):
        return "gi"
    if any(x in s for x in ("headache", "migraine", "cephal")):
        return "headache"
    if any(x in s for x in ("renal", "kidney", "fluid retention")):
        return "renal"
    if any(x in s for x in ("dizz", "vertigo", "sedat", "somnolence", "cns")):
        return "cns"
    return "other"


def _match_problem_to_effect(problem: str, effect: str) -> float:
    """Fuzzy match LLM alert titles (e.g. 'GI effects') to ML side-effect names."""
    p = (problem or "").lower().strip()
    e = (effect or "").lower().strip()
    if not p or not e:
        return 0.0
    if e in p or p in e:
        return 1.0
    bp = _bucket_from_text(p)
    be = _bucket_from_text(e)
    if bp != "other" and bp == be:
        return 0.92
    pw = {w.strip(".,;:") for w in p.replace("/", " ").replace("-", " ").split() if len(w.strip(".,;:")) >= 3}
    ew = {w.strip(".,;:") for w in e.replace("/", " ").replace("-", " ").split() if len(w.strip(".,;:")) >= 3}
    overlap = pw & ew
    if overlap:
        return min(0.85, 0.35 + 0.12 * len(overlap))
    if ("gi" in p or "gastro" in p) and be == "gi":
        return 0.88
    if any(x in p for x in ("head", "ceph")) and be == "headache":
        return 0.88
    return 0.0


def _assign_side_effects_to_alerts(alerts: list[dict], se_list: list[dict]) -> dict[int, dict]:
    """Greedy one-to-one match: alert index -> side-effect row from ML."""
    if not se_list or not alerts:
        return {}
    triples: list[tuple[float, int, int]] = []
    for i, al in enumerate(alerts):
        prob = (al.get("problem") or "").lower()
        for j, se in enumerate(se_list):
            triples.append((_match_problem_to_effect(prob, se.get("effect", "")), i, j))
    triples.sort(reverse=True, key=lambda x: x[0])
    assignments: dict[int, dict] = {}
    used_i: set[int] = set()
    used_j: set[int] = set()
    for sc, i, j in triples:
        if sc < 0.28:
            break
        if i in used_i or j in used_j:
            continue
        used_i.add(i)
        used_j.add(j)
        assignments[i] = se_list[j]
    return assignments


def _detailed_side_effect_cause(
    se: dict,
    ml_outputs: dict,
    profile: dict | None,
    drug: dict | None,
) -> str:
    """Rich, patient- and model-grounded explanation for a specific predicted side effect."""
    p = profile or {}
    pk = ml_outputs.get("pk_modifiers", {})
    renal_pct = float(pk.get("renal_clearance_mod", 1.0)) * 100
    hep_pct = float(pk.get("hepatic_clearance_mod", 1.0)) * 100
    dose_mg = float((drug or {}).get("dose_mg", 0) or 0)
    drug_name = (drug or {}).get("name", "the drug")
    drug_class = ml_outputs.get("drug_class", "this drug class")
    frequency = (drug or {}).get("frequency", "as prescribed")
    eff = se.get("effect", "adverse effect")
    prob = float(se.get("probability", 0.0))
    onset = float(se.get("onset_hours", 0.5))
    dur = float(se.get("duration_hours", 6.0))
    sev = se.get("severity", "mild")
    side_risk = ml_outputs.get("risk_breakdown", {}).get("side_effect_risk", 0)
    peaks = _max_organ_scores_across_timeline(ml_outputs)
    organ = _organ_for_side_effect(eff)
    oscore = peaks.get(organ, 0.0) if organ else (max(peaks.values()) if peaks else 0.0)
    age = p.get("age", "?")
    egfr = p.get("egfr", "unknown")
    alt = p.get("alt", "unknown")
    conds = ", ".join(p.get("conditions") or []) or "none listed"
    meds = ", ".join(m["name"] for m in p.get("medications", []) or []) or "none"

    intro = (
        f"For {drug_name} ({dose_mg:.0f} mg, {frequency}) in class “{drug_class}”, the ML scorer assigns “{eff}” about {prob:.0%} "
        f"(severity tier in model: {sev}; typical modeled onset ~{onset:.1f} h, duration ~{dur:.0f} h). "
        f"Side-effect strain in the composite risk breakdown is {side_risk}/100. "
        f"Patient inputs driving the scorer: age {age}y, eGFR {egfr}, ALT {alt}, conditions [{conds}], co-medications [{meds}]. "
        f"Renal clearance is modeled at ~{renal_pct:.0f}% and hepatic at ~{hep_pct:.0f}% of baseline—lower clearance raises effective exposure and can lift adverse-event probability vs a young patient with normal organ function."
    )

    bucket = _bucket_from_text(eff)
    if bucket == "gi":
        st = peaks.get("stomach", 0.0)
        return intro + (
            f" GI-type events are linked in this run to stomach-axis modeled stress (peak ~{st:.2f} on 0–1) plus oral route exposure to {drug_name}; "
            f"the class baseline for mucosal/GI irritation is scaled by dose factor vs typical and by hepatic/renal handling. "
            f"Polypharmacy and NSAID-like context (if any) would further increase modeled GI burden—your profile’s conditions and meds are part of that weighting."
        )
    if bucket == "headache":
        br = peaks.get("brain", 0.0)
        return intro + (
            f" Headache is modeled with CNS exposure (brain stress peak ~{br:.2f}) and class-appropriate vascular / central mechanisms for {drug_name}; "
            f"probability is dose-sensitive in the pipeline and can be amplified by dehydration, sleep debt, or interacting serotonergic/CNS drugs—check co-medications above. "
            f"Organ timeline stress is an explanatory correlate in MediTwin, not a diagnosis."
        )
    if bucket == "renal":
        kn = peaks.get("kidneys", 0.0)
        return intro + (
            f" Renal-type effects align with kidney-axis modeled load (~{kn:.2f}) and eGFR {egfr}; reduced clearance increases drug/metabolite exposure in the model."
        )
    return intro + (
        f" Mapped organ emphasis for this effect uses {organ or 'multi-organ'} stress (~{oscore:.2f} peak) alongside class baseline and patient modifiers above."
    )


def _probability_band(probability: float) -> str:
    p = float(probability or 0.0)
    if p >= 0.55:
        return "Elevated"
    if p >= 0.35:
        return "Moderate"
    if p >= 0.2:
        return "Low-Moderate"
    return "Low"


def _pattern_narrative_from_ml(
    se: dict | None,
    alert: dict,
    ml_outputs: dict,
    drug: dict | None,
) -> dict:
    """
    Structured narrative metadata (UI + LLM): pattern name, when to use, logic trigger, model output line.
    Grounded in peak organ scores and drug_class from this simulation run.
    """
    peaks = _max_organ_scores_across_timeline(ml_outputs)
    drug_class = str(ml_outputs.get("drug_class", "unknown_class"))
    drug_name = (drug or {}).get("name", "this compound")
    rb = ml_outputs.get("risk_breakdown", {}).get("interaction_risk", 0)
    rc = ml_outputs.get("risk_breakdown", {}).get("contraindication_risk", 0)

    problem = str(alert.get("problem") or "Adverse signal")
    pl = problem.lower()
    eff = (se.get("effect") if se else problem) or "Adverse effect"
    prob = float((se or {}).get("probability", 0.0))
    band = _probability_band(prob)
    model_output_label = (
        f"{eff} ({band})" if se else f"{problem} ({str(alert.get('severity') or 'MODERATE').upper()})"
    )

    stomach = peaks.get("stomach", 0.0)
    brain = peaks.get("brain", 0.0)
    liver = peaks.get("liver", 0.0)

    dc_low = drug_class.lower()
    is_opioid = "opioid" in dc_low or "opiate" in dc_low
    is_nsaid = "nsaid" in dc_low or "non-steroidal" in dc_low
    bucket = _bucket_from_text(eff)

    def _pack(pattern_label: str, pattern_example: str, use_when: str, logic_trigger: str) -> dict:
        return {
            "pattern_label": pattern_label,
            "pattern_example": pattern_example,
            "use_when": use_when,
            "logic_trigger": logic_trigger,
            "model_output_label": model_output_label,
        }

    if "interaction" in pl and "contraindication" not in pl:
        return _pack(
            "Pharmacokinetic / pharmacodynamic interaction load",
            drug_name,
            "Use when the ML interaction layer flags overlapping pathways and the interaction risk component is non-trivial for this profile.",
            f"Interaction_Risk≈{rb}/100 (scaled component) + Drug_Class: {drug_class} + flagged pair in ML outputs",
        )
    if "contraindication" in pl:
        return _pack(
            "Contraindication / safety boundary",
            drug_name,
            "Use when a contraindication row is present in the ML output for this patient–drug pairing.",
            f"Contraindication_Risk≈{rc}/100 (scaled component) + rule-engine condition match + Drug_Class: {drug_class}",
        )

    if bucket == "renal":
        kn = peaks.get("kidneys", 0.0)
        return _pack(
            "Renal handling / perfusion stress",
            drug_name,
            f"Use when kidney-axis modeled stress is elevated in this run (peak {kn:.2f} on 0–1) and eGFR/clearance modifiers apply.",
            f"Kidneys_Stress peak={kn:.2f} (0–1) + Drug_Class: {drug_class} + renal_clearance_mod from ML",
        )

    # Gastric / local GI (NSAID-like narratives)
    eff_l = eff.lower()
    gi_like = bucket == "gi" or stomach >= 0.38 or (
        is_nsaid and any(x in eff_l for x in ("gi", "gastro", "stomach", "dyspep", "nausea", "bleed", "irrit"))
    )
    if gi_like:
        ex = "Ibuprofen (NSAID class example)" if is_nsaid else drug_name
        return _pack(
            "Gastric irritation (mucosal / prostaglandin axis)",
            ex,
            f"Use when stomach-axis modeled stress is elevated in this run (peak {stomach:.2f} on 0–1).",
            f"Stomach_Stress peak={stomach:.2f} (pattern ≥0.6 when clinically styled) + Drug_Class: {drug_class}",
        )

    # CNS / chemoreceptor (opioid-class narratives)
    if is_opioid and (brain >= 0.45 or bucket == "cns" or "nausea" in eff.lower()):
        return _pack(
            "Chemoreceptor trigger (CTZ / area postrema)",
            drug_name,
            f"Use when brain/CNS modeled stress is elevated (peak {brain:.2f}) and central emetic pathways dominate in the class.",
            f"Brain_Stress peak={brain:.2f} (pattern ≥0.5) + Drug_Class: {drug_class}",
        )

    # Hepatic / persistence (“metabolic backup”)
    if liver >= 0.55 and liver >= stomach - 0.02:
        return _pack(
            "Metabolic backup (hepatic handling / persistence)",
            drug_name,
            f"Use when liver-axis modeled stress is high (peak {liver:.2f}) and gut-axis stress is also present (stomach peak {stomach:.2f})—typical of CYP/lingering exposure narratives.",
            f"Liver_Stress peak={liver:.2f} (pattern ≥0.7) OR Stomach_Stress peak={stomach:.2f} (gut-axis proxy) + Drug_Class: {drug_class}",
        )

    organ = _organ_for_side_effect(eff)
    oscore = peaks.get(organ, 0.0) if organ else (max(peaks.values()) if peaks else 0.0)
    oname = organ or "dominant_organ"
    return _pack(
        f"Organ-linked risk ({oname})",
        drug_name,
        f"Use when {oname} modeled stress is non-trivial (peak {oscore:.2f}) relative to this effect and drug class.",
        f"{oname.title()}_Stress peak={oscore:.2f} (0–1) + Drug_Class: {drug_class}",
    )


def _merge_alert_narrative_metadata(
    alert: dict,
    se: dict | None,
    ml_outputs: dict,
    drug: dict | None,
) -> dict:
    """Fill narrative keys when missing; prefer LLM-provided strings when present."""
    row = dict(alert)
    computed = _pattern_narrative_from_ml(se, row, ml_outputs, drug)
    for k, v in computed.items():
        cur = row.get(k)
        if cur is None or not str(cur).strip():
            row[k] = v
    return row


def _detailed_monitoring_for_side_effect(se: dict) -> str:
    eff = (se.get("effect") or "").lower()
    onset = float(se.get("onset_hours", 0.5))
    bucket = _bucket_from_text(eff)
    if bucket == "gi":
        return (
            f"Over the first {int(max(24, onset + 12))} h: log nausea/vomiting, epigastric pain, stool color (black/tarry), appetite; "
            f"note relation to each dose and food intake; maintain hydration. "
            f"Escalate for persistent vomiting, hematemesis, melena, or severe abdominal pain."
        )
    if bucket == "headache":
        return (
            "Record intensity 0–10, time from last dose, photophobia/phonophobia, neck stiffness, focal weakness or speech change. "
            "Seek urgent care for thunderclap onset, worst-ever headache, or new neuro deficits."
        )
    if bucket == "renal":
        return (
            "Track fluid balance, edema, urine output and color, weight, BP; align with eGFR trend if known. "
            "Escalate for oliguria, marked edema, or sharp creatinine rise."
        )
    if bucket == "cns":
        return (
            "Monitor sedation level, dizziness, falls risk (especially if elderly), and driving safety; note timing vs dose. "
            "Escalate for confusion, syncope, or respiratory depression when combined with other sedatives."
        )
    return (
        f"Track “{se.get('effect', 'this effect')}” severity, time course vs dosing, and hydration/vitals; "
        f"escalate if symptoms exceed expected modeled duration or worsen abruptly."
    )


def _apply_side_effect_detail_to_alerts(
    alerts: list[dict],
    ml_outputs: dict,
    profile: dict,
    drug: dict,
) -> list[dict]:
    """Replace generic LLM/fallback alert text with detailed ML-grounded copy when a side effect matches."""
    se_list = ml_outputs.get("predicted_side_effects", [])
    amap = _assign_side_effects_to_alerts(alerts, se_list) if se_list else {}
    out: list[dict] = []
    for i, a in enumerate(alerts):
        row = dict(a)
        se = amap.get(i)
        if se and se_list:
            row["cause"] = _detailed_side_effect_cause(se, ml_outputs, profile, drug)
            row["recommended_monitoring"] = _detailed_monitoring_for_side_effect(se)
        row = _merge_alert_narrative_metadata(row, se, ml_outputs, drug)
        out.append(row)
    return out


def _enrich_weak_alert_causes(
    alerts: list[dict],
    ml_outputs: dict,
    profile: dict,
    drug: dict,
) -> list[dict]:
    """Replace weak LLM causes with ML-grounded explanations tied to this simulation."""
    se_list = ml_outputs.get("predicted_side_effects", [])
    flags = ml_outputs.get("interaction_flags", [])
    contras = ml_outputs.get("contraindication_alerts", [])
    out = []
    for i, alert in enumerate(alerts):
        a = dict(alert)
        cause = str(a.get("cause") or "")
        if not _alert_cause_is_weak(cause):
            out.append(a)
            continue
        prob = str(a.get("problem") or "").lower()
        matched = False
        for se in se_list:
            en = (se.get("effect") or "").lower()
            if en and (en in prob or prob in en or any(w in prob for w in en.split() if len(w) > 4)):
                a["cause"] = _build_alert_cause_from_ml(
                    a.get("problem", ""),
                    ml_outputs,
                    profile,
                    drug,
                    side_effect=se,
                )
                matched = True
                break
        if not matched and flags:
            f0 = flags[0]
            da = (f0.get("drug_a") or "").lower()
            db = (f0.get("drug_b") or "").lower()
            if (
                "interaction" in prob
                or (da and da in prob)
                or (db and db in prob)
            ):
                a["cause"] = _build_alert_cause_from_ml(
                    a.get("problem", ""),
                    ml_outputs,
                    profile,
                    drug,
                    interaction=f0,
                )
                matched = True
        if not matched and contras and ("contraindication" in prob or "absolute" in prob or "relative" in prob):
            a["cause"] = _build_alert_cause_from_ml(
                a.get("problem", ""),
                ml_outputs,
                profile,
                drug,
                contraindication=contras[0],
            )
            matched = True
        if not matched and i < len(se_list):
            a["cause"] = _build_alert_cause_from_ml(
                a.get("problem", ""),
                ml_outputs,
                profile,
                drug,
                side_effect=se_list[i],
            )
        elif not matched:
            a["cause"] = _build_alert_cause_from_ml(
                a.get("problem", ""),
                ml_outputs,
                profile,
                drug,
            )
        out.append(a)
    return out


def build_enrichment_prompt(profile: dict, drug: dict, ml_outputs: dict) -> str:
    meds = ", ".join([m["name"] for m in profile.get("medications", [])]) or "None"
    conditions = ", ".join(profile.get("conditions", [])) or "None"

    return f"""You are MediTwin Clinical Intelligence Layer, a high-precision medical simulation interpreter. You have been given
the numerical output of a pharmacokinetic/pharmacodynamic ML simulation for a
specific patient and drug. Your job is to add plain-language clinical explanations
to the numeric data — you do NOT change any numbers, only add descriptive text.

PATIENT:
- {profile['age']}-year-old {profile['sex']}, {profile['weight_kg']}kg, BMI {profile['bmi']:.1f}
- Conditions: {conditions}
- Current medications: {meds}
- Kidney function (eGFR): {profile.get('egfr', 'unknown')} → renal clearance at {ml_outputs['pk_modifiers']['renal_clearance_mod']*100:.0f}% of normal
- Liver enzymes (ALT): {profile.get('alt', 'unknown')} → hepatic clearance at {ml_outputs['pk_modifiers']['hepatic_clearance_mod']*100:.0f}% of normal

DRUG: {drug['name']} {drug['dose_mg']}mg {drug.get('route','oral')}, {drug.get('frequency','as needed')}, {drug.get('duration_days',7)} days
Drug class: {ml_outputs['drug_class']}

ML-COMPUTED NUMERIC RESULTS (DO NOT CHANGE THESE VALUES):
- Risk score: {ml_outputs['risk_score']}/100 (SE: {ml_outputs['risk_breakdown']['side_effect_risk']}, Interactions: {ml_outputs['risk_breakdown']['interaction_risk']}, Contraindications: {ml_outputs['risk_breakdown']['contraindication_risk']})
- Peak time: {ml_outputs['peak_time_hours']}h, Half-life: {ml_outputs['half_life_hours']}h, Clearance: {ml_outputs['clearance_time_hours']}h

COMPUTED ORGAN EFFECTS (sample — key time points):
T+0.5h: {format_organ_scores(ml_outputs['timeline'][0])}
T+2h:   {format_organ_scores(ml_outputs['timeline'][2])}
T+6h:   {format_organ_scores(ml_outputs['timeline'][4])}

PREDICTED SIDE EFFECTS (ML-scored):
{format_side_effects(ml_outputs['predicted_side_effects'])}

INTERACTION FLAGS DETECTED:
{format_interactions(ml_outputs['interaction_flags'])}

CONTRAINDICATION ALERTS:
{format_contraindications(ml_outputs['contraindication_alerts'])}

YOUR TASK:
Return ONLY a valid JSON object with this exact structure.
Fill in every "description", "explanation", "clinical_effect", and "recommendation"
field with 1-2 sentences of patient-specific clinical reasoning.
Reference the patient's actual conditions and computed modifier values.
No hallucinations: only describe organ risk as CRITICAL/HIGH if corresponding effect_score > 0.6.
Deterministic alignment: effect_score >= 0.8 => "CRITICAL", 0.6-0.79 => "HIGH", 0.2-0.59 => "MILD", <0.2 => "NORMAL".
Dose guidance must be one of: DOSE_DOWN, DOSE_UP, MAINTAIN_DOSE.
Use DOSE_DOWN when risk_score >= 65 OR any organ effect_score >= 0.65 OR absolute contraindication exists.
Use DOSE_UP only when risk_score <= 20 and no interaction/contraindication alerts.
When suggesting dose changes, keep suggested_dose_mg within 50%-150% of current dose ({drug['dose_mg']}mg).
Do NOT change any numeric values — copy them exactly from the ML outputs above.
Do NOT add preamble or markdown. Output only parseable JSON.

CRITICAL — potential_alerts (POTENTIAL_PROBLEMS_ALERT in the UI):
- Provide 2-3 items only. Each "cause" MUST be 2-4 sentences explaining WHY this risk is plausible in THIS simulation (mechanistic: e.g. prostaglandin loss in gastric mucosa, CTZ stimulation, CYP bottleneck—match the organ/class pattern you choose).
- Each cause MUST explicitly tie together: (1) the drug name and dose, (2) at least one concrete ML number from the prompt (e.g. effect_score for a named organ, side-effect probability, risk_score or a risk_breakdown component, peak_time_hours), AND (3) at least one patient-specific factor (e.g. eGFR, age, a listed condition, a co-medication, or renal/hepatic clearance %).
- Narrative fields (pattern_label, use_when, logic_trigger, model_output_label) MUST read like simulation documentation: name the organ axis (stomach/brain/liver/kidneys), cite Drug_Class from the prompt, and use the REAL peak organ scores from COMPUTED ORGAN EFFECTS / timeline—not invented thresholds.
- pattern_example: optional exemplar in parentheses style (e.g. "Ibuprofen" for NSAID gastric narrative, or the actual drug name).
- Do NOT use vague filler such as "elevated for this patient" or "multiple factors" without naming the factors and numbers above.
- Severity must align with the cited ML signals (e.g. higher organ scores or probabilities => higher severity).

{{
  "summary": "2-3 sentence plain-language summary of what will happen to this patient",
  "doctor_note": "Single-sentence physician takeaway with concrete caution, monitoring, or dosing direction.",
  "dose_guidance": "DOSE_DOWN | DOSE_UP | MAINTAIN_DOSE",
  "dose_guidance_reason": "One short sentence explaining why this dose action is selected.",
  "suggested_dose_mg": {drug['dose_mg']},
  "potential_alerts": [
    {{
      "pattern_label": "Short pattern name (e.g. Gastric irritation (mucosal / prostaglandin axis))",
      "pattern_example": "Class exemplar or drug name, e.g. Ibuprofen or {drug['name']}",
      "use_when": "One sentence: when this narrative applies given which organ score is elevated in ML outputs",
      "logic_trigger": "One line: Organ_Stress peak=X.XX + Drug_Class: <class from prompt> (use actual numbers from ML)",
      "model_output_label": "Effect name (band): e.g. Nausea (Low-Moderate) — align with predicted side effect + probability",
      "problem": "Short title of a likely issue (e.g., Renal stress)",
      "cause": "2-4 sentences: drug+dose, at least one ML number (organ score, probability, or risk component), and patient factors (eGFR, conditions, co-meds)",
      "severity": "LOW | MODERATE | HIGH | CRITICAL",
      "recommended_monitoring": "Concrete monitoring with timing if relevant (e.g. peak hour, clearance window)"
    }}
  ],
  "clinical_bullets": {{
    "primary_risk": "One short bullet-style sentence based on highest score.",
    "timeline_insight": "One short bullet-style sentence identifying the peak-time insight.",
    "clinical_action": "One short non-prescriptive action sentence."
  }},
  "disclaimer": "MediTwin is an educational simulator and not a clinical decision tool.",
  "patient_specific_notes": "Why this patient's profile specifically changes the simulation",
  "risk_score_explanation": "Plain explanation of why the risk score is {ml_outputs['risk_score']}",
  "timeline": {json.dumps([{"time_label": tp["time_label"], "time_hours": tp["time_hours"], "plasma_level": tp["plasma_level"], "organ_effects": {organ: {"effect_score": data["effect_score"], "description": "ADD_DESCRIPTION"} for organ, data in tp["organ_effects"].items()}} for tp in ml_outputs["timeline"]])},
  "peak_time_hours": {ml_outputs['peak_time_hours']},
  "half_life_hours": {ml_outputs['half_life_hours']},
  "clearance_time_hours": {ml_outputs['clearance_time_hours']},
  "predicted_side_effects": {json.dumps([{"effect": se["effect"], "probability": se["probability"], "onset_hours": se["onset_hours"], "duration_hours": se["duration_hours"], "severity": se["severity"], "explanation": "ADD_EXPLANATION"} for se in ml_outputs["predicted_side_effects"]])},
  "interaction_flags": {json.dumps([{"drug_a": f["drug_a"], "drug_b": f["drug_b"], "mechanism": f["mechanism"], "severity": f["severity"], "cyp_pathway": f["cyp_pathway"], "clinical_effect": "ADD_CLINICAL_EFFECT", "recommendation": "ADD_RECOMMENDATION"} for f in ml_outputs["interaction_flags"]])},
  "contraindication_alerts": {json.dumps([{"type": c["type"], "condition": c["condition"], "reason": c["reason"], "recommendation": "ADD_RECOMMENDATION"} for c in ml_outputs["contraindication_alerts"]])},
  "risk_score": {ml_outputs['risk_score']},
  "risk_breakdown": {json.dumps(ml_outputs['risk_breakdown'])}
}}"""


def build_fallback_result(
    ml_outputs: dict,
    drug: dict | None = None,
    profile: dict | None = None,
) -> dict:
    """Return ML outputs with placeholder descriptions when Groq is unavailable."""
    prof = profile or {}
    timeline = []
    for tp in ml_outputs["timeline"]:
        organ_effects = {}
        for organ, data in tp["organ_effects"].items():
            organ_effects[organ] = {
                "effect_score": data["effect_score"],
                "description": f"Effect score {data['effect_score']} at {tp['time_label']}",
            }
            if data.get("driver_summary"):
                organ_effects[organ]["driver_summary"] = data["driver_summary"]
        timeline.append({
            "time_label": tp["time_label"],
            "time_hours": tp["time_hours"],
            "plasma_level": tp["plasma_level"],
            "organ_effects": organ_effects
        })

    side_effects = []
    for se in ml_outputs["predicted_side_effects"]:
        side_effects.append({**se, "explanation": f"Estimated probability: {se['probability']:.0%}"})

    interaction_flags = []
    for f in ml_outputs["interaction_flags"]:
        interaction_flags.append({
            **f,
            "clinical_effect": f["mechanism"],
            "recommendation": "Consult healthcare provider"
        })

    contra_alerts = []
    for c in ml_outputs["contraindication_alerts"]:
        contra_alerts.append({**c, "recommendation": "Consult healthcare provider before use"})

    current_dose = float((drug or {}).get("dose_mg", 0) or 0)
    max_organ = 0.0
    for tp in ml_outputs.get("timeline", []):
        for data in tp.get("organ_effects", {}).values():
            max_organ = max(max_organ, float(data.get("effect_score", 0.0)))

    if ml_outputs["risk_score"] >= 65 or max_organ >= 0.65 or any(
        c.get("type") == "absolute" for c in ml_outputs.get("contraindication_alerts", [])
    ):
        dose_guidance = "DOSE_DOWN"
        suggested_dose = round(max(1.0, current_dose * 0.75), 1) if current_dose > 0 else None
        dose_reason = "Model indicates elevated toxicity burden; conservative dose reduction is recommended."
    elif ml_outputs["risk_score"] <= 20 and not ml_outputs.get("interaction_flags") and not ml_outputs.get("contraindication_alerts"):
        dose_guidance = "DOSE_UP"
        suggested_dose = round(current_dose * 1.1, 1) if current_dose > 0 else None
        dose_reason = "Overall modeled risk is low with no alert flags; a cautious dose increase can be considered."
    else:
        dose_guidance = "MAINTAIN_DOSE"
        suggested_dose = round(current_dose, 1) if current_dose > 0 else None
        dose_reason = "Current simulated exposure-risk balance supports maintaining the selected dose."

    potential_alerts = []
    # Seed alerts from highest-probability side effects.
    for se in ml_outputs.get("predicted_side_effects", [])[:2]:
        prob = float(se.get("probability", 0.0))
        sev = "LOW"
        if prob >= 0.6:
            sev = "HIGH"
        elif prob >= 0.3:
            sev = "MODERATE"
        potential_alerts.append(
            {
                "problem": se.get("effect", "Adverse effect risk"),
                "cause": _detailed_side_effect_cause(se, ml_outputs, prof, drug),
                "severity": sev,
                "recommended_monitoring": _detailed_monitoring_for_side_effect(se),
            }
        )

    if ml_outputs.get("interaction_flags"):
        f = ml_outputs["interaction_flags"][0]
        potential_alerts.append(
            {
                "problem": "Drug interaction risk",
                "cause": _build_alert_cause_from_ml(
                    "Drug interaction risk",
                    ml_outputs,
                    prof,
                    drug,
                    interaction=f,
                ),
                "severity": "HIGH" if f.get("severity", "").lower() in {"severe", "high"} else "MODERATE",
                "recommended_monitoring": "Monitor vitals and adverse effects after each dose interval.",
            }
        )

    if ml_outputs.get("contraindication_alerts"):
        c = ml_outputs["contraindication_alerts"][0]
        potential_alerts.append(
            {
                "problem": f"Contraindication: {c.get('condition', 'condition').replace('_', ' ')}",
                "cause": _build_alert_cause_from_ml(
                    c.get("condition", "contraindication"),
                    ml_outputs,
                    prof,
                    drug,
                    contraindication=c,
                ),
                "severity": "CRITICAL" if c.get("type") == "absolute" else "HIGH",
                "recommended_monitoring": "Use conservative dosing and close organ-function monitoring.",
            }
        )

    potential_alerts = _apply_side_effect_detail_to_alerts(
        potential_alerts[:3],
        ml_outputs,
        prof,
        drug or {},
    )

    return {
        "summary": f"ML simulation completed. Risk score: {ml_outputs['risk_score']}/100. LLM enrichment unavailable — showing raw ML outputs.",
        "doctor_note": (
            f"Physician note: simulated risk {ml_outputs['risk_score']}/100; "
            f"renal clearance at {ml_outputs['pk_modifiers']['renal_clearance_mod']*100:.0f}% and hepatic clearance "
            f"at {ml_outputs['pk_modifiers']['hepatic_clearance_mod']*100:.0f}% of baseline — consider conservative dosing and close monitoring."
        ),
        "dose_guidance": dose_guidance,
        "dose_guidance_reason": dose_reason,
        "suggested_dose_mg": suggested_dose,
        "potential_alerts": potential_alerts,
        "clinical_bullets": {
            "primary_risk": "Primary Risk: Highest modeled organ burden is highlighted from the ML timeline.",
            "timeline_insight": f"Timeline Insight: Peak concentration is around {ml_outputs['peak_time_hours']}h in this simulation.",
            "clinical_action": "Clinical Action: Monitor hydration status, dizziness, and symptom progression."
        },
        "disclaimer": "MediTwin is an educational simulator and not a clinical decision tool.",
        "patient_specific_notes": "LLM enrichment unavailable. Numeric results are from the ML pipeline.",
        "risk_score_explanation": f"Composite risk score of {ml_outputs['risk_score']} based on side effect risk ({ml_outputs['risk_breakdown']['side_effect_risk']}), interaction risk ({ml_outputs['risk_breakdown']['interaction_risk']}), and contraindication risk ({ml_outputs['risk_breakdown']['contraindication_risk']}).",
        "timeline": timeline,
        "peak_time_hours": ml_outputs["peak_time_hours"],
        "half_life_hours": ml_outputs["half_life_hours"],
        "clearance_time_hours": ml_outputs["clearance_time_hours"],
        "predicted_side_effects": side_effects,
        "interaction_flags": interaction_flags,
        "contraindication_alerts": contra_alerts,
        "risk_score": ml_outputs["risk_score"],
        "risk_breakdown": ml_outputs["risk_breakdown"]
    }


async def enrich_with_groq(profile: dict, drug: dict, ml_outputs: dict, guardian_feedback: str = "") -> dict:
    """Call Groq LLaMA 3.3 70B to add clinical explanations to ML numeric outputs."""
    if not groq_client:
        print("Groq API key not configured — returning ML-only fallback")
        return build_fallback_result(ml_outputs, drug, profile)

    try:
        prompt = build_enrichment_prompt(profile, drug, ml_outputs)

        messages = [
            {
                "role": "system",
                "content": (
                    "You are a pharmacological simulation interpreter. "
                    "You receive ML-computed simulation data and add patient-specific "
                    "clinical explanations. You NEVER change numeric values. "
                    "For potential_alerts, every cause must explain why that risk follows "
                    "from the given dose, patient modifiers, and ML scores—no vague one-liners. "
                    "Include pattern_label, use_when, logic_trigger, and model_output_label as structured narrative metadata when present. "
                    "You ALWAYS respond with only valid JSON, no preamble, no markdown fences."
                )
            },
            {"role": "user", "content": prompt}
        ]
        if guardian_feedback:
            messages.append({"role": "user", "content": guardian_feedback})
        request_kwargs = {
            "model": "llama-3.3-70b-versatile",
            "messages": messages,
            "temperature": 0.3,
            "max_tokens": 4000,
        }
        try:
            # Some Groq SDK versions error on dict response_format with "unhashable type: 'dict'".
            response = groq_client.chat.completions.create(
                **request_kwargs,
                response_format={"type": "json_object"},
            )
        except TypeError as te:
            if "unhashable type" in str(te):
                response = groq_client.chat.completions.create(**request_kwargs)
            else:
                raise

        raw = response.choices[0].message.content
        cleaned = raw.replace("```json", "").replace("```", "").strip()
        enriched = json.loads(cleaned)

        # Ensure all ML timeline points are preserved even if LLM returns fewer
        ml_timeline = ml_outputs["timeline"]
        llm_timeline = enriched.get("timeline", [])
        if len(llm_timeline) < len(ml_timeline):
            llm_map = {tp.get("time_hours"): tp for tp in llm_timeline}
            merged = []
            for ml_tp in ml_timeline:
                llm_tp = llm_map.get(ml_tp["time_hours"])
                if llm_tp:
                    merged.append(llm_tp)
                else:
                    fallback_tp = dict(ml_tp)
                    for organ, data in fallback_tp.get("organ_effects", {}).items():
                        if not data.get("description"):
                            data["description"] = ""
                    merged.append(fallback_tp)
            enriched["timeline"] = merged

        merge_organ_driver_summaries_from_ml(enriched, ml_outputs)

        for key in ("risk_score", "peak_time_hours", "half_life_hours", "clearance_time_hours", "risk_breakdown"):
            if key in ml_outputs and key not in enriched:
                enriched[key] = ml_outputs[key]

        if not enriched.get("doctor_note"):
            enriched["doctor_note"] = (
                f"Physician note: simulated risk {ml_outputs['risk_score']}/100; "
                f"renal clearance at {ml_outputs['pk_modifiers']['renal_clearance_mod']*100:.0f}% and hepatic clearance "
                f"at {ml_outputs['pk_modifiers']['hepatic_clearance_mod']*100:.0f}% of baseline — consider conservative dosing and close monitoring."
            )
        if not enriched.get("clinical_bullets"):
            enriched["clinical_bullets"] = {
                "primary_risk": "Primary Risk: Highest modeled organ burden is highlighted from the ML timeline.",
                "timeline_insight": f"Timeline Insight: Peak concentration is around {ml_outputs['peak_time_hours']}h in this simulation.",
                "clinical_action": "Clinical Action: Monitor hydration status, dizziness, and symptom progression."
            }
        if not enriched.get("disclaimer"):
            enriched["disclaimer"] = "MediTwin is an educational simulator and not a clinical decision tool."
        if enriched.get("dose_guidance") not in {"DOSE_DOWN", "DOSE_UP", "MAINTAIN_DOSE"}:
            enriched["dose_guidance"] = "MAINTAIN_DOSE"
        if enriched.get("suggested_dose_mg") is None:
            enriched["suggested_dose_mg"] = float(drug.get("dose_mg", 0) or 0)
        if not enriched.get("dose_guidance_reason"):
            enriched["dose_guidance_reason"] = "Dose guidance defaults to maintain unless risk thresholds indicate adjustment."
        if not isinstance(enriched.get("potential_alerts"), list):
            enriched["potential_alerts"] = []
        normalized_alerts = []
        _alert_narr_keys = (
            "pattern_label",
            "pattern_example",
            "use_when",
            "logic_trigger",
            "model_output_label",
        )
        for alert in enriched.get("potential_alerts", [])[:3]:
            if not isinstance(alert, dict):
                continue
            row = {
                "problem": str(alert.get("problem") or "Potential issue"),
                "cause": str(alert.get("cause") or "Multiple patient and drug factors may contribute."),
                "severity": str(alert.get("severity") or "MODERATE").upper(),
                "recommended_monitoring": str(
                    alert.get("recommended_monitoring") or "Monitor symptoms and organ-function trajectory."
                ),
            }
            for nk in _alert_narr_keys:
                v = alert.get(nk)
                if v is not None and str(v).strip():
                    row[nk] = str(v).strip()
            normalized_alerts.append(row)
        enriched["potential_alerts"] = _apply_side_effect_detail_to_alerts(
            _enrich_weak_alert_causes(
                normalized_alerts, ml_outputs, profile, drug
            ),
            ml_outputs,
            profile,
            drug,
        )

        return enriched

    except Exception as e:
        print(f"Groq enrichment failed: {e}")
        return build_fallback_result(ml_outputs, drug, profile)
