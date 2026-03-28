'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useSimulationStore } from '@/store/simulationStore';
import { runPopulationSimulation } from '@/lib/simulationApi';

export default function PopulationConfigPage() {
  const router = useRouter();
  const { drugInputs, setPopulationResult, setIsLoading, isLoading, setError, error } = useSimulationStore();
  const [n, setN] = useState(20);
  const [ageMin, setAgeMin] = useState(18);
  const [ageMax, setAgeMax] = useState(85);
  const [sexDist, setSexDist] = useState('equal');
  const [kidneyFn, setKidneyFn] = useState('mixed');
  const [diabeticPct, setDiabeticPct] = useState(20);
  const [hyperPct, setHyperPct] = useState(20);

  const drug = drugInputs[0];

  const handleRun = async () => {
    if (!drug) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await runPopulationSimulation(drug, {
        n, age_min: ageMin, age_max: ageMax,
        sex_distribution: sexDist, kidney_function: kidneyFn,
        diabetic_pct: diabeticPct, hypertension_pct: hyperPct,
      });
      setPopulationResult(result);
      router.push('/pharma/results');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setIsLoading(false);
    }
  };

  const chipClass = (active: boolean) => `px-4 py-2 rounded-xl text-sm transition-all ${active ? 'bg-purple-500/20 border border-purple-500/50 text-purple-400' : 'bg-[var(--bg-card)] border border-[var(--border-dim)] text-[var(--text-muted)] hover:border-[var(--text-secondary)]'}`;

  if (!drug) { router.push('/pharma/setup'); return null; }

  return (
    <main className="min-h-screen flex flex-col items-center p-6 pt-12">
      <motion.div className="w-full max-w-xl" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold mb-2">🧪 Population Config</h1>
        <p className="text-[var(--text-secondary)] mb-8">
          Screening <span className="text-purple-400 font-semibold">{drug.name} {drug.dose_mg}mg</span> across virtual patients
        </p>

        {/* N */}
        <div className="mb-6">
          <label className="block text-sm text-[var(--text-secondary)] mb-3">Population size</label>
          <div className="flex gap-3">
            {[10, 20, 50].map(v => (
              <button key={v} onClick={() => setN(v)} className={chipClass(n === v)}>{v} patients</button>
            ))}
          </div>
        </div>

        {/* Age */}
        <div className="mb-6">
          <label className="block text-sm text-[var(--text-secondary)] mb-2">Age range: {ageMin} – {ageMax}</label>
          <div className="flex gap-3 items-center">
            <input type="number" value={ageMin} onChange={e => setAgeMin(+e.target.value)} className="w-20 bg-[var(--bg-card)] border border-[var(--border-dim)] rounded-xl px-3 py-2 text-white text-center text-sm" />
            <div className="flex-1 h-0.5 bg-[var(--border-dim)]" />
            <input type="number" value={ageMax} onChange={e => setAgeMax(+e.target.value)} className="w-20 bg-[var(--bg-card)] border border-[var(--border-dim)] rounded-xl px-3 py-2 text-white text-center text-sm" />
          </div>
        </div>

        {/* Sex */}
        <div className="mb-6">
          <label className="block text-sm text-[var(--text-secondary)] mb-3">Sex distribution</label>
          <div className="flex gap-3">
            {[['equal', 'Equal'], ['male_heavy', 'Male-heavy'], ['female_heavy', 'Female-heavy']].map(([v, l]) => (
              <button key={v} onClick={() => setSexDist(v)} className={chipClass(sexDist === v)}>{l}</button>
            ))}
          </div>
        </div>

        {/* Kidney */}
        <div className="mb-6">
          <label className="block text-sm text-[var(--text-secondary)] mb-3">Kidney function</label>
          <div className="flex gap-3">
            {[['normal', 'Normal'], ['mixed', 'Mixed'], ['impaired_heavy', 'Impaired-heavy']].map(([v, l]) => (
              <button key={v} onClick={() => setKidneyFn(v)} className={chipClass(kidneyFn === v)}>{l}</button>
            ))}
          </div>
        </div>

        {/* Comorbidities */}
        <div className="mb-6">
          <label className="block text-sm text-[var(--text-secondary)] mb-3">Include diabetics</label>
          <div className="flex gap-3">
            {[0, 20, 50].map(v => (
              <button key={v} onClick={() => setDiabeticPct(v)} className={chipClass(diabeticPct === v)}>{v}%</button>
            ))}
          </div>
        </div>
        <div className="mb-8">
          <label className="block text-sm text-[var(--text-secondary)] mb-3">Include hypertension</label>
          <div className="flex gap-3">
            {[0, 20, 50].map(v => (
              <button key={v} onClick={() => setHyperPct(v)} className={chipClass(hyperPct === v)}>{v}%</button>
            ))}
          </div>
        </div>

        {error && <div className="p-3 mb-4 rounded-xl bg-[var(--accent-red)]/10 text-[var(--accent-red)] text-sm">{error}</div>}

        <button onClick={handleRun} disabled={isLoading}
          className="w-full py-4 rounded-xl bg-gradient-to-r from-purple-500 to-violet-500 text-white font-semibold text-lg disabled:opacity-50">
          {isLoading ? '⏳ Running population sweep...' : `🚀 Run Population Sweep (N=${n})`}
        </button>
      </motion.div>
    </main>
  );
}
