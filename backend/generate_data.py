"""Generate drug_classes.json and drugs.json data files for MediTwin."""
import json, os

ORGAN_KEYS = ["stomach", "kidneys", "liver", "bloodstream", "heart", "lungs", "brain", "skin"]

def obe(scores, onsets, peaks):
    return {o: {"base_score": s, "onset_hours": on, "peak_hours": p}
            for o, s, on, p in zip(ORGAN_KEYS, scores, onsets, peaks)}

def se(effect, bp, ra=1.0, ha=1.0):
    return {"effect": effect, "base_probability": bp, "renal_amplifier": ra, "hepatic_amplifier": ha}

def inter(cls, mech, sev, cyp=None):
    return {"interacts_with_class": cls, "mechanism": mech, "severity": sev, "cyp_pathway": cyp}

def contra(cond, typ, reason):
    return {"condition": cond, "type": typ, "reason": reason}

drug_classes = [
    {
        "class_id": "nsaid", "class_name": "NSAID (Non-Steroidal Anti-Inflammatory Drug)",
        "member_drugs": ["Ibuprofen", "Naproxen", "Diclofenac", "Celecoxib", "Aspirin"],
        "primary_metabolism": "CYP2C9", "primary_excretion": "renal",
        "renal_sensitivity": 0.85, "hepatic_sensitivity": 0.60,
        "organ_baseline_effects": obe([0.55,0.45,0.20,0.65,0.15,0.05,0.10,0.05],[0.5,1,1.5,0.5,2,3,1,3],[1.5,3,4,1.5,6,6,2,6]),
        "known_side_effects": [se("GI irritation",0.65,1.1),se("GI bleed (rare)",0.05,1.2,1.3),se("Renal stress",0.30,2.8),se("Fluid retention",0.20,1.8),se("Hypertension elevation",0.18,1.5),se("Platelet inhibition",0.70),se("Hepatotoxicity (rare)",0.03,1.0,3.5)],
        "known_interactions": [inter("ace_inhibitor","NSAIDs reduce prostaglandin-mediated renal vasodilation, counteracting ACE inhibitor renoprotective effects","moderate"),inter("anticoagulant_warfarin","NSAIDs inhibit platelet aggregation + may displace warfarin from protein binding (CYP2C9)","severe","CYP2C9"),inter("diuretic_loop","NSAIDs reduce prostaglandin synthesis, blunting diuretic efficacy","mild")],
        "contraindications": [contra("ckd_stage_3_plus","relative","Risk of acute kidney injury"),contra("ckd_stage_4_plus","absolute","Severe risk of AKI in advanced CKD"),contra("active_gi_bleed","absolute","NSAIDs damage gastric mucosa"),contra("pregnancy_trimester3","absolute","Risk of premature ductus arteriosus closure"),contra("aspirin_allergy","absolute","Cross-reactivity in aspirin-exacerbated respiratory disease")],
        "typical_half_life_hours": 2.1, "typical_peak_hours": 1.5, "typical_clearance_hours": 12
    },
    {
        "class_id": "ace_inhibitor", "class_name": "ACE Inhibitor",
        "member_drugs": ["Lisinopril", "Enalapril", "Ramipril", "Captopril", "Perindopril"],
        "primary_metabolism": "hepatic", "primary_excretion": "renal",
        "renal_sensitivity": 0.90, "hepatic_sensitivity": 0.40,
        "organ_baseline_effects": obe([0.10,0.35,0.15,0.40,0.30,0.15,0.10,0.05],[1,1,2,0.5,1,2,2,4],[3,4,6,2,4,6,6,8]),
        "known_side_effects": [se("Dry cough",0.15),se("Hyperkalemia",0.10,2.5),se("Hypotension",0.20),se("Angioedema (rare)",0.02),se("Dizziness",0.18),se("Renal impairment",0.08,2.2)],
        "known_interactions": [inter("nsaid","NSAIDs counteract ACE inhibitor renoprotective effects","moderate"),inter("diuretic_loop","Enhanced hypotensive effect, risk of first-dose hypotension","mild"),inter("antidiabetic_sulfonylurea","ACE inhibitors may enhance hypoglycemic effect","mild")],
        "contraindications": [contra("pregnancy_trimester3","absolute","Fetotoxic — causes renal dysgenesis"),contra("ckd_stage_4_plus","relative","Monitor potassium closely")],
        "typical_half_life_hours": 12, "typical_peak_hours": 6, "typical_clearance_hours": 24
    },
    {
        "class_id": "anticoagulant_warfarin", "class_name": "Anticoagulant (Warfarin)",
        "member_drugs": ["Warfarin"],
        "primary_metabolism": "CYP2C9", "primary_excretion": "hepatic",
        "renal_sensitivity": 0.30, "hepatic_sensitivity": 0.95,
        "organ_baseline_effects": obe([0.15,0.10,0.40,0.80,0.10,0.05,0.15,0.20],[1,2,1,0.5,2,3,2,2],[4,8,6,3,8,12,6,6]),
        "known_side_effects": [se("Bleeding risk",0.45,1.2,2.5),se("Bruising",0.55),se("Hemorrhage (rare)",0.04,1.5,3.0),se("Skin necrosis (rare)",0.01),se("Hair loss",0.05),se("GI upset",0.15)],
        "known_interactions": [inter("nsaid","Additive bleeding risk from platelet inhibition + protein displacement","severe","CYP2C9"),inter("antibiotic_macrolide","Macrolides inhibit CYP3A4, increasing warfarin levels","severe","CYP3A4"),inter("statin","Some statins compete for CYP metabolism, increasing warfarin effect","moderate","CYP3A4"),inter("antibiotic_fluoroquinolone","Fluoroquinolones may enhance anticoagulant effect","moderate")],
        "contraindications": [contra("active_gi_bleed","absolute","Warfarin dramatically increases bleed severity"),contra("liver_disease","relative","Impaired synthesis of clotting factors")],
        "typical_half_life_hours": 40, "typical_peak_hours": 4, "typical_clearance_hours": 96
    },
    {
        "class_id": "antibiotic_macrolide", "class_name": "Macrolide Antibiotic",
        "member_drugs": ["Azithromycin", "Clarithromycin", "Erythromycin"],
        "primary_metabolism": "CYP3A4", "primary_excretion": "hepatic",
        "renal_sensitivity": 0.35, "hepatic_sensitivity": 0.80,
        "organ_baseline_effects": obe([0.40,0.15,0.35,0.50,0.20,0.25,0.05,0.10],[0.5,2,1,0.5,1,1,3,3],[2,6,4,2,4,3,8,8]),
        "known_side_effects": [se("GI disturbance",0.55),se("QT prolongation",0.08,1.0,1.5),se("Hepatotoxicity",0.06,1.0,2.8),se("Nausea",0.40),se("Diarrhea",0.35),se("Abdominal pain",0.25)],
        "known_interactions": [inter("anticoagulant_warfarin","CYP3A4 inhibition increases warfarin levels significantly","severe","CYP3A4"),inter("statin","CYP3A4 inhibition increases statin levels, rhabdomyolysis risk","severe","CYP3A4"),inter("benzodiazepine","CYP3A4 inhibition increases benzodiazepine sedation","moderate","CYP3A4")],
        "contraindications": [contra("liver_disease","relative","Risk of cholestatic hepatitis")],
        "typical_half_life_hours": 68, "typical_peak_hours": 2.5, "typical_clearance_hours": 72
    },
    {
        "class_id": "antibiotic_fluoroquinolone", "class_name": "Fluoroquinolone Antibiotic",
        "member_drugs": ["Ciprofloxacin", "Levofloxacin", "Moxifloxacin"],
        "primary_metabolism": "CYP1A2", "primary_excretion": "renal",
        "renal_sensitivity": 0.75, "hepatic_sensitivity": 0.45,
        "organ_baseline_effects": obe([0.30,0.30,0.20,0.55,0.15,0.20,0.15,0.15],[0.5,1,1.5,0.5,2,1,1,2],[2,4,5,2,6,4,4,6]),
        "known_side_effects": [se("Tendinopathy",0.08),se("GI upset",0.35),se("QT prolongation",0.06),se("CNS effects",0.12),se("Photosensitivity",0.10),se("Nausea",0.30)],
        "known_interactions": [inter("anticoagulant_warfarin","May enhance anticoagulant effect","moderate"),inter("nsaid","Increased CNS stimulation and seizure risk","moderate"),inter("biguanide_metformin","Altered glucose metabolism","mild")],
        "contraindications": [contra("pregnancy_trimester3","absolute","Risk of cartilage damage in fetus")],
        "typical_half_life_hours": 4, "typical_peak_hours": 1.5, "typical_clearance_hours": 18
    },
    {
        "class_id": "antibiotic_penicillin", "class_name": "Penicillin Antibiotic",
        "member_drugs": ["Amoxicillin", "Ampicillin", "Penicillin V", "Amoxicillin-Clavulanate"],
        "primary_metabolism": "minimal", "primary_excretion": "renal",
        "renal_sensitivity": 0.70, "hepatic_sensitivity": 0.20,
        "organ_baseline_effects": obe([0.25,0.20,0.10,0.45,0.05,0.10,0.05,0.15],[0.5,1,2,0.5,3,2,3,2],[1.5,3,5,1.5,8,5,8,5]),
        "known_side_effects": [se("Diarrhea",0.25),se("Nausea",0.15),se("Rash",0.10),se("Allergic reaction",0.08),se("Anaphylaxis (rare)",0.01),se("C. diff colitis",0.03)],
        "known_interactions": [inter("anticoagulant_warfarin","May enhance anticoagulant effect by altering gut flora vitamin K","mild")],
        "contraindications": [contra("aspirin_allergy","relative","Cross-sensitivity possible in beta-lactam allergy")],
        "typical_half_life_hours": 1.5, "typical_peak_hours": 1.5, "typical_clearance_hours": 8
    },
    {
        "class_id": "beta_blocker", "class_name": "Beta Blocker",
        "member_drugs": ["Metoprolol", "Atenolol", "Propranolol", "Bisoprolol", "Carvedilol"],
        "primary_metabolism": "CYP2D6", "primary_excretion": "hepatic",
        "renal_sensitivity": 0.40, "hepatic_sensitivity": 0.75,
        "organ_baseline_effects": obe([0.05,0.10,0.20,0.50,0.55,0.15,0.20,0.05],[1,2,1,0.5,0.5,1,1,3],[4,6,4,2,3,4,3,8]),
        "known_side_effects": [se("Bradycardia",0.25),se("Fatigue",0.30),se("Hypotension",0.20),se("Cold extremities",0.15),se("Depression",0.08),se("Bronchospasm",0.05)],
        "known_interactions": [inter("calcium_channel_blocker","Additive cardiac depression — risk of severe bradycardia","moderate"),inter("biguanide_metformin","May mask hypoglycemia symptoms","mild"),inter("ssri","CYP2D6 inhibition by some SSRIs increases beta-blocker levels","moderate","CYP2D6")],
        "contraindications": [contra("asthma","relative","Risk of bronchospasm"),contra("heart_failure","relative","May worsen acute decompensated HF")],
        "typical_half_life_hours": 5, "typical_peak_hours": 2, "typical_clearance_hours": 16
    },
    {
        "class_id": "calcium_channel_blocker", "class_name": "Calcium Channel Blocker",
        "member_drugs": ["Amlodipine", "Nifedipine", "Diltiazem", "Verapamil"],
        "primary_metabolism": "CYP3A4", "primary_excretion": "hepatic",
        "renal_sensitivity": 0.30, "hepatic_sensitivity": 0.80,
        "organ_baseline_effects": obe([0.05,0.10,0.25,0.55,0.50,0.10,0.15,0.10],[1,2,1,0.5,0.5,2,1,2],[6,8,6,3,4,8,4,8]),
        "known_side_effects": [se("Peripheral edema",0.25),se("Headache",0.20),se("Flushing",0.18),se("Dizziness",0.15),se("Constipation",0.12),se("Bradycardia",0.08)],
        "known_interactions": [inter("beta_blocker","Additive cardiac depression","moderate"),inter("statin","CYP3A4 competition increases statin levels","mild","CYP3A4"),inter("antibiotic_macrolide","CYP3A4 competition increases CCB levels","moderate","CYP3A4")],
        "contraindications": [contra("heart_failure","relative","Negative inotropic effect may worsen HF")],
        "typical_half_life_hours": 35, "typical_peak_hours": 8, "typical_clearance_hours": 72
    },
    {
        "class_id": "diuretic_loop", "class_name": "Loop Diuretic",
        "member_drugs": ["Furosemide", "Bumetanide", "Torsemide"],
        "primary_metabolism": "minimal", "primary_excretion": "renal",
        "renal_sensitivity": 0.90, "hepatic_sensitivity": 0.25,
        "organ_baseline_effects": obe([0.10,0.60,0.10,0.45,0.25,0.10,0.10,0.05],[0.5,0.5,2,0.5,1,2,2,4],[1,2,6,1.5,4,6,6,8]),
        "known_side_effects": [se("Electrolyte imbalance",0.45,1.8),se("Dehydration",0.30,1.5),se("Hypokalemia",0.40,1.3),se("Ototoxicity",0.03),se("Hypotension",0.25),se("Muscle cramps",0.20)],
        "known_interactions": [inter("ace_inhibitor","Enhanced hypotension, especially first dose","mild"),inter("nsaid","NSAIDs blunt diuretic efficacy","mild"),inter("anticoagulant_warfarin","Dehydration may concentrate warfarin","mild")],
        "contraindications": [contra("ckd_stage_4_plus","relative","May be needed but requires careful monitoring")],
        "typical_half_life_hours": 2, "typical_peak_hours": 1, "typical_clearance_hours": 8
    },
    {
        "class_id": "diuretic_thiazide", "class_name": "Thiazide Diuretic",
        "member_drugs": ["Hydrochlorothiazide", "Chlorthalidone", "Indapamide"],
        "primary_metabolism": "minimal", "primary_excretion": "renal",
        "renal_sensitivity": 0.80, "hepatic_sensitivity": 0.20,
        "organ_baseline_effects": obe([0.10,0.50,0.10,0.40,0.20,0.05,0.10,0.10],[1,1,2,0.5,1.5,3,2,3],[3,4,6,2,6,8,6,8]),
        "known_side_effects": [se("Hyponatremia",0.20,1.5),se("Hypokalemia",0.30,1.3),se("Hyperuricemia",0.15),se("Glucose elevation",0.12),se("Photosensitivity",0.08),se("Dizziness",0.18)],
        "known_interactions": [inter("nsaid","NSAIDs reduce diuretic efficacy","mild"),inter("ace_inhibitor","Enhanced hypotension","mild"),inter("biguanide_metformin","May worsen glucose control","mild")],
        "contraindications": [contra("ckd_stage_4_plus","relative","Reduced efficacy with low GFR")],
        "typical_half_life_hours": 10, "typical_peak_hours": 4, "typical_clearance_hours": 24
    },
    {
        "class_id": "statin", "class_name": "Statin (HMG-CoA Reductase Inhibitor)",
        "member_drugs": ["Atorvastatin", "Rosuvastatin", "Simvastatin", "Pravastatin", "Lovastatin"],
        "primary_metabolism": "CYP3A4", "primary_excretion": "hepatic",
        "renal_sensitivity": 0.25, "hepatic_sensitivity": 0.90,
        "organ_baseline_effects": obe([0.10,0.10,0.40,0.35,0.15,0.05,0.05,0.05],[2,3,1,1,3,4,4,4],[6,8,4,3,8,12,12,12]),
        "known_side_effects": [se("Myalgia",0.15),se("Rhabdomyolysis (rare)",0.01,1.5,2.0),se("Hepatotoxicity",0.05,1.0,3.0),se("GI upset",0.12),se("Headache",0.08),se("Elevated liver enzymes",0.08,1.0,2.5)],
        "known_interactions": [inter("antibiotic_macrolide","CYP3A4 inhibition dramatically increases statin levels","severe","CYP3A4"),inter("calcium_channel_blocker","CYP3A4 competition increases statin exposure","mild","CYP3A4"),inter("anticoagulant_warfarin","CYP competition may increase anticoagulant effect","moderate","CYP3A4")],
        "contraindications": [contra("liver_disease","absolute","Active liver disease is absolute contraindication"),contra("pregnancy_trimester3","absolute","Teratogenic risk")],
        "typical_half_life_hours": 14, "typical_peak_hours": 2, "typical_clearance_hours": 36
    },
    {
        "class_id": "biguanide_metformin", "class_name": "Biguanide (Metformin)",
        "member_drugs": ["Metformin"],
        "primary_metabolism": "none", "primary_excretion": "renal",
        "renal_sensitivity": 0.95, "hepatic_sensitivity": 0.15,
        "organ_baseline_effects": obe([0.35,0.30,0.15,0.40,0.10,0.05,0.05,0.05],[0.5,1,2,0.5,2,3,3,4],[2.5,4,6,2.5,6,8,8,8]),
        "known_side_effects": [se("GI upset",0.50),se("Diarrhea",0.35),se("Lactic acidosis (rare)",0.01,4.0),se("Nausea",0.30),se("B12 deficiency",0.06),se("Metallic taste",0.10)],
        "known_interactions": [inter("nsaid","NSAIDs may reduce renal function, increasing metformin accumulation","moderate"),inter("ace_inhibitor","ACE inhibitors may enhance hypoglycemic effect","mild"),inter("diuretic_loop","Dehydration increases lactic acidosis risk","moderate")],
        "contraindications": [contra("ckd_stage_4_plus","absolute","Lactic acidosis risk with eGFR <30"),contra("liver_disease","relative","Impaired lactate clearance")],
        "typical_half_life_hours": 5, "typical_peak_hours": 2.5, "typical_clearance_hours": 18
    },
    {
        "class_id": "ssri", "class_name": "SSRI (Selective Serotonin Reuptake Inhibitor)",
        "member_drugs": ["Sertraline", "Fluoxetine", "Escitalopram", "Paroxetine", "Citalopram"],
        "primary_metabolism": "CYP2D6", "primary_excretion": "hepatic",
        "renal_sensitivity": 0.25, "hepatic_sensitivity": 0.80,
        "organ_baseline_effects": obe([0.20,0.10,0.25,0.40,0.15,0.05,0.55,0.10],[1,3,2,1,2,4,1,3],[6,8,6,4,8,12,4,8]),
        "known_side_effects": [se("Nausea",0.30),se("Sexual dysfunction",0.25),se("Insomnia",0.18),se("Weight gain",0.15),se("Serotonin syndrome (rare)",0.02),se("GI upset",0.22),se("Headache",0.15)],
        "known_interactions": [inter("opioid","Risk of serotonin syndrome with tramadol","severe"),inter("nsaid","Increased GI bleeding risk","moderate"),inter("anticoagulant_warfarin","SSRIs impair platelet function, additive bleeding risk","moderate"),inter("beta_blocker","CYP2D6 inhibition increases beta-blocker levels","moderate","CYP2D6")],
        "contraindications": [],
        "typical_half_life_hours": 26, "typical_peak_hours": 6, "typical_clearance_hours": 72
    },
    {
        "class_id": "benzodiazepine", "class_name": "Benzodiazepine",
        "member_drugs": ["Diazepam", "Lorazepam", "Alprazolam", "Clonazepam", "Midazolam"],
        "primary_metabolism": "CYP3A4", "primary_excretion": "hepatic",
        "renal_sensitivity": 0.20, "hepatic_sensitivity": 0.90,
        "organ_baseline_effects": obe([0.05,0.05,0.20,0.45,0.10,0.10,0.65,0.05],[0.5,3,1,0.5,2,1,0.5,4],[1.5,8,4,2,6,3,1.5,8]),
        "known_side_effects": [se("Sedation",0.60),se("Cognitive impairment",0.30),se("Respiratory depression",0.08),se("Dependence",0.20),se("Falls risk",0.15),se("Paradoxical agitation",0.05)],
        "known_interactions": [inter("opioid","Additive CNS and respiratory depression — potentially fatal","severe"),inter("antibiotic_macrolide","CYP3A4 inhibition increases benzodiazepine levels","moderate","CYP3A4"),inter("ssri","Additive CNS depression","mild")],
        "contraindications": [contra("liver_disease","relative","Prolonged sedation due to impaired metabolism")],
        "typical_half_life_hours": 30, "typical_peak_hours": 1.5, "typical_clearance_hours": 72
    },
    {
        "class_id": "opioid", "class_name": "Opioid Analgesic",
        "member_drugs": ["Morphine", "Oxycodone", "Codeine", "Tramadol", "Fentanyl", "Hydrocodone"],
        "primary_metabolism": "CYP3A4", "primary_excretion": "hepatic",
        "renal_sensitivity": 0.60, "hepatic_sensitivity": 0.90,
        "organ_baseline_effects": obe([0.25,0.20,0.25,0.55,0.15,0.20,0.70,0.10],[0.25,1,1,0.25,1,0.5,0.25,2],[1,4,4,1,4,2,1,6]),
        "known_side_effects": [se("Constipation",0.60),se("Nausea",0.35),se("Respiratory depression",0.10,1.5,2.0),se("Sedation",0.45),se("Dependence/tolerance",0.25),se("Pruritus",0.15)],
        "known_interactions": [inter("benzodiazepine","Additive CNS/respiratory depression — FDA black box warning","severe"),inter("ssri","Serotonin syndrome risk especially with tramadol","severe"),inter("anticoagulant_warfarin","Some opioids may enhance anticoagulant effect","mild")],
        "contraindications": [contra("liver_disease","relative","Impaired metabolism prolongs effect"),contra("ckd_stage_4_plus","relative","Active metabolites accumulate")],
        "typical_half_life_hours": 4, "typical_peak_hours": 1, "typical_clearance_hours": 16
    },
    {
        "class_id": "proton_pump_inhibitor", "class_name": "Proton Pump Inhibitor",
        "member_drugs": ["Omeprazole", "Pantoprazole", "Esomeprazole", "Lansoprazole", "Rabeprazole"],
        "primary_metabolism": "CYP2C19", "primary_excretion": "hepatic",
        "renal_sensitivity": 0.20, "hepatic_sensitivity": 0.65,
        "organ_baseline_effects": obe([0.55,0.10,0.20,0.30,0.05,0.05,0.05,0.05],[0.5,3,2,1,4,4,4,4],[2,8,6,3,12,12,12,12]),
        "known_side_effects": [se("Headache",0.10),se("GI effects",0.12),se("B12 deficiency",0.05),se("Magnesium depletion",0.04),se("C. diff risk",0.03),se("Bone fracture risk",0.02)],
        "known_interactions": [inter("anticoagulant_warfarin","CYP2C19 inhibition may alter warfarin metabolism","mild","CYP2C19"),inter("biguanide_metformin","May increase metformin absorption","mild")],
        "contraindications": [],
        "typical_half_life_hours": 1.5, "typical_peak_hours": 2, "typical_clearance_hours": 8
    },
    {
        "class_id": "antidiabetic_sulfonylurea", "class_name": "Sulfonylurea Antidiabetic",
        "member_drugs": ["Glipizide", "Glyburide", "Glimepiride"],
        "primary_metabolism": "CYP2C9", "primary_excretion": "renal",
        "renal_sensitivity": 0.80, "hepatic_sensitivity": 0.60,
        "organ_baseline_effects": obe([0.15,0.30,0.20,0.45,0.10,0.05,0.10,0.05],[0.5,1,1.5,0.5,2,3,1,4],[2,4,5,2,6,8,4,8]),
        "known_side_effects": [se("Hypoglycemia",0.30,2.0),se("Weight gain",0.25),se("GI upset",0.15),se("Skin rash",0.05),se("Hepatotoxicity (rare)",0.02,1.0,2.5)],
        "known_interactions": [inter("nsaid","NSAIDs may potentiate hypoglycemic effect via CYP2C9","moderate","CYP2C9"),inter("ace_inhibitor","Enhanced hypoglycemic effect","mild"),inter("antibiotic_fluoroquinolone","Altered glucose metabolism","moderate")],
        "contraindications": [contra("ckd_stage_4_plus","relative","Prolonged hypoglycemia risk"),contra("liver_disease","relative","Impaired drug clearance")],
        "typical_half_life_hours": 5, "typical_peak_hours": 2, "typical_clearance_hours": 16
    },
    {
        "class_id": "corticosteroid", "class_name": "Corticosteroid",
        "member_drugs": ["Prednisone", "Prednisolone", "Dexamethasone", "Hydrocortisone", "Methylprednisolone"],
        "primary_metabolism": "CYP3A4", "primary_excretion": "hepatic",
        "renal_sensitivity": 0.30, "hepatic_sensitivity": 0.70,
        "organ_baseline_effects": obe([0.30,0.15,0.25,0.55,0.15,0.20,0.25,0.20],[0.5,2,1,0.5,2,1,1,1],[2,6,4,2,6,3,4,4]),
        "known_side_effects": [se("Hyperglycemia",0.35),se("Weight gain",0.30),se("Insomnia",0.25),se("Mood changes",0.20),se("Osteoporosis",0.08),se("Immunosuppression",0.40),se("Adrenal suppression",0.15)],
        "known_interactions": [inter("nsaid","Additive GI toxicity risk","moderate"),inter("antidiabetic_sulfonylurea","Corticosteroids antagonize blood glucose control","moderate"),inter("anticoagulant_warfarin","Variable effect on anticoagulation","mild")],
        "contraindications": [contra("active_gi_bleed","relative","Impairs mucosal healing")],
        "typical_half_life_hours": 3.5, "typical_peak_hours": 2, "typical_clearance_hours": 18
    },
    {
        "class_id": "arb", "class_name": "Angiotensin II Receptor Blocker (ARB)",
        "member_drugs": ["Losartan", "Valsartan", "Irbesartan", "Telmisartan", "Candesartan", "Olmesartan"],
        "primary_metabolism": "CYP2C9", "primary_excretion": "renal",
        "renal_sensitivity": 0.85, "hepatic_sensitivity": 0.45,
        "organ_baseline_effects": obe([0.05,0.30,0.15,0.40,0.25,0.10,0.10,0.05],[1,1,2,0.5,1,2,2,4],[4,6,6,2,4,8,6,8]),
        "known_side_effects": [se("Hyperkalemia",0.10,2.3),se("Dizziness",0.15),se("Hypotension",0.12),se("Renal impairment",0.06,2.0),se("Headache",0.10),se("Fatigue",0.08)],
        "known_interactions": [inter("nsaid","NSAIDs reduce ARB efficacy and increase renal risk","moderate"),inter("diuretic_loop","Enhanced hypotension","mild"),inter("ace_inhibitor","Dual RAAS blockade — hyperkalemia and renal risk","severe")],
        "contraindications": [contra("pregnancy_trimester3","absolute","Fetotoxic"),contra("ckd_stage_4_plus","relative","Monitor potassium and renal function closely")],
        "typical_half_life_hours": 9, "typical_peak_hours": 3, "typical_clearance_hours": 24
    },
    {
        "class_id": "anticoagulant_doac", "class_name": "Direct Oral Anticoagulant (DOAC)",
        "member_drugs": ["Apixaban", "Rivaroxaban", "Dabigatran", "Edoxaban"],
        "primary_metabolism": "CYP3A4", "primary_excretion": "renal",
        "renal_sensitivity": 0.85, "hepatic_sensitivity": 0.50,
        "organ_baseline_effects": obe([0.10,0.25,0.20,0.70,0.10,0.05,0.10,0.10],[0.5,1,1.5,0.5,2,3,2,3],[3,4,5,2,6,8,6,8]),
        "known_side_effects": [se("Bleeding",0.30,2.0),se("GI bleed",0.08,1.5),se("Bruising",0.25),se("Anemia",0.05,1.3),se("Nausea",0.12),se("Dyspepsia",0.10)],
        "known_interactions": [inter("nsaid","Additive bleeding risk","severe"),inter("antibiotic_macrolide","CYP3A4 inhibition increases DOAC levels","moderate","CYP3A4"),inter("antidiabetic_sulfonylurea","Minor CYP interaction","mild")],
        "contraindications": [contra("ckd_stage_4_plus","relative","Dose adjustment required, contraindicated in severe CKD"),contra("active_gi_bleed","absolute","Uncontrolled bleeding")],
        "typical_half_life_hours": 12, "typical_peak_hours": 3, "typical_clearance_hours": 30
    }
]

