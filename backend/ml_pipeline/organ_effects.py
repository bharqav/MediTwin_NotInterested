import math


FREQ_TO_INTERVAL = {
    "once_daily": 24,
    "twice_daily": 12,
    "three_times_daily": 8,
    "four_times_daily": 6,
    "every_six_hours": 6,
    "every_eight_hours": 8,
    "every_twelve_hours": 12,
    "once_weekly": 168,
    "as_needed": None,
}

TIME_POINTS_72H = [
    ("Baseline", 0),
    ("T+2h", 2),
    ("T+6h", 6),
    ("T+12h", 12),
    ("Day 1 (24h)", 24),
    ("Day 2 (48h)", 48),
    ("Day 3 (72h)", 72),
]


def _build_organ_driver_summary(
    organ: str,
    base: float,
    clamped_score: float,
    cumulative_factor: float,
    dose_normalized: float,
    time_hours: float,
    time_label: str,
    profile: dict,
    renal_mod: float,
    hepatic_mod: float,
    drug_class_data: dict,
    patient_mod: float,
    age_amp: float,
    age: int,
) -> str:
    """
    Human-readable, deterministic explanation of why this organ score is what it is.
    Stress rises with dose_normalized, multi-dose cumulative exposure (later time points
    sum more doses up to a cap), and patient-specific renal/hepatic modifiers.
    """
    egfr = profile.get("egfr", "unknown")
    alt = profile.get("alt", "unknown")
    conds = ", ".join(profile.get("conditions") or []) or "none listed"
    rs = drug_class_data.get("renal_sensitivity", 0.0)
    hs = drug_class_data.get("hepatic_sensitivity", 0.0)

    parts = [
        f"Relative organ stress {clamped_score:.0%} on the model's 0–1 scale (not a clinical probability of harm).",
        (
            f"Mechanistic drivers in this run: class baseline weight {base:.3f} for {organ}; "
            f"dose factor ×{dose_normalized:.2f} vs typical; multi-dose exposure index {cumulative_factor:.2f} "
            f"(adds with each scheduled dose, capped at 3.0) at {time_label} (~{time_hours:.0f}h simulated); "
            f"organ-specific patient modifier ×{patient_mod:.2f}"
        ),
    ]
    if age_amp > 1.0 and organ in ("kidneys", "heart", "brain"):
        parts[1] += f"; age ≥65 amplification ×{age_amp:.1f} for this organ."

    parts.append(
        f"Profile context used: age {age}y; eGFR {egfr}; ALT {alt}; conditions: {conds}. "
        f"Renal clearance modeled at {renal_mod:.2f} and hepatic at {hepatic_mod:.2f} of baseline "
        f"(class renal sensitivity {rs:.2f}, hepatic sensitivity {hs:.2f})."
    )

    if organ == "kidneys":
        parts.append(
            "Kidney-heavy pathway: lower renal_mod increases modeled drug exposure in this parametric model, "
            "which raises the kidney stress score when combined with dose and cumulative dosing time."
        )
    elif organ == "liver":
        parts.append(
            "Liver-heavy pathway: lower hepatic_mod increases modeled hepatic handling burden for this drug class, "
            "raising liver stress in proportion to baseline weight and exposure index."
        )
    else:
        parts.append(
            f"The {organ} score uses this class's organ baseline, the same exposure index, and global modifiers; "
            "later timeline hours usually show equal or higher index when more doses have been administered."
        )

    return " ".join(parts)


def _single_dose_time_factor(time_since_dose, onset, peak, typical_clearance):
    """Effect of a single dose at a given time after that dose."""
    if time_since_dose < 0 or time_since_dose < onset:
        return 0.0
    if time_since_dose <= peak:
        return (time_since_dose - onset) / (peak - onset) if peak > onset else 1.0
    decay_rate = 0.693 / (typical_clearance / 3)
    return max(0.0, math.exp(-decay_rate * (time_since_dose - peak)))


def _get_dose_times(frequency: str, duration_hours: float):
    """Generate all dose administration times over the duration."""
    interval = FREQ_TO_INTERVAL.get(frequency)
    if interval is None:
        return [0]
    times = []
    t = 0
    while t <= duration_hours:
        times.append(t)
        t += interval
    return times


def compute_organ_effects(
    drug_class_data: dict,
    pk_modifiers: dict,
    dose_normalized: float,
    profile: dict,
    frequency: str = "three_times_daily",
    duration_days: int = 3
) -> list:
    """Produce 7 time-point snapshots over 72 hours with multi-dose superposition."""
    renal_mod = pk_modifiers["renal_clearance_mod"]
    hepatic_mod = pk_modifiers["hepatic_clearance_mod"]
    age = profile["age"]
    typical_clearance = drug_class_data["typical_clearance_hours"]

    duration_hours = duration_days * 24
    dose_times = _get_dose_times(frequency, duration_hours)

    timeline = []

    for time_label, time_hours in TIME_POINTS_72H:
        organ_effects = {}

        for organ, baseline in drug_class_data["organ_baseline_effects"].items():
            base = baseline["base_score"]
            onset = baseline["onset_hours"]
            peak = baseline["peak_hours"]

            cumulative_factor = 0.0
            for dose_t in dose_times:
                if dose_t > time_hours:
                    break
                elapsed = time_hours - dose_t
                factor = _single_dose_time_factor(elapsed, onset, peak, typical_clearance)
                cumulative_factor += factor

            cumulative_factor = min(cumulative_factor, 3.0)

            if organ == "kidneys":
                patient_mod = 1.0 + (1.0 - renal_mod) * drug_class_data["renal_sensitivity"]
            elif organ == "liver":
                patient_mod = 1.0 + (1.0 - hepatic_mod) * drug_class_data["hepatic_sensitivity"]
            else:
                patient_mod = 1.0

            age_amp = 1.2 if age >= 65 and organ in ["kidneys", "heart", "brain"] else 1.0
            raw_score = base * cumulative_factor * patient_mod * age_amp * dose_normalized
            clamped_score = round(min(1.0, max(0.0, raw_score)), 3)

            driver_summary = _build_organ_driver_summary(
                organ,
                base,
                clamped_score,
                cumulative_factor,
                dose_normalized,
                time_hours,
                time_label,
                profile,
                renal_mod,
                hepatic_mod,
                drug_class_data,
                patient_mod,
                age_amp,
                age,
            )

            organ_effects[organ] = {
                "effect_score": clamped_score,
                "description": "",
                "driver_summary": driver_summary,
            }

        peak_t = drug_class_data["typical_peak_hours"]
        if time_hours == 0:
            plasma_level = "baseline"
        elif time_hours <= peak_t * 1.2:
            plasma_level = "peak"
        elif time_hours <= 12:
            plasma_level = "active"
        elif time_hours <= 24:
            plasma_level = "steady_state"
        elif time_hours <= 48:
            plasma_level = "accumulated"
        else:
            plasma_level = "day_3"

        timeline.append({
            "time_label": time_label,
            "time_hours": time_hours,
            "plasma_level": plasma_level,
            "organ_effects": organ_effects
        })

    return timeline
