'use client';

import { useState } from 'react';
import { useSimulationStore } from '@/store/simulationStore';
import { runSimulation, searchDrugs } from '@/lib/simulationApi';

const PRESETS = [
  {
    id: 'p1',
    name: 'Diabetic Patient (58Y) + NSAID',
    description: 'High risk: Tests Metformin interaction with Ibuprofen on reduced renal function.',
    profile: {
      age: 58,
      sex: 'male',
      weight_kg: 82,
      height_cm: 175,
      bmi: 26.8,
      conditions: ['type_2_diabetes', 'hypertension'],
      medications: [{ name: 'Metformin', dose_mg: 500, frequency: 'twice_daily' }],
      allergies: [],
      egfr: 68,
      alt: 22,
      ast: 20,
      smoking: false,
      alcohol: 'none',
    },
    drug: {
      name: 'Ibuprofen',
      dose_mg: 400,
      route: 'oral',
      frequency: 'three_times_daily',
      duration_days: 5,
    }
  },
  {
    id: 'p2',
    name: 'Elderly (72Y) + Macrolide',
    description: 'Critical risk: Tests Warfarin interaction with Clarithromycin (CYP3A4).',
    profile: {
      age: 72,
      sex: 'male',
      weight_kg: 70,
      height_cm: 170,
      bmi: 24.2,
      conditions: ['atrial_fibrillation', 'ckd_stage_3'],
      medications: [{ name: 'Warfarin', dose_mg: 5, frequency: 'once_daily' }],
      allergies: [],
      egfr: 45,
      alt: 30,
      ast: 28,
      smoking: true,
      alcohol: 'none',
    },
    drug: {
      name: 'Clarithromycin',
      dose_mg: 500,
      route: 'oral',
      frequency: 'twice_daily',
      duration_days: 7,
    }
  },
  {
    id: 'p3',
    name: 'Healthy (30Y) + Antibiotic',
    description: 'Low risk: Standard Amoxicillin course for a healthy adult.',
    profile: {
      age: 30,
      sex: 'female',
      weight_kg: 60,
      height_cm: 165,
      bmi: 22.0,
      conditions: [],
      medications: [],
      allergies: [],
      egfr: 110,
      alt: 15,
      ast: 15,
      smoking: false,
      alcohol: 'occasional',
    },
    drug: {
      name: 'Amoxicillin',
      dose_mg: 500,
      route: 'oral',
      frequency: 'three_times_daily',
      duration_days: 7,
    }
  }
];

export default function PresetSelector({ onLoaded, fallbackMode = false }: { onLoaded: () => void, fallbackMode?: boolean }) {
  const { setPatientProfile, setDrugInputs, setSimulationResult, setIsLoading } = useSimulationStore();
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const loadPreset = async (preset: typeof PRESETS[0]) => {
    setLoadingId(preset.id);
    setIsLoading(true);
    try {
      setPatientProfile(preset.profile);
      setDrugInputs([preset.drug]);
      const result = await runSimulation(preset.profile, [preset.drug]);
      setSimulationResult(result);
      onLoaded();
    } catch (err) {
      console.error(err);
      alert('Simulation failed. Ensure backend is running.');
    } finally {
      setIsLoading(false);
      setLoadingId(null);
    }
  };

  if (fallbackMode) {
    return (
      <div className="min-h-screen bg-[var(--bg-app)] flex flex-col items-center justify-center p-6 text-[var(--text-primary)] font-mono">
        <div className="sci-fi-border p-8 max-w-2xl w-full">
          <h1 className="text-2xl text-[var(--accent-cyan)] mb-2">NO ACTIVE SIMULATION DETECTED</h1>
          <p className="text-[var(--text-secondary)] mb-8 text-sm">Please load a pre-configured patient profile and drug protocol to initialize the simulation core.</p>
          
          <div className="space-y-4">
            {PRESETS.map(p => (
              <button 
                key={p.id}
                onClick={() => loadPreset(p)}
                disabled={loadingId !== null}
                className="w-full text-left p-4 bg-[var(--bg-card)] border border-[var(--border-dim)] hover:border-[var(--accent-cyan)] transition-colors group relative overflow-hidden"
              >
                {loadingId === p.id && <div className="absolute inset-0 bg-[var(--accent-cyan)]/10 animate-pulse" />}
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[var(--accent-amber)] font-bold">{p.name}</span>
                  <span className="text-[10px] text-[var(--text-muted)] border border-[var(--border-dim)] px-2 py-0.5">PROTOCOL // {p.id.toUpperCase()}</span>
                </div>
                <p className="text-xs text-[var(--text-secondary)]">{p.description}</p>
                <div className="mt-2 text-[9px] text-[var(--text-muted)] flex gap-4">
                  <span>DRUG: {p.drug.name} {p.drug.dose_mg}mg</span>
                  <span>CONDITIONS: {p.profile.conditions.length > 0 ? p.profile.conditions.join(', ') : 'NONE'}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[var(--bg-app)] p-2 font-mono">
      <div className="text-[10px] text-[var(--text-muted)] mb-4 border-b border-[var(--border-dim)] pb-2">AVAILABLE PRESETS</div>
      <div className="space-y-3">
        {PRESETS.map(p => (
          <button 
            key={p.id}
            onClick={() => loadPreset(p)}
            disabled={loadingId !== null}
            className="w-full text-left p-3 border border-[var(--border-dim)] hover:border-[var(--accent-cyan)] transition-colors bg-[var(--bg-primary)]"
          >
            <div className="text-xs text-[var(--accent-amber)] font-bold mb-1">{p.name}</div>
            <div className="text-[10px] text-[var(--text-secondary)]">{p.drug.name} {p.drug.dose_mg}mg</div>
            {loadingId === p.id && <div className="text-[10px] text-[var(--accent-cyan)] mt-2 animate-pulse">INITIATING SIMULATION...</div>}
          </button>
        ))}
      </div>
    </div>
  );
}