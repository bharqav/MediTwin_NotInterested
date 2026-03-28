import type { PatientProfile } from '@/types/simulation';

export const YOUR_PROFILE_STORAGE_KEY = 'meditwin_your_profile_v1';

export const YOUR_PROFILE_EVENT = 'meditwin-your-profile';

export interface StoredYourProfile {
  profile: PatientProfile;
  medicalHistory: string;
  chemicalInfluences: string;
  /** Drug from DRUG_POOL to auto-select after save */
  preferredDrugName: string | null;
}

export function getStoredYourProfile(): StoredYourProfile | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(YOUR_PROFILE_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as StoredYourProfile;
    if (!data?.profile || typeof data.profile.age !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}

export function setStoredYourProfile(data: StoredYourProfile): void {
  localStorage.setItem(YOUR_PROFILE_STORAGE_KEY, JSON.stringify(data));
  window.dispatchEvent(new CustomEvent(YOUR_PROFILE_EVENT));
}

export function clearStoredYourProfile(): void {
  localStorage.removeItem(YOUR_PROFILE_STORAGE_KEY);
  window.dispatchEvent(new CustomEvent(YOUR_PROFILE_EVENT));
}

export function parseConditions(input: string): string[] {
  return input
    .split(/[,;\n]+/)
    .map((s) => s.trim().toLowerCase().replace(/\s+/g, '_'))
    .filter(Boolean);
}

export function parseAllergies(input: string): string[] {
  return input
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export const MEDICATION_FREQUENCIES = [
  { value: 'once_daily', label: 'Once daily' },
  { value: 'twice_daily', label: 'Twice daily' },
  { value: 'three_times_daily', label: 'Three times daily' },
  { value: 'every_six_hours', label: 'Every 6 hours' },
  { value: 'every_eight_hours', label: 'Every 8 hours' },
  { value: 'every_twelve_hours', label: 'Every 12 hours' },
  { value: 'as_needed', label: 'As needed' },
] as const;

/** Unified shape for preset + YOU rows on the simulation dashboard */
export interface SubjectMeta {
  id: string;
  codename: string;
  label: string;
  role: string;
  color: string;
  signalVariance: 'LOW' | 'MEDIUM' | 'HIGH';
  medicalHistory: string;
  chemicalInfluences: string;
  profile: PatientProfile;
  /** YOU only — open questionnaire first */
  needsSetup?: boolean;
}

export function youPlaceholder(): SubjectMeta {
  return {
    id: 'you',
    codename: 'YOU',
    label: 'YOU',
    role: 'SETUP',
    color: '#00DDFF',
    signalVariance: 'MEDIUM',
    medicalHistory:
      'Complete the questionnaire to model your physiology and map medicines to your profile.',
    chemicalInfluences: 'Not entered yet.',
    profile: {
      age: 30,
      sex: 'male',
      weight_kg: 70,
      height_cm: 170,
      bmi: 24.2,
      conditions: [],
      medications: [],
      allergies: [],
      egfr: 90,
      alt: 25,
      ast: 22,
      smoking: false,
      alcohol: 'occasional',
    },
    needsSetup: true,
  };
}

export function subjectMetaFromStored(stored: StoredYourProfile): SubjectMeta {
  return {
    id: 'you',
    codename: 'YOU',
    label: 'YOU',
    role: 'CUSTOM',
    color: '#00DDFF',
    signalVariance: 'MEDIUM',
    medicalHistory: stored.medicalHistory,
    chemicalInfluences: stored.chemicalInfluences,
    profile: stored.profile,
    needsSetup: false,
  };
}
