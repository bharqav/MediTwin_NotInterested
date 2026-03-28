import type { PatientProfile, DrugInput, SimulationResult, PopulationConfig, PopulationResult, DrugEntry } from '@/types/simulation';

/** Set in `.env.local`: NEXT_PUBLIC_API_URL=https://your-api.example (no trailing slash). Never commit real URLs or keys. */
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

function getApiBaseCandidates() {
  const candidates = [API_URL];

  if (typeof window !== 'undefined') {
    const localHost = window.location.hostname;
    if (localHost && localHost !== 'localhost' && localHost !== '127.0.0.1') {
      candidates.push(`http://${localHost}:8000`);
    }
  }

  if (API_URL.includes('localhost')) {
    candidates.push(API_URL.replace('localhost', '127.0.0.1'));
  } else if (API_URL.includes('127.0.0.1')) {
    candidates.push(API_URL.replace('127.0.0.1', 'localhost'));
  }

  candidates.push('http://localhost:8000', 'http://127.0.0.1:8000');

  return [...new Set(candidates)];
}

async function fetchWithFallback(path: string, init: RequestInit) {
  const candidates = getApiBaseCandidates();
  let lastError: unknown = null;

  for (const base of candidates) {
    try {
      return await fetch(`${base}${path}`, init);
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError ?? new Error('Unable to reach simulation API');
}

export async function runSimulation(
  profile: PatientProfile,
  drugs: DrugInput[],
  options?: { subjectId?: string }
): Promise<SimulationResult> {
  const body: Record<string, unknown> = { profile, drugs };
  if (options?.subjectId) {
    body.subject_id = options.subjectId;
  }
  const res = await fetchWithFallback('/api/simulate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Simulation failed' }));
    throw new Error(err.detail || 'Simulation failed');
  }

  const data = await res.json();
  return data.simulation;
}

export async function runPopulationSimulation(
  drug: DrugInput,
  config: PopulationConfig
): Promise<PopulationResult> {
  const res = await fetchWithFallback('/api/simulate/population', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ drug, config }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Population simulation failed' }));
    throw new Error(err.detail || 'Population simulation failed');
  }

  const data = await res.json();
  return data;
}

export async function searchDrugs(query: string): Promise<DrugEntry[]> {
  const res = await fetchWithFallback(`/api/drugs/search?q=${encodeURIComponent(query)}`, {
    method: 'GET',
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.results;
}

export async function getAllDrugs(): Promise<DrugEntry[]> {
  const res = await fetchWithFallback('/api/drugs', { method: 'GET' });
  if (!res.ok) return [];
  const data = await res.json();
  return data.results;
}
