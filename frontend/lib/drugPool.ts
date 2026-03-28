/** Shared with simulation + your-profile for consistent drug mapping. */

export interface DrugMeta {
  name: string;
  dose_mg: number;
  route: string;
  frequency: string;
  duration_days: number;
  category: 'GENERAL' | 'EXPERIMENTAL';
  tierLabel: string;
  tierColor: string;
  description: string;
}

export const DRUG_POOL: DrugMeta[] = [
  { name: 'Paracetamol',    dose_mg: 500, route: 'oral', frequency: 'three_times_daily', duration_days: 3, category: 'GENERAL',      tierLabel: 'SAFE',         tierColor: '#00FF66', description: 'Standard analgesic / antipyretic' },
  { name: 'Amoxicillin',    dose_mg: 500, route: 'oral', frequency: 'three_times_daily', duration_days: 3, category: 'GENERAL',      tierLabel: 'LOW RISK',     tierColor: '#66FF66', description: 'Penicillin-class antibiotic' },
  { name: 'Omeprazole',     dose_mg: 20,  route: 'oral', frequency: 'once_daily',        duration_days: 3, category: 'GENERAL',      tierLabel: 'LOW RISK',     tierColor: '#AAFF00', description: 'Proton pump inhibitor' },
  { name: 'Ibuprofen',      dose_mg: 400, route: 'oral', frequency: 'three_times_daily', duration_days: 3, category: 'GENERAL',      tierLabel: 'MODERATE',     tierColor: '#FFD700', description: 'NSAID anti-inflammatory' },
  { name: 'Clarithromycin', dose_mg: 500, route: 'oral', frequency: 'twice_daily',       duration_days: 3, category: 'GENERAL',      tierLabel: 'ELEVATED',     tierColor: '#FF9900', description: 'Macrolide antibiotic — CYP3A4 inhibitor' },
  { name: 'Morphine',       dose_mg: 10,  route: 'oral', frequency: 'every_six_hours',   duration_days: 3, category: 'GENERAL',      tierLabel: 'HIGH RISK',    tierColor: '#FF3366', description: 'Opioid analgesic — CNS depressant' },
  { name: 'NeuroCalm-X',    dose_mg: 25,  route: 'oral', frequency: 'once_daily',        duration_days: 3, category: 'EXPERIMENTAL', tierLabel: 'PHASE II',     tierColor: '#AA44FF', description: 'Experimental GABA-A modulator — Phase II trial' },
];
