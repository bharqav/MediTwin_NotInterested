import { create } from 'zustand';
import type { PatientProfile, DrugInput, SimulationResult, PopulationResult } from '@/types/simulation';

interface SimulationStore {
  // Patient
  patientProfile: PatientProfile | null;
  setPatientProfile: (p: PatientProfile) => void;

  // Drug
  drugInputs: DrugInput[];
  setDrugInputs: (d: DrugInput[]) => void;
  addDrugInput: (d: DrugInput) => void;

  // Simulation
  simulationResult: SimulationResult | null;
  setSimulationResult: (r: SimulationResult | null) => void;

  // Timeline
  currentTimeIndex: number;
  setCurrentTimeIndex: (i: number) => void;

  // Loading
  isLoading: boolean;
  setIsLoading: (l: boolean) => void;
  loadingMessage: string;
  setLoadingMessage: (m: string) => void;

  // Error
  error: string | null;
  setError: (e: string | null) => void;

  // Pharma
  populationResult: PopulationResult | null;
  setPopulationResult: (r: PopulationResult | null) => void;

  // Mode
  mode: 'patient' | 'doctor' | 'pharma';
  setMode: (m: 'patient' | 'doctor' | 'pharma') => void;

  // Reset
  reset: () => void;
}

export const useSimulationStore = create<SimulationStore>((set) => ({
  patientProfile: null,
  setPatientProfile: (p) => set({ patientProfile: p }),

  drugInputs: [],
  setDrugInputs: (d) => set({ drugInputs: d }),
  addDrugInput: (d) => set((s) => ({ drugInputs: [...s.drugInputs, d] })),

  simulationResult: null,
  setSimulationResult: (r) => set({ simulationResult: r }),

  currentTimeIndex: 0,
  setCurrentTimeIndex: (i) => set({ currentTimeIndex: i }),

  isLoading: false,
  setIsLoading: (l) => set({ isLoading: l }),
  loadingMessage: '',
  setLoadingMessage: (m) => set({ loadingMessage: m }),

  error: null,
  setError: (e) => set({ error: e }),

  populationResult: null,
  setPopulationResult: (r) => set({ populationResult: r }),

  mode: 'patient',
  setMode: (m) => set({ mode: m }),

  reset: () => set({
    patientProfile: null,
    drugInputs: [],
    simulationResult: null,
    currentTimeIndex: 0,
    isLoading: false,
    loadingMessage: '',
    error: null,
    populationResult: null,
  }),
}));
