'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useSimulationStore } from '@/store/simulationStore';
import { searchDrugs, runSimulation } from '@/lib/simulationApi';
import type { DrugEntry, DrugInput } from '@/types/simulation';

const LOADING_MESSAGES = [
  'Analyzing your physiology...',
  'Mapping drug distribution pathways...',
  'Computing organ effect scores...',
  'Checking drug interactions...',
  'Running pharmacokinetic simulation...',
  'Generating clinical insights with AI...',
];

export default function DrugInputPage() {
  const router = useRouter();
  const { patientProfile, setDrugInputs, setSimulationResult, isLoading, setIsLoading, setLoadingMessage, loadingMessage, error, setError } = useSimulationStore();

  const [drugName, setDrugName] = useState('');
  const [doseMg, setDoseMg] = useState(400);
  const [route, setRoute] = useState('oral');
  const [frequency, setFrequency] = useState('three_times_daily');
  const [durationDays, setDurationDays] = useState(5);
  const [suggestions, setSuggestions] = useState<DrugEntry[]>([]);
  const [selectedDrug, setSelectedDrug] = useState<DrugEntry | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingMsgIndex, setLoadingMsgIndex] = useState(0);

  useEffect(() => {
    if (!patientProfile) router.push('/patient/onboarding');
  }, [patientProfile, router]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (drugName.length >= 2) {
        const results = await searchDrugs(drugName);
        setSuggestions(results);
        setShowSuggestions(true);
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [drugName]);

  useEffect(() => {
    if (!isLoading) return;
    const interval = setInterval(() => {
      setLoadingMsgIndex(i => (i + 1) % LOADING_MESSAGES.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [isLoading]);

  useEffect(() => {
    setLoadingMessage(LOADING_MESSAGES[loadingMsgIndex]);
  }, [loadingMsgIndex, setLoadingMessage]);

  const selectDrug = (drug: DrugEntry) => {
    setSelectedDrug(drug);
    setDrugName(drug.name);
    setDoseMg(drug.typical_dose_mg);
    setShowSuggestions(false);
  };

  const handleSimulate = async () => {
    if (!patientProfile || !selectedDrug) return;
    setIsLoading(true);
    setError(null);
    setLoadingMsgIndex(0);
    const drugs: DrugInput[] = [{ name: selectedDrug.name, dose_mg: doseMg, route, frequency, duration_days: durationDays }];
    setDrugInputs(drugs);
    try {
      const result = await runSimulation(patientProfile, drugs);
      setSimulationResult(result);
      router.push('/patient/simulation');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Simulation failed');
    } finally {
      setIsLoading(false);
    }
  };

  const inputClass = "w-full bg-[var(--bg-card)] border border-[var(--border-dim)] rounded-lg px-3 py-2.5 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-cyan)] transition-colors";

  if (!patientProfile) return null;

  return (
    <main className="min-h-screen flex flex-col items-center p-4 pt-6">
      <motion.div className="w-full max-w-xl" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold mb-1">Select medication</h1>
        <p className="text-[var(--text-secondary)] text-sm mb-4">Search and choose a drug to simulate</p>

        {/* Drug Search */}
        <div className="relative mb-4">
          <label className="block text-sm text-[var(--text-secondary)] mb-1">Drug name</label>
          <input
            placeholder="Search drugs (e.g. Ibuprofen, Metformin...)"
            value={drugName}
            onChange={e => { setDrugName(e.target.value); setSelectedDrug(null); }}
            className={inputClass}
          />
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-50 w-full mt-1 bg-[var(--bg-card)] border border-[var(--border-dim)] rounded-xl max-h-60 overflow-y-auto">
              {suggestions.map((s, i) => (
                <button key={i} onClick={() => selectDrug(s)}
                  className="w-full text-left px-4 py-3 hover:bg-[var(--bg-card-hover)] transition-colors border-b border-[var(--border-dim)] last:border-0">
                  <div className="font-medium">{s.name}</div>
                  <div className="text-xs text-[var(--text-muted)]">{s.brand_names.join(', ')} · {s.mechanism}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Selected Drug Info */}
        {selectedDrug && (
          <motion.div className="glass-card p-4 mb-4" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-[var(--accent-cyan)]">{selectedDrug.name}</h3>
                <p className="text-sm text-[var(--text-muted)]">{selectedDrug.brand_names.join(', ')}</p>
              </div>
              <span className="text-xs px-3 py-1 rounded-full bg-[var(--accent-cyan)]/10 text-[var(--accent-cyan)]">
                {selectedDrug.drug_class_id.replace(/_/g, ' ')}
              </span>
            </div>
            <p className="text-sm text-[var(--text-secondary)] mt-1.5 leading-snug">{selectedDrug.mechanism}</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-[var(--text-muted)]">
              <span>Half-life: {selectedDrug.typical_half_life_hours}h</span>
              <span>Peak: {selectedDrug.typical_peak_hours}h</span>
              <span>Typical dose: {selectedDrug.typical_dose_mg}mg</span>
            </div>
          </motion.div>
        )}

        {/* Dose Config */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="block text-sm text-[var(--text-secondary)] mb-1">Dose (mg)</label>
            <input type="number" value={doseMg} onChange={e => setDoseMg(+e.target.value)} className={inputClass} min={1} />
          </div>
          <div>
            <label className="block text-sm text-[var(--text-secondary)] mb-1">Route</label>
            <select value={route} onChange={e => setRoute(e.target.value)} className={inputClass}>
              <option value="oral">Oral</option>
              <option value="iv">IV</option>
              <option value="topical">Topical</option>
              <option value="inhaled">Inhaled</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="block text-sm text-[var(--text-secondary)] mb-1">Frequency</label>
            <select value={frequency} onChange={e => setFrequency(e.target.value)} className={inputClass}>
              <option value="once_daily">Once daily</option>
              <option value="twice_daily">Twice daily</option>
              <option value="three_times_daily">3× daily</option>
              <option value="as_needed">As needed</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-[var(--text-secondary)] mb-1">Duration: {durationDays} days</label>
            <input type="range" min={1} max={30} value={durationDays} onChange={e => setDurationDays(+e.target.value)} className="w-full mt-1.5" />
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="p-3 mb-4 rounded-lg bg-[var(--accent-red)]/10 border border-[var(--accent-red)]/30 text-[var(--accent-red)] text-sm">
            {error}
          </div>
        )}

        {/* Submit */}
        <motion.button
          onClick={handleSimulate}
          disabled={!selectedDrug || isLoading}
          className="w-full py-3 rounded-lg bg-gradient-to-r from-[var(--accent-cyan-dim)] to-[var(--accent-cyan)] text-[var(--bg-app)] font-semibold text-base disabled:opacity-40 disabled:cursor-not-allowed shadow-[var(--shadow-panel)]"
          whileHover={{ scale: selectedDrug && !isLoading ? 1.01 : 1 }}
          whileTap={{ scale: 0.99 }}
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-3">
              <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
              {loadingMessage}
            </span>
          ) : '⚡ Run Simulation'}
        </motion.button>
      </motion.div>
    </main>
  );
}
