'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useSimulationStore } from '@/store/simulationStore';
import type { MedicationEntry } from '@/types/simulation';

const CONDITIONS = [
  'type_2_diabetes', 'type_1_diabetes', 'hypertension', 'heart_failure',
  'atrial_fibrillation', 'ckd_stage_3', 'ckd_stage_4', 'ckd_stage_5',
  'liver_disease', 'copd', 'asthma', 'epilepsy', 'depression', 'anxiety',
  'hypothyroidism', 'osteoarthritis', 'rheumatoid_arthritis', 'gi_bleed',
];

const CONDITION_LABELS: Record<string, string> = {
  type_2_diabetes: 'Type 2 Diabetes', type_1_diabetes: 'Type 1 Diabetes',
  hypertension: 'Hypertension', heart_failure: 'Heart Failure',
  atrial_fibrillation: 'Atrial Fibrillation', ckd_stage_3: 'CKD Stage 3',
  ckd_stage_4: 'CKD Stage 4', ckd_stage_5: 'CKD Stage 5',
  liver_disease: 'Liver Disease', copd: 'COPD', asthma: 'Asthma',
  epilepsy: 'Epilepsy', depression: 'Depression', anxiety: 'Anxiety',
  hypothyroidism: 'Hypothyroidism', osteoarthritis: 'Osteoarthritis',
  rheumatoid_arthritis: 'Rheumatoid Arthritis', gi_bleed: 'GI Bleed History',
};

