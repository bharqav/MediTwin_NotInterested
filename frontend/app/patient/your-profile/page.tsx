'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { PatientProfile, MedicationEntry } from '@/types/simulation';
import { DRUG_POOL } from '@/lib/drugPool';
import {
  setStoredYourProfile,
  getStoredYourProfile,
  parseConditions,
  parseAllergies,
  MEDICATION_FREQUENCIES,
  type StoredYourProfile,
} from '@/lib/yourProfileStorage';

function bmiFromMetric(weightKg: number, heightCm: number): number {
  if (!heightCm || !weightKg) return 0;
  const h = heightCm / 100;
  return Math.round((weightKg / (h * h)) * 10) / 10;
}

export default function YourProfilePage() {
  const router = useRouter();
  const [age, setAge] = useState('32');
  const [sex, setSex] = useState<'male' | 'female' | 'other'>('male');
  const [weightKg, setWeightKg] = useState('72');
  const [heightCm, setHeightCm] = useState('175');
  const [egfr, setEgfr] = useState('');
  const [alt, setAlt] = useState('');
  const [ast, setAst] = useState('');
  const [conditionsRaw, setConditionsRaw] = useState('');
  const [allergiesRaw, setAllergiesRaw] = useState('');
  const [smoking, setSmoking] = useState(false);
  const [alcohol, setAlcohol] = useState('occasional');
  const [medicalHistory, setMedicalHistory] = useState('');
  const [chemicalInfluences, setChemicalInfluences] = useState('');
  const [medications, setMedications] = useState<MedicationEntry[]>([]);
  const [preferredDrugName, setPreferredDrugName] = useState(DRUG_POOL[0]?.name ?? 'Paracetamol');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const existing = getStoredYourProfile();
    if (!existing) return;
    const p = existing.profile;
    setAge(String(p.age));
    setSex(p.sex === 'female' ? 'female' : p.sex === 'male' ? 'male' : 'other');
    setWeightKg(String(p.weight_kg));
    setHeightCm(String(p.height_cm));
    setEgfr(p.egfr != null ? String(p.egfr) : '');
    setAlt(p.alt != null ? String(p.alt) : '');
    setAst(p.ast != null ? String(p.ast) : '');
    setConditionsRaw(p.conditions.map((c) => c.replace(/_/g, ' ')).join(', '));
    setAllergiesRaw(p.allergies.join(', '));
    setSmoking(p.smoking);
    setAlcohol(p.alcohol);
    setMedicalHistory(existing.medicalHistory);
    setChemicalInfluences(existing.chemicalInfluences);
    setMedications(p.medications.length ? p.medications : []);
    if (existing.preferredDrugName) setPreferredDrugName(existing.preferredDrugName);
  }, []);

  const bmiPreview = useMemo(() => {
    const w = parseFloat(weightKg);
    const h = parseFloat(heightCm);
    if (Number.isNaN(w) || Number.isNaN(h) || h <= 0) return null;
    return bmiFromMetric(w, h);
  }, [weightKg, heightCm]);

  const addMedRow = () => {
    setMedications((m) => [...m, { name: '', dose_mg: 0, frequency: 'once_daily' }]);
  };

  const updateMed = (i: number, patch: Partial<MedicationEntry>) => {
    setMedications((m) => m.map((row, j) => (j === i ? { ...row, ...patch } : row)));
  };

  const removeMed = (i: number) => {
    setMedications((m) => m.filter((_, j) => j !== i));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const ageN = parseInt(age, 10);
    const w = parseFloat(weightKg);
    const h = parseFloat(heightCm);
    if (Number.isNaN(ageN) || ageN < 1 || ageN > 120) {
      setError('Enter a valid age (1–120).');
      return;
    }
    if (Number.isNaN(w) || w < 20 || w > 300) {
      setError('Enter a valid weight in kg (20–300).');
      return;
    }
    if (Number.isNaN(h) || h < 50 || h > 250) {
      setError('Enter a valid height in cm (50–250).');
      return;
    }
    const bmi = bmiFromMetric(w, h);
    const egfrN = egfr.trim() === '' ? null : parseFloat(egfr);
    const altN = alt.trim() === '' ? null : parseFloat(alt);
    const astN = ast.trim() === '' ? null : parseFloat(ast);
    if (egfr !== '' && (Number.isNaN(egfrN!) || egfrN! < 0)) {
      setError('eGFR must be a positive number or empty.');
      return;
    }

    const profile: PatientProfile = {
      age: ageN,
      sex: sex === 'other' ? 'unspecified' : sex,
      weight_kg: w,
      height_cm: h,
      bmi,
      conditions: parseConditions(conditionsRaw),
      medications: medications
        .filter((x) => x.name.trim())
        .map((x) => ({
          name: x.name.trim(),
          dose_mg: Number(x.dose_mg) || 0,
          frequency: x.frequency,
        })),
      allergies: parseAllergies(allergiesRaw),
      egfr: egfrN,
      alt: altN,
      ast: astN,
      smoking,
      alcohol,
    };

    const stored: StoredYourProfile = {
      profile,
      medicalHistory: medicalHistory.trim() || 'No additional narrative provided.',
      chemicalInfluences: chemicalInfluences.trim() || 'None listed.',
      preferredDrugName: preferredDrugName || null,
    };

    setStoredYourProfile(stored);
    const drugQ = preferredDrugName ? `&drug=${encodeURIComponent(preferredDrugName)}` : '';
    router.push(`/patient/simulation?subject=you${drugQ}`);
  };

  return (
    <main className="min-h-screen p-3 md:p-5 text-[var(--text-primary)] bg-[var(--bg-app)] font-mono uppercase tracking-wide">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-3 gap-3">
          <div>
            <h1 className="text-lg text-[var(--accent-cyan)] mb-0.5">YOUR_PROFILE</h1>
            <p className="text-[10px] text-[var(--text-muted)] normal-case tracking-normal leading-snug">
              Answer the questions below to mirror the preset subjects. Your data stays in this browser (localStorage) unless you export a report.
            </p>
          </div>
          <Link
            href="/patient/simulation"
            className="text-[11px] border border-[var(--border-dim)] px-3 py-2 hover:border-[var(--accent-cyan)] text-[var(--text-muted)] shrink-0"
          >
            ← BACK
          </Link>
        </div>

        <form onSubmit={handleSubmit} className="sci-fi-border p-3 md:p-4 space-y-4">
          {error && (
            <div className="text-[11px] text-[var(--accent-red)] border border-[var(--accent-red)]/50 px-3 py-2 normal-case">
              {error}
            </div>
          )}

          <section>
            <h2 className="text-[12px] text-[var(--text-muted)] mb-2">DEMOGRAPHICS</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 normal-case">
              <label className="block text-[10px]">
                <span className="text-[var(--text-muted)]">Age (years)</span>
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  className="mt-1 w-full bg-[var(--bg-card)] border border-[var(--border-dim)] px-2 py-2 text-[12px]"
                />
              </label>
              <label className="block text-[10px]">
                <span className="text-[var(--text-muted)]">Sex</span>
                <select
                  value={sex}
                  onChange={(e) => setSex(e.target.value as 'male' | 'female' | 'other')}
                  className="mt-1 w-full bg-[var(--bg-card)] border border-[var(--border-dim)] px-2 py-2 text-[12px]"
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other / prefer not to say</option>
                </select>
              </label>
              <label className="block text-[10px]">
                <span className="text-[var(--text-muted)]">Weight (kg)</span>
                <input
                  type="number"
                  min={20}
                  max={300}
                  step={0.1}
                  value={weightKg}
                  onChange={(e) => setWeightKg(e.target.value)}
                  className="mt-1 w-full bg-[var(--bg-card)] border border-[var(--border-dim)] px-2 py-2 text-[12px]"
                />
              </label>
              <label className="block text-[10px]">
                <span className="text-[var(--text-muted)]">Height (cm)</span>
                <input
                  type="number"
                  min={50}
                  max={250}
                  step={0.1}
                  value={heightCm}
                  onChange={(e) => setHeightCm(e.target.value)}
                  className="mt-1 w-full bg-[var(--bg-card)] border border-[var(--border-dim)] px-2 py-2 text-[12px]"
                />
              </label>
            </div>
            {bmiPreview != null && (
              <p className="text-[10px] text-[var(--accent-cyan)] mt-2 normal-case">
                Calculated BMI: {bmiPreview}
              </p>
            )}
          </section>

          <section>
            <h2 className="text-[12px] text-[var(--text-muted)] mb-2">LABS (OPTIONAL)</h2>
            <p className="text-[9px] text-[var(--text-muted)] normal-case mb-2 leading-snug">
              Leave blank if unknown — the model will assume normal clearance bands.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 normal-case">
              <label className="block text-[10px]">
                <span className="text-[var(--text-muted)]">eGFR (mL/min/1.73m²)</span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={egfr}
                  onChange={(e) => setEgfr(e.target.value)}
                  placeholder="e.g. 90"
                  className="mt-1 w-full bg-[var(--bg-card)] border border-[var(--border-dim)] px-2 py-2 text-[12px]"
                />
              </label>
              <label className="block text-[10px]">
                <span className="text-[var(--text-muted)]">ALT (U/L)</span>
                <input
                  type="number"
                  min={0}
                  value={alt}
                  onChange={(e) => setAlt(e.target.value)}
                  placeholder="e.g. 25"
                  className="mt-1 w-full bg-[var(--bg-card)] border border-[var(--border-dim)] px-2 py-2 text-[12px]"
                />
              </label>
              <label className="block text-[10px]">
                <span className="text-[var(--text-muted)]">AST (U/L)</span>
                <input
                  type="number"
                  min={0}
                  value={ast}
                  onChange={(e) => setAst(e.target.value)}
                  placeholder="e.g. 22"
                  className="mt-1 w-full bg-[var(--bg-card)] border border-[var(--border-dim)] px-2 py-2 text-[12px]"
                />
              </label>
            </div>
          </section>

          <section>
            <h2 className="text-[12px] text-[var(--text-muted)] mb-2">CONDITIONS & ALLERGIES</h2>
            <label className="block text-[10px] mb-2 normal-case">
              <span className="text-[var(--text-muted)]">Conditions (comma-separated)</span>
              <textarea
                value={conditionsRaw}
                onChange={(e) => setConditionsRaw(e.target.value)}
                rows={2}
                placeholder="e.g. hypertension, type 2 diabetes, copd"
                className="mt-1 w-full bg-[var(--bg-card)] border border-[var(--border-dim)] px-2 py-2 text-[12px]"
              />
            </label>
            <label className="block text-[10px] normal-case">
              <span className="text-[var(--text-muted)]">Allergies (comma-separated)</span>
              <textarea
                value={allergiesRaw}
                onChange={(e) => setAllergiesRaw(e.target.value)}
                rows={2}
                placeholder="e.g. Penicillin, peanuts"
                className="mt-1 w-full bg-[var(--bg-card)] border border-[var(--border-dim)] px-2 py-2 text-[12px]"
              />
            </label>
          </section>

          <section>
            <h2 className="text-[12px] text-[var(--text-muted)] mb-2">CURRENT MEDICATIONS</h2>
            <p className="text-[9px] text-[var(--text-muted)] normal-case mb-2 leading-snug">
              Add drugs you already take — they feed interaction checks in the simulation.
            </p>
            <div className="space-y-2">
              {medications.map((row, i) => (
                <div key={i} className="flex flex-wrap gap-2 items-end border border-[var(--border-dim)] p-2 normal-case">
                  <input
                    type="text"
                    placeholder="Drug name"
                    value={row.name}
                    onChange={(e) => updateMed(i, { name: e.target.value })}
                    className="flex-1 min-w-[120px] bg-[var(--bg-card)] border border-[var(--border-dim)] px-2 py-1.5 text-[11px]"
                  />
                  <input
                    type="number"
                    placeholder="Dose mg"
                    min={0}
                    value={row.dose_mg || ''}
                    onChange={(e) => updateMed(i, { dose_mg: parseFloat(e.target.value) || 0 })}
                    className="w-24 bg-[var(--bg-card)] border border-[var(--border-dim)] px-2 py-1.5 text-[11px]"
                  />
                  <select
                    value={row.frequency}
                    onChange={(e) => updateMed(i, { frequency: e.target.value })}
                    className="bg-[var(--bg-card)] border border-[var(--border-dim)] px-2 py-1.5 text-[10px]"
                  >
                    {MEDICATION_FREQUENCIES.map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                  <button type="button" onClick={() => removeMed(i)} className="text-[10px] text-[var(--accent-red)] px-2">
                    REMOVE
                  </button>
                </div>
              ))}
              <button type="button" onClick={addMedRow} className="text-[10px] border border-[var(--border-dim)] px-3 py-1.5 hover:border-[var(--accent-cyan)]">
                + ADD MEDICATION
              </button>
            </div>
          </section>

          <section>
            <h2 className="text-[12px] text-[var(--text-muted)] mb-2">LIFESTYLE</h2>
            <div className="flex flex-wrap gap-4 normal-case items-center">
              <label className="flex items-center gap-2 text-[11px] cursor-pointer">
                <input type="checkbox" checked={smoking} onChange={(e) => setSmoking(e.target.checked)} />
                Smoking
              </label>
              <label className="flex items-center gap-2 text-[10px]">
                <span className="text-[var(--text-muted)]">Alcohol</span>
                <select
                  value={alcohol}
                  onChange={(e) => setAlcohol(e.target.value)}
                  className="bg-[var(--bg-card)] border border-[var(--border-dim)] px-2 py-1.5 text-[11px]"
                >
                  <option value="none">None</option>
                  <option value="occasional">Occasional</option>
                  <option value="moderate">Moderate</option>
                  <option value="heavy">Heavy</option>
                </select>
              </label>
            </div>
          </section>

          <section>
            <h2 className="text-[12px] text-[var(--text-muted)] mb-2">NARRATIVE</h2>
            <label className="block text-[10px] mb-2 normal-case">
              <span className="text-[var(--text-muted)]">Medical history (free text)</span>
              <textarea
                value={medicalHistory}
                onChange={(e) => setMedicalHistory(e.target.value)}
                rows={3}
                className="mt-1 w-full bg-[var(--bg-card)] border border-[var(--border-dim)] px-2 py-1.5 text-[12px] leading-snug"
                placeholder="Surgeries, chronic diseases, recent events…"
              />
            </label>
            <label className="block text-[10px] normal-case">
              <span className="text-[var(--text-muted)]">Chemical influences (OTC, supplements, caffeine, alcohol pattern…)</span>
              <textarea
                value={chemicalInfluences}
                onChange={(e) => setChemicalInfluences(e.target.value)}
                rows={2}
                className="mt-1 w-full bg-[var(--bg-card)] border border-[var(--border-dim)] px-2 py-1.5 text-[12px] leading-snug"
              />
            </label>
          </section>

          <section>
            <h2 className="text-[12px] text-[var(--text-muted)] mb-2">MEDICINE_TO_TEST</h2>
            <p className="text-[9px] text-[var(--text-muted)] normal-case mb-2 leading-snug">
              Pick the compound to simulate first when you return to the dashboard. You can change it anytime on the simulation page.
            </p>
            <div className="flex flex-wrap gap-2">
              {DRUG_POOL.map((d) => {
                const active = preferredDrugName === d.name;
                return (
                  <button
                    key={d.name}
                    type="button"
                    onClick={() => setPreferredDrugName(d.name)}
                    className={`px-3 py-2 text-[10px] border transition-colors normal-case ${
                      active ? 'border-2' : 'border border-[var(--border-dim)]'
                    }`}
                    style={{
                      borderColor: active ? d.tierColor : undefined,
                      color: active ? d.tierColor : 'var(--text-secondary)',
                    }}
                  >
                    {d.name}
                  </button>
                );
              })}
            </div>
          </section>

          <div className="flex flex-wrap gap-2 pt-3 border-t border-[var(--border-dim)]">
            <button
              type="submit"
              className="px-6 py-3 text-[12px] bg-[var(--accent-cyan)] text-black font-bold hover:opacity-90"
            >
              SAVE & OPEN SIMULATION
            </button>
            <Link
              href="/patient/simulation"
              className="px-6 py-3 text-[11px] border border-[var(--border-dim)] text-[var(--text-muted)] hover:border-[var(--accent-cyan)] inline-flex items-center"
            >
              CANCEL
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}
