export interface PatientProfile {
  age: number;
  sex: string;
  weight_kg: number;
  height_cm: number;
  bmi: number;
  conditions: string[];
  medications: MedicationEntry[];
  allergies: string[];
  egfr: number | null;
  alt: number | null;
  ast: number | null;
  smoking: boolean;
  alcohol: string;
}

export interface MedicationEntry {
  name: string;
  dose_mg: number;
  frequency: string;
}

export interface DrugInput {
  name: string;
  dose_mg: number;
  route: string;
  frequency: string;
  duration_days: number;
}

export interface DrugEntry {
  name: string;
  brand_names: string[];
  drug_class_id: string;
  typical_dose_mg: number;
  route_options: string[];
  mechanism: string;
  typical_half_life_hours: number;
  typical_peak_hours: number;
}

export interface OrganEffect {
  effect_score: number;
  description: string;
  /** ML-computed causal explanation (dose, time, patient modifiers); not clinical certainty */
  driver_summary?: string;
}

export interface TimelinePoint {
  time_label: string;
  time_hours: number;
  plasma_level: string;
  organ_effects: Record<string, OrganEffect>;
}

export interface SideEffect {
  effect: string;
  probability: number;
  onset_hours: number;
  duration_hours: number;
  severity: string;
  explanation: string;
}

export interface InteractionFlag {
  drug_a: string;
  drug_b: string;
  mechanism: string;
  severity: string;
  cyp_pathway: string | null;
  clinical_effect: string;
  recommendation: string;
}

export interface ContraindicationAlert {
  type: string;
  condition: string;
  reason: string;
  recommendation: string;
}

export interface RiskBreakdown {
  side_effect_risk: number;
  interaction_risk: number;
  contraindication_risk: number;
}

export interface PotentialAlert {
  /** Short pattern name, e.g. "Gastric irritation (mucosal / prostaglandin axis)" */
  pattern_label?: string;
  /** Class exemplar or drug, e.g. Ibuprofen */
  pattern_example?: string;
  /** When this narrative applies given organ scores in this run */
  use_when?: string;
  /** One line: organ stress + drug class (ML-grounded) */
  logic_trigger?: string;
  /** e.g. "Nausea (Low-Moderate)" */
  model_output_label?: string;
  problem: string;
  cause: string;
  severity: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL' | string;
  recommended_monitoring: string;
}

export interface SimulationResult {
  summary: string;
  doctor_note?: string;
  dose_guidance?: 'DOSE_DOWN' | 'DOSE_UP' | 'MAINTAIN_DOSE';
  dose_guidance_reason?: string;
  suggested_dose_mg?: number;
  potential_alerts?: PotentialAlert[];
  clinical_bullets?: {
    primary_risk?: string;
    timeline_insight?: string;
    clinical_action?: string;
  };
  disclaimer?: string;
  patient_specific_notes: string;
  risk_score_explanation: string;
  timeline: TimelinePoint[];
  peak_time_hours: number;
  half_life_hours: number;
  clearance_time_hours: number;
  predicted_side_effects: SideEffect[];
  interaction_flags: InteractionFlag[];
  contraindication_alerts: ContraindicationAlert[];
  risk_score: number;
  risk_breakdown: RiskBreakdown;
}

export interface PopulationConfig {
  n: number;
  age_min: number;
  age_max: number;
  sex_distribution: string;
  kidney_function: string;
  diabetic_pct: number;
  hypertension_pct: number;
}

export interface PopulationResult {
  total_patients: number;
  mean_risk_score: number;
  high_risk_count: number;
  risk_distribution: number[];
  side_effect_incidence: Record<string, number>;
  most_prevalent_side_effect: string;
  subgroup_analysis: {
    renal_impaired_count: number;
    renal_impaired_mean_risk: number;
  };
  individual_results: Array<{
    patient_id: number;
    profile: PatientProfile;
    risk_score: number;
    risk_breakdown: RiskBreakdown;
    top_side_effect: string;
    top_se_probability: number;
    interaction_count: number;
    contraindication_count: number;
  }>;
}