export default function OnboardingPage() {
  const router = useRouter();
  const setPatientProfile = useSimulationStore(s => s.setPatientProfile);
  const [step, setStep] = useState(1);

  // Step 1
  const [age, setAge] = useState(45);
  const [sex, setSex] = useState('female');
  const [weightKg, setWeightKg] = useState(68);
  const [heightCm, setHeightCm] = useState(165);

  // Step 2
  const [conditions, setConditions] = useState<string[]>([]);

  // Step 3
  const [medications, setMedications] = useState<MedicationEntry[]>([]);
  const [medName, setMedName] = useState('');
  const [medDose, setMedDose] = useState(500);
  const [medFreq, setMedFreq] = useState('once_daily');
  const [allergies, setAllergies] = useState<string[]>([]);
  const [allergyInput, setAllergyInput] = useState('');

  // Step 4
  const [egfr, setEgfr] = useState<number | null>(null);
  const [alt, setAlt] = useState<number | null>(null);
  const [ast, setAst] = useState<number | null>(null);
  const [egfrUnknown, setEgfrUnknown] = useState(true);
  const [altUnknown, setAltUnknown] = useState(true);
  const [astUnknown, setAstUnknown] = useState(true);

  const bmi = weightKg / ((heightCm / 100) ** 2);

  const toggleCondition = (c: string) => {
    if (conditions.includes(c)) {
      setConditions(conditions.filter(x => x !== c));
    } else if (conditions.length < 6) {
      setConditions([...conditions, c]);
    }
  };

  const addMedication = () => {
    if (medName.trim() && medications.length < 5) {
      setMedications([...medications, { name: medName.trim(), dose_mg: medDose, frequency: medFreq }]);
      setMedName('');
      setMedDose(500);
    }
  };

  const addAllergy = () => {
    if (allergyInput.trim() && allergies.length < 5) {
      setAllergies([...allergies, allergyInput.trim()]);
      setAllergyInput('');
    }
  };

  const handleSubmit = () => {
    setPatientProfile({
      age, sex, weight_kg: weightKg, height_cm: heightCm, bmi: parseFloat(bmi.toFixed(1)),
      conditions, medications, allergies,
      egfr: egfrUnknown ? null : egfr, alt: altUnknown ? null : alt, ast: astUnknown ? null : ast,
      smoking: false, alcohol: 'occasional',
    });
    router.push('/patient/drug-input');
  };

  const inputClass = "w-full bg-[var(--bg-card)] border border-[var(--border-dim)] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[var(--accent-cyan)] transition-colors";
  const labelClass = "block text-sm text-[var(--text-secondary)] mb-2";

  return (
    <main className="min-h-screen flex flex-col items-center p-6 pt-12">
      {/* Progress bar */}
      <div className="w-full max-w-xl mb-10">
        <div className="flex items-center justify-between mb-3">
          {[1, 2, 3, 4].map(s => (
            <div key={s} className="flex items-center">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${s <= step ? 'bg-[var(--accent-cyan)] text-black' : 'bg-[var(--bg-card)] text-[var(--text-muted)] border border-[var(--border-dim)]'}`}>
                {s < step ? '✓' : s}
              </div>
              {s < 4 && <div className={`w-16 md:w-24 h-0.5 mx-2 transition-colors ${s < step ? 'bg-[var(--accent-cyan)]' : 'bg-[var(--border-dim)]'}`} />}
            </div>
          ))}
        </div>
        <p className="text-sm text-[var(--text-muted)] text-center">
          {['Basic Info', 'Conditions', 'Medications', 'Lab Values'][step - 1]}
        </p>
      </div>

      {/* Step content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          className="glass-card p-8 w-full max-w-xl"
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -40 }}
          transition={{ duration: 0.3 }}
        >
          {step === 1 && (
            <div className="space-y-5">
              <h2 className="text-2xl font-semibold mb-2">Tell us about yourself</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Age</label>
                  <input type="number" value={age} onChange={e => setAge(+e.target.value)} className={inputClass} min={1} max={120} />
                </div>
                <div>
                  <label className={labelClass}>Sex</label>
                  <select value={sex} onChange={e => setSex(e.target.value)} className={inputClass}>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Weight (kg)</label>
                  <input type="number" value={weightKg} onChange={e => setWeightKg(+e.target.value)} className={inputClass} min={20} max={250} />
                </div>
                <div>
                  <label className={labelClass}>Height (cm)</label>
                  <input type="number" value={heightCm} onChange={e => setHeightCm(+e.target.value)} className={inputClass} min={100} max={230} />
                </div>
              </div>
              <div className="p-4 rounded-xl bg-[var(--bg-card)] border border-[var(--border-dim)]">
                <span className="text-[var(--text-secondary)] text-sm">BMI: </span>
                <span className="text-xl font-semibold text-[var(--accent-cyan)]">{bmi.toFixed(1)}</span>
                <span className="text-[var(--text-muted)] text-sm ml-2">
                  {bmi < 18.5 ? 'Underweight' : bmi < 25 ? 'Normal' : bmi < 30 ? 'Overweight' : 'Obese'}
                </span>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 className="text-2xl font-semibold mb-2">Existing conditions</h2>
              <p className="text-sm text-[var(--text-muted)] mb-5">Select up to 6 conditions ({conditions.length}/6)</p>
              <div className="grid grid-cols-2 gap-3">
                {CONDITIONS.map(c => (
                  <button
                    key={c}
                    onClick={() => toggleCondition(c)}
                    className={`px-4 py-2.5 rounded-xl text-sm text-left transition-all ${conditions.includes(c) ? 'bg-[var(--accent-cyan)]/20 border border-[var(--accent-cyan)]/50 text-[var(--accent-cyan)]' : 'bg-[var(--bg-card)] border border-[var(--border-dim)] text-[var(--text-secondary)] hover:border-[var(--text-muted)]'}`}
                  >
                    {CONDITION_LABELS[c]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <h2 className="text-2xl font-semibold mb-2">Current medications</h2>
              <div className="space-y-3">
                <input placeholder="Medication name (e.g. Metformin)" value={medName} onChange={e => setMedName(e.target.value)} className={inputClass} />
                <div className="grid grid-cols-2 gap-3">
                  <input type="number" placeholder="Dose (mg)" value={medDose} onChange={e => setMedDose(+e.target.value)} className={inputClass} />
                  <select value={medFreq} onChange={e => setMedFreq(e.target.value)} className={inputClass}>
                    <option value="once_daily">Once daily</option>
                    <option value="twice_daily">Twice daily</option>
                    <option value="three_times_daily">3x daily</option>
                    <option value="as_needed">As needed</option>
                  </select>
                </div>
                <button onClick={addMedication} className="w-full py-2.5 rounded-xl border border-dashed border-[var(--accent-cyan)]/40 text-[var(--accent-cyan)] text-sm hover:bg-[var(--accent-cyan)]/10 transition-colors">
                  + Add medication ({medications.length}/5)
                </button>
              </div>
              {medications.map((m, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-dim)]">
                  <span className="text-sm">{m.name} — {m.dose_mg}mg, {m.frequency.replace(/_/g, ' ')}</span>
                  <button onClick={() => setMedications(medications.filter((_, j) => j !== i))} className="text-[var(--accent-red)] text-sm">✕</button>
                </div>
              ))}
              <div>
                <label className={labelClass}>Known allergies</label>
                <div className="flex gap-2">
                  <input placeholder="e.g. Aspirin" value={allergyInput} onChange={e => setAllergyInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') addAllergy(); }} className={inputClass} />
                  <button onClick={addAllergy} className="px-4 py-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border-dim)] text-sm hover:border-[var(--accent-cyan)] transition-colors">Add</button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {allergies.map((a, i) => (
                    <span key={i} className="px-3 py-1 rounded-full bg-[var(--accent-red)]/20 text-[var(--accent-red)] text-xs flex items-center gap-1">
                      {a} <button onClick={() => setAllergies(allergies.filter((_, j) => j !== i))}>✕</button>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-semibold mb-2">Lab values <span className="text-sm text-[var(--text-muted)] font-normal">(optional)</span></h2>
              {[{ label: 'eGFR (mL/min/1.73m²)', value: egfr, setter: setEgfr, unknown: egfrUnknown, setUnknown: setEgfrUnknown, help: 'Measures kidney function. Normal: >90. Found on blood test results.' },
                { label: 'ALT (U/L)', value: alt, setter: setAlt, unknown: altUnknown, setUnknown: setAltUnknown, help: 'Liver enzyme level. Normal: 7-40. Found on liver function test.' },
                { label: 'AST (U/L)', value: ast, setter: setAst, unknown: astUnknown, setUnknown: setAstUnknown, help: 'Liver enzyme level. Normal: 8-33. Found on liver function test.' },
              ].map((field, i) => (
                <div key={i}>
                  <label className={labelClass}>{field.label}</label>
                  <div className="flex items-center gap-3">
                    <input type="number" value={field.value ?? ''} onChange={e => { field.setter(+e.target.value); field.setUnknown(false); }}
                      className={`${inputClass} ${field.unknown ? 'opacity-40' : ''}`} disabled={field.unknown} placeholder={field.unknown ? 'Unknown' : ''} />
                    <label className="flex items-center gap-2 text-sm text-[var(--text-muted)] whitespace-nowrap cursor-pointer">
                      <input type="checkbox" checked={field.unknown} onChange={e => { field.setUnknown(e.target.checked); if (e.target.checked) field.setter(null); }}
                        className="w-4 h-4 rounded accent-[var(--accent-cyan)]" />
                      I don&apos;t know
                    </label>
                  </div>
                  <p className="text-xs text-[var(--text-muted)] mt-1">{field.help}</p>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Navigation */}
      <div className="flex gap-4 mt-8 w-full max-w-xl">
        {step > 1 && (
          <button onClick={() => setStep(step - 1)} className="px-6 py-3 rounded-xl border border-[var(--border-dim)] text-[var(--text-secondary)] hover:bg-[var(--bg-card)] transition-colors">
            Back
          </button>
        )}
        <div className="flex-1" />
        {step < 4 ? (
          <button onClick={() => setStep(step + 1)} className="px-8 py-3 rounded-xl bg-[var(--accent-cyan)] text-black font-semibold hover:brightness-110 transition-all">
            Continue
          </button>
        ) : (
          <motion.button
            onClick={handleSubmit}
            className="px-8 py-3 rounded-xl bg-gradient-to-r from-[var(--accent-cyan-dim)] to-[var(--accent-cyan)] text-[var(--bg-app)] font-semibold shadow-[var(--shadow-panel)] ring-1 ring-white/10"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            🧬 Build My Twin
          </motion.button>
        )}
      </div>
    </main>
  );
}