# Generate drugs.json
drugs = []
drug_entries = [
    ("Ibuprofen",["Advil","Motrin"],"nsaid",400,"oral",2.1,1.5),
    ("Naproxen",["Aleve"],"nsaid",500,"oral",14,2),
    ("Diclofenac",["Voltaren"],"nsaid",50,"oral",2,1),
    ("Celecoxib",["Celebrex"],"nsaid",200,"oral",11,3),
    ("Aspirin",["Bayer"],"nsaid",325,"oral",4,1),
    ("Lisinopril",["Zestril","Prinivil"],"ace_inhibitor",10,"oral",12,6),
    ("Enalapril",["Vasotec"],"ace_inhibitor",10,"oral",11,4),
    ("Ramipril",["Altace"],"ace_inhibitor",5,"oral",13,3),
    ("Captopril",["Capoten"],"ace_inhibitor",25,"oral",2,1),
    ("Perindopril",["Aceon"],"ace_inhibitor",4,"oral",17,3),
    ("Warfarin",["Coumadin"],"anticoagulant_warfarin",5,"oral",40,4),
    ("Azithromycin",["Zithromax","Z-Pack"],"antibiotic_macrolide",500,"oral",68,2.5),
    ("Clarithromycin",["Biaxin"],"antibiotic_macrolide",500,"oral",5,2),
    ("Erythromycin",["Ery-Tab"],"antibiotic_macrolide",500,"oral",1.5,2),
    ("Ciprofloxacin",["Cipro"],"antibiotic_fluoroquinolone",500,"oral",4,1.5),
    ("Levofloxacin",["Levaquin"],"antibiotic_fluoroquinolone",500,"oral",7,1.5),
    ("Moxifloxacin",["Avelox"],"antibiotic_fluoroquinolone",400,"oral",12,2),
    ("Amoxicillin",["Amoxil"],"antibiotic_penicillin",500,"oral",1.5,1.5),
    ("Ampicillin",["Principen"],"antibiotic_penicillin",500,"oral",1,1),
    ("Amoxicillin-Clavulanate",["Augmentin"],"antibiotic_penicillin",875,"oral",1.5,1.5),
    ("Metoprolol",["Lopressor","Toprol-XL"],"beta_blocker",50,"oral",5,2),
    ("Atenolol",["Tenormin"],"beta_blocker",50,"oral",7,3),
    ("Propranolol",["Inderal"],"beta_blocker",40,"oral",4,1.5),
    ("Bisoprolol",["Zebeta"],"beta_blocker",5,"oral",11,2),
    ("Carvedilol",["Coreg"],"beta_blocker",12.5,"oral",7,1.5),
    ("Amlodipine",["Norvasc"],"calcium_channel_blocker",5,"oral",35,8),
    ("Nifedipine",["Procardia"],"calcium_channel_blocker",30,"oral",2,1),
    ("Diltiazem",["Cardizem"],"calcium_channel_blocker",120,"oral",4,3),
    ("Verapamil",["Calan"],"calcium_channel_blocker",120,"oral",6,2),
    ("Furosemide",["Lasix"],"diuretic_loop",40,"oral",2,1),
    ("Bumetanide",["Bumex"],"diuretic_loop",1,"oral",1.5,1),
    ("Torsemide",["Demadex"],"diuretic_loop",20,"oral",3.5,1),
    ("Hydrochlorothiazide",["Microzide"],"diuretic_thiazide",25,"oral",10,4),
    ("Chlorthalidone",["Thalitone"],"diuretic_thiazide",25,"oral",45,6),
    ("Indapamide",["Lozol"],"diuretic_thiazide",2.5,"oral",14,2),
    ("Atorvastatin",["Lipitor"],"statin",20,"oral",14,2),
    ("Rosuvastatin",["Crestor"],"statin",10,"oral",19,5),
    ("Simvastatin",["Zocor"],"statin",20,"oral",3,2),
    ("Pravastatin",["Pravachol"],"statin",40,"oral",2,1.5),
    ("Lovastatin",["Mevacor"],"statin",20,"oral",2,2),
    ("Metformin",["Glucophage"],"biguanide_metformin",500,"oral",5,2.5),
    ("Sertraline",["Zoloft"],"ssri",50,"oral",26,6),
    ("Fluoxetine",["Prozac"],"ssri",20,"oral",48,6),
    ("Escitalopram",["Lexapro"],"ssri",10,"oral",27,5),
    ("Paroxetine",["Paxil"],"ssri",20,"oral",21,5),
    ("Citalopram",["Celexa"],"ssri",20,"oral",35,4),
    ("Diazepam",["Valium"],"benzodiazepine",5,"oral",43,1.5),
    ("Lorazepam",["Ativan"],"benzodiazepine",1,"oral",12,2),
    ("Alprazolam",["Xanax"],"benzodiazepine",0.5,"oral",11,1.5),
    ("Clonazepam",["Klonopin"],"benzodiazepine",0.5,"oral",30,3),
    ("Morphine",["MS Contin"],"opioid",15,"oral",4,1),
    ("Oxycodone",["OxyContin"],"opioid",10,"oral",4,1),
    ("Codeine",["Tylenol-3"],"opioid",30,"oral",3,1),
    ("Tramadol",["Ultram"],"opioid",50,"oral",6,2),
    ("Omeprazole",["Prilosec"],"proton_pump_inhibitor",20,"oral",1.5,2),
    ("Pantoprazole",["Protonix"],"proton_pump_inhibitor",40,"oral",1,2.5),
    ("Esomeprazole",["Nexium"],"proton_pump_inhibitor",20,"oral",1.5,1.5),
    ("Lansoprazole",["Prevacid"],"proton_pump_inhibitor",30,"oral",1.5,1.7),
    ("Glipizide",["Glucotrol"],"antidiabetic_sulfonylurea",5,"oral",4,2),
    ("Glyburide",["DiaBeta"],"antidiabetic_sulfonylurea",5,"oral",10,4),
    ("Glimepiride",["Amaryl"],"antidiabetic_sulfonylurea",2,"oral",5,3),
    ("Prednisone",["Deltasone"],"corticosteroid",10,"oral",3.5,2),
    ("Dexamethasone",["Decadron"],"corticosteroid",4,"oral",36,2),
    ("Hydrocortisone",["Cortef"],"corticosteroid",20,"oral",1.5,1),
    ("Methylprednisolone",["Medrol"],"corticosteroid",4,"oral",3,2),
    ("Losartan",["Cozaar"],"arb",50,"oral",6,3),
    ("Valsartan",["Diovan"],"arb",80,"oral",9,3),
    ("Irbesartan",["Avapro"],"arb",150,"oral",12,2),
    ("Telmisartan",["Micardis"],"arb",40,"oral",24,1),
    ("Apixaban",["Eliquis"],"anticoagulant_doac",5,"oral",12,3),
    ("Rivaroxaban",["Xarelto"],"anticoagulant_doac",20,"oral",9,3),
    ("Dabigatran",["Pradaxa"],"anticoagulant_doac",150,"oral",13,2),
]

for name, brands, cls, dose, route, hl, pk in drug_entries:
    drugs.append({
        "name": name,
        "brand_names": brands,
        "drug_class_id": cls,
        "typical_dose_mg": dose,
        "route_options": [route] if route == "oral" else [route, "oral"],
        "mechanism": next((dc["class_name"] for dc in drug_classes if dc["class_id"] == cls), cls),
        "typical_half_life_hours": hl,
        "typical_peak_hours": pk
    })

os.makedirs("data", exist_ok=True)
with open("data/drug_classes.json", "w") as f:
    json.dump(drug_classes, f, indent=2)
with open("data/drugs.json", "w") as f:
    json.dump(drugs, f, indent=2)

print(f"Generated {len(drug_classes)} drug classes and {len(drugs)} drugs")
