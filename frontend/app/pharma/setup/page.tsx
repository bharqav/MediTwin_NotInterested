'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useSimulationStore } from '@/store/simulationStore';
import { searchDrugs } from '@/lib/simulationApi';
import type { DrugEntry } from '@/types/simulation';

export default function PharmaSetupPage() {
  const router = useRouter();
  const { setDrugInputs } = useSimulationStore();
  const [drugName, setDrugName] = useState('');
  const [doseMg, setDoseMg] = useState(400);
  const [route, setRoute] = useState('oral');
  const [frequency, setFrequency] = useState('once_daily');
  const [durationDays, setDurationDays] = useState(7);
  const [suggestions, setSuggestions] = useState<DrugEntry[]>([]);
  const [selectedDrug, setSelectedDrug] = useState<DrugEntry | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (drugName.length >= 2) {
        const results = await searchDrugs(drugName);
        setSuggestions(results);
        setShowSuggestions(true);
      } else { setSuggestions([]); setShowSuggestions(false); }
    }, 200);
    return () => clearTimeout(timer);
  }, [drugName]);

  const selectDrug = (drug: DrugEntry) => {
    setSelectedDrug(drug);
    setDrugName(drug.name);
    setDoseMg(drug.typical_dose_mg);
    setShowSuggestions(false);
  };

  const handleContinue = () => {
    if (!selectedDrug) return;
    setDrugInputs([{ name: selectedDrug.name, dose_mg: doseMg, route, frequency, duration_days: durationDays }]);
    router.push('/pharma/population');
  };

  const inputClass = "w-full bg-[var(--bg-card)] border border-[var(--border-dim)] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition-colors";

  return (
    <main className="min-h-screen flex flex-col items-center p-6 pt-12">
      <motion.div className="w-full max-w-xl" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-2xl">🔬</span>
          <h1 className="text-3xl font-bold">Pharma R&D Mode</h1>
        </div>
        <p className="text-[var(--text-secondary)] mb-8">Configure the drug compound for population screening</p>

        <div className="relative mb-6">
          <label className="block text-sm text-[var(--text-secondary)] mb-2">Drug compound</label>
          <input placeholder="Search drug database..." value={drugName}
            onChange={e => { setDrugName(e.target.value); setSelectedDrug(null); }} className={inputClass} />
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-50 w-full mt-1 bg-[var(--bg-card)] border border-[var(--border-dim)] rounded-xl max-h-48 overflow-y-auto">
              {suggestions.map((s, i) => (
                <button key={i} onClick={() => selectDrug(s)}
                  className="w-full text-left px-4 py-3 hover:bg-[var(--bg-card-hover)] transition-colors text-sm">
                  <span className="font-medium">{s.name}</span>
                  <span className="text-[var(--text-muted)] ml-2">{s.drug_class_id.replace(/_/g, ' ')}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {selectedDrug && (
          <div className="glass-card p-5 mb-6">
            <h3 className="text-lg font-semibold text-purple-400">{selectedDrug.name}</h3>
            <p className="text-sm text-[var(--text-muted)]">{selectedDrug.mechanism}</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 mb-8">
          <div>
            <label className="block text-sm text-[var(--text-secondary)] mb-2">Dose (mg)</label>
            <input type="number" value={doseMg} onChange={e => setDoseMg(+e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm text-[var(--text-secondary)] mb-2">Route</label>
            <select value={route} onChange={e => setRoute(e.target.value)} className={inputClass}>
              <option value="oral">Oral</option><option value="iv">IV</option>
            </select>
          </div>
        </div>

        <button onClick={handleContinue} disabled={!selectedDrug}
          className="w-full py-4 rounded-xl bg-gradient-to-r from-purple-500 to-violet-500 text-white font-semibold text-lg disabled:opacity-40">
          Configure Population →
        </button>
      </motion.div>
    </main>
  );
}
