'use client';

import { useState, useCallback, useMemo, useRef, useEffect, Fragment } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSimulationStore } from '@/store/simulationStore';
import TimelineScrubber from '@/components/TimelineScrubber';
import { runSimulation } from '@/lib/simulationApi';
import { DRUG_POOL, type DrugMeta } from '@/lib/drugPool';
import {
  getStoredYourProfile,
  subjectMetaFromStored,
  youPlaceholder,
  YOUR_PROFILE_EVENT,
  type SubjectMeta,
} from '@/lib/yourProfileStorage';
import type { DrugInput, SimulationResult } from '@/types/simulation';

const BodyMap3D = dynamic(() => import('@/components/BodyMap3D'), { ssr: false });

const PRESET_SUBJECTS: SubjectMeta[] = [
  {
    id: 'krish',
    codename: 'KRISH-01',
    label: 'Krish',
    role: 'Baseline',
    color: '#6eb896',
    signalVariance: 'LOW',
    medicalHistory:
      'No significant medical history. All biomarkers within normal reference ranges. Annual physicals unremarkable for 10+ years. No prior hospitalizations or surgical history.',
    chemicalInfluences:
      'None — clean pharmacological baseline. No active prescriptions, supplements, or recreational substances.',
    profile: {
      age: 28,
      sex: 'male',
      weight_kg: 74,
      height_cm: 178,
      bmi: 23.4,
      conditions: [],
      medications: [],
      allergies: [],
      egfr: 115,
      alt: 20,
      ast: 18,
      smoking: false,
      alcohol: 'occasional',
    },
  },
  {
    id: 'latha',
    codename: 'LATHA-02',
    label: 'Latha',
    role: 'Acute reaction',
    color: '#c9a85c',
    signalVariance: 'HIGH',
    medicalHistory:
      'Previously healthy 34F. Enrolled in Phase II clinical trial for experimental nootropic compound (NeuroCalm-X, NCX-207) 8 days ago. Developed acute-onset tremors, cognitive processing lag, and altered neural firing patterns 72h post-first dose. Trial participation suspended pending investigation.',
    chemicalInfluences:
      'NeuroCalm-X 25mg OD (experimental — mechanism under investigation). Suspected GABA-A receptor modulation with off-target serotonergic effects. ALT elevated to 68 U/L suggesting hepatic stress.',
    profile: {
      age: 34,
      sex: 'female',
      weight_kg: 62,
      height_cm: 165,
      bmi: 22.8,
      conditions: ['acute_drug_reaction'],
      medications: [{ name: 'NeuroCalm-X', dose_mg: 25, frequency: 'once_daily' }],
      allergies: [],
      egfr: 92,
      alt: 68,
      ast: 55,
      smoking: false,
      alcohol: 'none',
    },
  },
  {
    id: 'rajesh',
    codename: 'RAJESH-03',
    label: 'Rajesh',
    role: 'Multi-condition',
    color: '#c97a8a',
    signalVariance: 'MEDIUM',
    medicalHistory:
      '62M with 15-year history of COPD (GOLD Stage II), 8-year controlled epilepsy, peripheral neuropathy (diabetic origin, 5 years), and hypertension. Chronic polypharmacy patient with stable but elevated baseline organ stress. eGFR declining over last 3 years.',
    chemicalInfluences:
      'Levetiracetam 1000mg BID (anti-epileptic), Salbutamol 100mcg PRN (bronchodilator), Gabapentin 300mg TID (neuropathic pain), Amlodipine 5mg OD (antihypertensive). High hepatic enzyme load from chronic multi-drug metabolism.',
    profile: {
      age: 62,
      sex: 'male',
      weight_kg: 82,
      height_cm: 172,
      bmi: 27.7,
      conditions: ['copd', 'epilepsy', 'peripheral_neuropathy', 'hypertension'],
      medications: [
        { name: 'Salbutamol', dose_mg: 100, frequency: 'as_needed' },
        { name: 'Amlodipine', dose_mg: 5, frequency: 'once_daily' },
      ],
      allergies: ['Penicillin'],
      egfr: 58,
      alt: 52,
      ast: 45,
      smoking: false,
      alcohol: 'none',
    },
  },
];

const TIMESPANS = [
  { label: '24h', days: 1 },
  { label: '48h', days: 2 },
  { label: '72h', days: 3 },
];

const ORGAN_KEYS = ['brain', 'heart', 'liver', 'kidneys', 'stomach', 'lungs'] as const;

const ORGAN_LABELS: Record<(typeof ORGAN_KEYS)[number], string> = {
  brain: 'Brain',
  heart: 'Heart',
  liver: 'Liver',
  kidneys: 'Kidneys',
  stomach: 'Stomach',
  lungs: 'Lungs',
};

const ORGAN_BAR_COLORS: Record<(typeof ORGAN_KEYS)[number], string> = {
  brain: '#8fb8c4',
  heart: '#8fb8c4',
  liver: '#c9a85c',
  kidneys: '#c97a8a',
  stomach: '#c9a85c',
  lungs: '#8fb8c4',
};

function riskHue(score: number): string {
  if (score <= 30) return '#7d9f8a';
  if (score <= 60) return '#c9a85c';
  return '#b87a88';
}

function RiskDial({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, score));
  const r = 40;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (pct / 100) * circumference;
  const stroke = riskHue(score);
  const vb = 96;
  const c = vb / 2;
  return (
    <div className="relative flex h-[108px] w-[108px] shrink-0 items-center justify-center">
      <svg className="-rotate-90" width="108" height="108" viewBox={`0 0 ${vb} ${vb}`} aria-hidden>
        <circle cx={c} cy={c} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="7" />
        <circle
          cx={c}
          cy={c}
          r={r}
          fill="none"
          stroke={stroke}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="font-[family-name:var(--font-display)] text-2xl font-medium tracking-tight text-[var(--dash-fg)]">
          {Math.round(score)}
        </span>
        <span className="text-[9px] uppercase tracking-[0.18em] text-[var(--dash-muted)]">Risk</span>
      </div>
    </div>
  );
}

function OrganStressRows({
  organ,
  tp,
  prevTp,
}: {
  organ: (typeof ORGAN_KEYS)[number];
  tp: NonNullable<SimulationResult['timeline'][number]>;
  prevTp: SimulationResult['timeline'][number] | null;
}) {
  const oe = tp.organ_effects?.[organ];
  const score = (oe?.effect_score ?? 0) * 100;
  const prevScore = prevTp ? (prevTp.organ_effects?.[organ]?.effect_score ?? 0) * 100 : null;
  const delta = prevScore != null ? score - prevScore : null;
  const driver = oe?.driver_summary;
  const label = ORGAN_LABELS[organ];
  const color = ORGAN_BAR_COLORS[organ];

  return (
    <div className="mb-2 last:mb-0">
      <div className="mb-0.5 flex items-center gap-2 text-[11px]">
        <span className="w-[4.5rem] shrink-0 text-[var(--dash-muted)]">{label}</span>
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
          <motion.div
            className="h-full rounded-full"
            style={{ background: color }}
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(score, 100)}%` }}
            transition={{ duration: 0.55 }}
          />
        </div>
        <span className="w-9 shrink-0 text-right text-[12px] tabular-nums text-[var(--dash-soft)]">{Math.round(score)}%</span>
      </div>
      {delta != null && Math.abs(delta) >= 0.5 && (
        <p className="mb-1 pl-[4.5rem] text-[11px] text-[var(--dash-muted)]">
          vs prior step: {delta >= 0 ? '+' : ''}
          {delta.toFixed(0)}% modeled stress
        </p>
      )}
      {driver && (
        <p className="mt-0.5 border-l border-[var(--dash-line)] pl-2.5 text-[10px] leading-snug text-[var(--dash-soft)]">{driver}</p>
      )}
    </div>
  );
}

export default function SimulationDashboard() {
  const router = useRouter();
  const { setPatientProfile, setDrugInputs, setSimulationResult, currentTimeIndex, setCurrentTimeIndex } =
    useSimulationStore();

  const [youRow, setYouRow] = useState<SubjectMeta | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const autoRunRef = useRef<string>('');

  const [activeSubjectId, setActiveSubjectId] = useState<string | null>(null);
  const [activeDrugName, setActiveDrugName] = useState<string | null>(null);
  const [selectedDoseMg, setSelectedDoseMg] = useState<number | null>(null);
  const [selectedTimespan, setSelectedTimespan] = useState(3);
  const [sim, setSim] = useState<SimulationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedOrgan, setSelectedOrgan] = useState<string | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const cacheRef = useRef<Map<string, SimulationResult>>(new Map());

  useEffect(() => {
    const syncYou = () => {
      const stored = getStoredYourProfile();
      setYouRow(stored ? subjectMetaFromStored(stored) : youPlaceholder());
    };
    syncYou();
    setHydrated(true);
    window.addEventListener(YOUR_PROFILE_EVENT, syncYou);
    return () => window.removeEventListener(YOUR_PROFILE_EVENT, syncYou);
  }, []);

  const allSubjects = useMemo(() => [...PRESET_SUBJECTS, youRow ?? youPlaceholder()], [youRow]);

  const activeSubject = useMemo(
    () => allSubjects.find((s) => s.id === activeSubjectId) ?? null,
    [allSubjects, activeSubjectId],
  );
  const activeDrug = DRUG_POOL.find((d) => d.name === activeDrugName) ?? null;

  const getInitialTimelineIndex = useCallback((result: SimulationResult) => {
    if (!result.timeline?.length) return 0;
    let bestIndex = 0;
    let bestScore = -1;
    result.timeline.forEach((point, index) => {
      const maxPointScore = Math.max(...Object.values(point.organ_effects ?? {}).map((v) => v?.effect_score ?? 0));
      if (maxPointScore > bestScore) {
        bestScore = maxPointScore;
        bestIndex = index;
      }
    });
    return bestIndex;
  }, []);

  const runSim = useCallback(
    async (subject: SubjectMeta, drug: DrugMeta, days: number, doseMg: number) => {
      const drugInput: DrugInput = { ...drug, dose_mg: doseMg, duration_days: days };
      const profileFingerprint = [
        subject.profile.age,
        subject.profile.sex,
        subject.profile.egfr ?? '',
        subject.profile.alt ?? '',
        [...subject.profile.conditions].sort().join(','),
        JSON.stringify(subject.profile.medications ?? []),
      ].join('|');
      const key = `${subject.id}::${profileFingerprint}::${drug.name}::${days}::${doseMg}::sim-v2`;
      const cached = cacheRef.current.get(key);
      if (cached) {
        setSim(cached);
        setSimulationResult(cached);
        setPatientProfile(subject.profile);
        setDrugInputs([drugInput]);
        setCurrentTimeIndex(getInitialTimelineIndex(cached));
        return;
      }
      setLoading(true);
      setSim(null);
      setCurrentTimeIndex(0);
      setPatientProfile(subject.profile);
      setDrugInputs([drugInput]);
      try {
        const result = await runSimulation(subject.profile, [drugInput], { subjectId: subject.id });
        cacheRef.current.set(key, result);
        setSim(result);
        setSimulationResult(result);
        setCurrentTimeIndex(getInitialTimelineIndex(result));
      } catch (err) {
        console.error('Simulation failed:', err);
      } finally {
        setLoading(false);
      }
    },
    [setPatientProfile, setDrugInputs, setSimulationResult, setCurrentTimeIndex, getInitialTimelineIndex],
  );

  useEffect(() => {
    if (!hydrated) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('subject') !== 'you') return;
    const stored = getStoredYourProfile();
    if (!stored) return;
    const drugParam = params.get('drug');
    const drugName = drugParam ? decodeURIComponent(drugParam) : stored.preferredDrugName ?? undefined;
    const drug = DRUG_POOL.find((d) => d.name === drugName);
    if (!drug) return;
    const meta = subjectMetaFromStored(stored);
    const sig = `${params.toString()}|${stored.profile.age}|${String(stored.profile.egfr)}|${drug.name}`;
    if (autoRunRef.current === sig) return;
    autoRunRef.current = sig;
    setActiveSubjectId('you');
    setActiveDrugName(drug.name);
    setSelectedDoseMg(drug.dose_mg);
    runSim(meta, drug, selectedTimespan, drug.dose_mg);
  }, [hydrated, runSim, selectedTimespan]);

  const handleSubjectSelect = useCallback(
    (s: SubjectMeta) => {
      if (s.id === 'you' && s.needsSetup) {
        router.push('/patient/your-profile');
        return;
      }
      setActiveSubjectId(s.id);
      if (activeDrug) {
        const dose = selectedDoseMg ?? activeDrug.dose_mg;
        runSim(s, activeDrug, selectedTimespan, dose);
      }
    },
    [activeDrug, selectedDoseMg, selectedTimespan, runSim, router],
  );

  const handleDrugSelect = useCallback(
    (d: DrugMeta) => {
      setActiveDrugName(d.name);
      setSelectedDoseMg(d.dose_mg);
      if (activeSubject) runSim(activeSubject, d, selectedTimespan, d.dose_mg);
    },
    [activeSubject, selectedTimespan, runSim],
  );

  const handleTimespanChange = useCallback(
    (days: number) => {
      setSelectedTimespan(days);
      if (activeSubject && activeDrug) {
        const dose = selectedDoseMg ?? activeDrug.dose_mg;
        runSim(activeSubject, activeDrug, days, dose);
      }
    },
    [activeSubject, activeDrug, selectedDoseMg, runSim],
  );

  const doseConfig = useMemo(() => {
    if (!activeDrug) return null;
    const base = activeDrug.dose_mg;
    const min = Math.max(1, Math.round(base * 0.5));
    const max = Math.max(min + 1, Math.round(base * 1.5));
    const step = base <= 50 ? 1 : base <= 150 ? 5 : 10;
    return { min, max, step };
  }, [activeDrug]);

  const handleDoseChange = useCallback(
    (dose: number) => {
      setSelectedDoseMg(dose);
      if (activeSubject && activeDrug) {
        runSim(activeSubject, activeDrug, selectedTimespan, dose);
      }
    },
    [activeSubject, activeDrug, selectedTimespan, runSim],
  );

  const handleDownloadPdf = useCallback(async () => {
    if (!sim || !activeSubject || !activeDrug) return;
    setIsGeneratingPdf(true);
    try {
      const { generatePDF } = await import('@/components/SimulationReport');
      await generatePDF(sim, activeSubject.profile, {
        ...activeDrug,
        dose_mg: selectedDoseMg ?? activeDrug.dose_mg,
      });
    } catch (err) {
      console.error('PDF generation failed:', err);
    } finally {
      setIsGeneratingPdf(false);
    }
  }, [sim, activeSubject, activeDrug, selectedDoseMg]);

  const tp = sim?.timeline[currentTimeIndex];
  const prevTimelinePoint =
    sim?.timeline && currentTimeIndex > 0 ? sim.timeline[currentTimeIndex - 1] : null;

  const alertsList = useMemo(() => {
    if (!sim?.potential_alerts?.length) {
      return [
        {
          problem: 'No high-confidence alert extracted',
          cause: 'This run did not generate explicit problem–cause alerts.',
          severity: 'LOW' as const,
          recommended_monitoring: 'Continue routine symptom and hydration monitoring.',
          pattern_label: undefined as string | undefined,
          pattern_example: undefined as string | undefined,
          use_when: undefined as string | undefined,
          logic_trigger: undefined as string | undefined,
          model_output_label: undefined as string | undefined,
        },
      ];
    }
    return sim.potential_alerts.slice(0, 3);
  }, [sim]);

  const sideEffectsDetailed = sim?.predicted_side_effects?.slice(0, 8) ?? [];

  const lowStressOrgans = useMemo(() => {
    if (!sim?.timeline?.length) return [];
    const trackedOrgans = [...ORGAN_KEYS];
    const peakByOrgan = trackedOrgans.map((organ) => {
      let peak = 0;
      sim.timeline.forEach((point) => {
        peak = Math.max(peak, point.organ_effects?.[organ]?.effect_score ?? 0);
      });
      return { organ, peak };
    });
    return peakByOrgan.sort((a, b) => a.peak - b.peak).slice(0, 3);
  }, [sim]);

  const clinicalLine =
    sim?.clinical_bullets?.clinical_action ?? sim?.doctor_note ?? sim?.summary ?? '';

  return (
    <main
      className="relative flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden font-[family-name:var(--font-ui)] text-[15px] leading-snug tracking-normal [--dash-bg:#0a0908] [--dash-panel:#12100e] [--dash-fg:#f2efe9] [--dash-soft:#c9c4bc] [--dash-muted:#7a756c] [--dash-gold:#c4a574] [--dash-line:rgba(255,255,255,0.07)]"
      style={{
        background:
          'radial-gradient(120% 80% at 10% 0%, rgba(196,165,116,0.07) 0%, transparent 45%), radial-gradient(80% 60% at 90% 10%, rgba(120,140,160,0.06) 0%, transparent 40%), var(--dash-bg)',
      }}
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.03)_0%,transparent_28%)]" />

      {/* Header */}
      <header className="relative z-10 flex shrink-0 items-end justify-between gap-4 px-5 pb-3 pt-4 md:px-8">
        <div>
          <p className="text-[10px] uppercase tracking-[0.35em] text-[var(--dash-muted)]">MediTwin</p>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-medium tracking-tight text-[var(--dash-fg)] md:text-3xl">
            Exposure model
          </h1>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <div className="flex rounded-full border border-[var(--dash-line)] bg-black/20 p-0.5">
            {TIMESPANS.map((ts) => (
              <button
                key={ts.days}
                type="button"
                onClick={() => handleTimespanChange(ts.days)}
                className={`rounded-full px-3 py-1.5 text-[11px] font-medium transition-colors ${
                  selectedTimespan === ts.days
                    ? 'bg-white/[0.1] text-[var(--dash-fg)]'
                    : 'text-[var(--dash-muted)] hover:text-[var(--dash-soft)]'
                }`}
              >
                {ts.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isGeneratingPdf || !sim}
            className="rounded-full border border-[var(--dash-line)] px-3 py-1.5 text-[11px] font-medium text-[var(--dash-soft)] transition-colors hover:border-[var(--dash-gold)]/40 hover:text-[var(--dash-fg)] disabled:opacity-35"
          >
            {isGeneratingPdf ? 'Exporting…' : 'PDF'}
          </button>
          <Link
            href="/patient/your-profile"
            className="rounded-full border border-[var(--dash-line)] px-3 py-1.5 text-[11px] font-medium text-[var(--dash-muted)] transition-colors hover:border-[var(--dash-gold)]/35 hover:text-[var(--dash-soft)]"
          >
            Profile
          </Link>
        </div>
      </header>

      {/* Controls */}
      <section className="relative z-10 shrink-0 border-b border-[var(--dash-line)] px-5 pb-3 md:px-8">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
            {allSubjects.map((s) => {
              const active = s.id === activeSubjectId;
              const subjectButton = (
                <button
                  type="button"
                  onClick={() => handleSubjectSelect(s)}
                  className={`group flex min-w-0 items-center gap-2 rounded-full border px-3 py-1.5 text-left text-[12px] transition-all ${
                    active
                      ? 'border-[var(--dash-gold)]/50 bg-white/[0.06] text-[var(--dash-fg)]'
                      : 'border-transparent bg-white/[0.03] text-[var(--dash-muted)] hover:bg-white/[0.05] hover:text-[var(--dash-soft)]'
                  }`}
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: s.color, opacity: active ? 1 : 0.45 }}
                  />
                  <span className="truncate font-medium">{s.codename}</span>
                  {s.id === 'you' && s.needsSetup && (
                    <span className="text-[10px] text-[var(--dash-gold)]">Setup</span>
                  )}
                </button>
              );

              if (s.id === 'you' && !s.needsSetup && active) {
                return (
                  <div key={s.id} className="flex flex-wrap items-center gap-1.5">
                    {subjectButton}
                    <Link
                      href="/patient/your-profile"
                      className="shrink-0 rounded-full border border-[var(--dash-line)] px-2.5 py-1 text-[10px] font-medium text-[var(--dash-muted)] transition-colors hover:border-[var(--dash-gold)]/35 hover:text-[var(--dash-soft)]"
                    >
                      Update profile
                    </Link>
                  </div>
                );
              }

              return <Fragment key={s.id}>{subjectButton}</Fragment>;
            })}
          </div>

          <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:items-center lg:w-auto lg:min-w-[320px]">
            <div className="relative min-w-0 flex-1">
              <label className="sr-only">Compound</label>
              <select
                value={activeDrugName ?? ''}
                onChange={(e) => {
                  const d = DRUG_POOL.find((x) => x.name === e.target.value);
                  if (d) handleDrugSelect(d);
                }}
                className="w-full cursor-pointer appearance-none rounded-xl border border-[var(--dash-line)] bg-[var(--dash-panel)]/90 py-2.5 pl-3 pr-9 text-[13px] text-[var(--dash-fg)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] outline-none transition hover:border-[var(--dash-gold)]/25 focus:border-[var(--dash-gold)]/40"
              >
                <option value="">Select compound…</option>
                {DRUG_POOL.map((d) => (
                  <option key={d.name} value={d.name}>
                    {d.name}
                    {d.category === 'EXPERIMENTAL' ? ' (experimental)' : ''}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[var(--dash-muted)]">
                ▾
              </span>
            </div>

            {activeDrug && doseConfig && (
              <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-[var(--dash-line)] bg-black/25 px-2 py-1.5 sm:max-w-[240px]">
                <span className="shrink-0 text-[10px] uppercase tracking-wider text-[var(--dash-muted)]">Dose</span>
                <input
                  type="range"
                  min={doseConfig.min}
                  max={doseConfig.max}
                  step={doseConfig.step}
                  value={selectedDoseMg ?? activeDrug.dose_mg}
                  onChange={(e) => handleDoseChange(Number(e.target.value))}
                  className="min-w-0 flex-1"
                />
                <span className="w-12 shrink-0 text-right text-[12px] tabular-nums text-[var(--dash-gold)]">
                  {selectedDoseMg ?? activeDrug.dose_mg}mg
                </span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Body — scrolls between chrome and timeline */}
      <div className="relative z-10 min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-2 md:px-8">
        <AnimatePresence mode="wait">
          {!activeSubject || !activeDrug ? (
            <motion.div
              key="await"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 text-center"
            >
              <p className="font-[family-name:var(--font-display)] text-xl text-[var(--dash-fg)]">Choose a person and a compound</p>
              <p className="max-w-md text-[13px] text-[var(--dash-muted)]">
                The model stays quiet until you pick both. Presets illustrate baselines; Your profile uses labs and history you save.
              </p>
            </motion.div>
          ) : loading ? (
            <motion.div
              key="load"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2"
            >
              <motion.div
                className="h-1 w-40 overflow-hidden rounded-full bg-white/[0.06]"
                initial={false}
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.4, repeat: Infinity }}
              >
                <div className="h-full w-1/2 rounded-full bg-[var(--dash-gold)]/80" />
              </motion.div>
              <p className="text-[12px] text-[var(--dash-muted)]">Running hybrid ML + enrichment…</p>
            </motion.div>
          ) : sim ? (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-1 gap-3 pb-3 lg:grid-cols-12 lg:items-start lg:gap-4"
            >
              {/* Left: risk + dose, adverse events, person */}
              <aside className="flex flex-col gap-3 lg:col-span-3">
                <div className="rounded-xl border border-[var(--dash-line)] bg-[var(--dash-panel)]/55 p-4 shadow-[0_16px_48px_rgba(0,0,0,0.3)] backdrop-blur-sm">
                  <div className="flex gap-3 sm:gap-4">
                    <RiskDial score={sim.risk_score} />
                    <div className="min-w-0 flex-1 space-y-2">
                      <p className="text-[11px] leading-snug text-[var(--dash-muted)]">
                        From modeled side effects, interactions, and contraindications — not a clinical score.
                      </p>
                      <div className="border-t border-[var(--dash-line)] pt-2">
                        <p className="mb-1.5 text-[10px] uppercase tracking-[0.18em] text-[var(--dash-muted)]">Dose guidance</p>
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${
                              sim.dose_guidance === 'DOSE_DOWN'
                                ? 'border-[#b87a88]/35 text-[#d4a8b0]'
                                : sim.dose_guidance === 'DOSE_UP'
                                  ? 'border-[#c9a85c]/35 text-[#e0c999]'
                                  : 'border-[#7d9f8a]/35 text-[#a8c4b4]'
                            }`}
                          >
                            {sim.dose_guidance ?? 'MAINTAIN_DOSE'}
                          </span>
                          <span className="text-[12px] tabular-nums text-[var(--dash-gold)]">
                            {sim.suggested_dose_mg ?? (selectedDoseMg ?? activeDrug.dose_mg)} mg suggested
                          </span>
                        </div>
                        <p className="mt-2 text-[12px] leading-snug text-[var(--dash-soft)]">
                          {sim.dose_guidance_reason ??
                            'Shifts when organ stress, exposure, and risk move together.'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-[var(--dash-line)] bg-black/20 p-4">
                  <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                    <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--dash-muted)]">Adverse events</span>
                    <span className="text-[10px] text-[var(--dash-muted)]">Model estimates · not a diagnosis</span>
                  </div>
                  <div className="space-y-2.5">
                    {sideEffectsDetailed.map((se, i) => {
                      const c =
                        se.probability > 0.5 ? '#b87a88' : se.probability > 0.2 ? '#c9a85c' : 'var(--dash-gold)';
                      return (
                        <div
                          key={`${se.effect}-${i}`}
                          className="rounded-lg border border-[var(--dash-line)]/80 bg-black/15 px-2.5 py-2"
                        >
                          <div className="mb-1 flex justify-between gap-2 text-[12px]">
                            <span className="font-medium text-[var(--dash-fg)]">{se.effect}</span>
                            <span className="shrink-0 tabular-nums text-[var(--dash-soft)]">
                              {(se.probability * 100).toFixed(0)}%
                            </span>
                          </div>
                          <div className="mb-1 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                            <motion.div
                              className="h-full rounded-full"
                              style={{ background: c }}
                              initial={{ width: 0 }}
                              animate={{ width: `${se.probability * 100}%` }}
                              transition={{ duration: 0.6 }}
                            />
                          </div>
                          {se.explanation ? (
                            <p className="text-[11px] leading-snug text-[var(--dash-muted)]">{se.explanation}</p>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-xl border border-[var(--dash-line)] bg-black/25 p-4">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2 border-b border-[var(--dash-line)] pb-2">
                    <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--dash-muted)]">Person</span>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[13px] font-medium text-[var(--dash-fg)]">
                        {activeSubject.codename} · {activeSubject.label}
                      </span>
                      {activeSubject.id === 'you' && !activeSubject.needsSetup && (
                        <Link
                          href="/patient/your-profile"
                          className="rounded-full border border-[var(--dash-line)] px-2.5 py-0.5 text-[10px] font-medium text-[var(--dash-muted)] transition-colors hover:border-[var(--dash-gold)]/35 hover:text-[var(--dash-soft)]"
                        >
                          Update profile
                        </Link>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-x-2 gap-y-1.5 border-b border-[var(--dash-line)] py-2.5 text-[11px]">
                    <div>
                      <span className="text-[var(--dash-muted)]">Age</span> {activeSubject.profile.age}y
                    </div>
                    <div>
                      <span className="text-[var(--dash-muted)]">Sex</span> {activeSubject.profile.sex}
                    </div>
                    <div>
                      <span className="text-[var(--dash-muted)]">BMI</span> {activeSubject.profile.bmi}
                    </div>
                    <div>
                      <span className="text-[var(--dash-muted)]">eGFR</span> {activeSubject.profile.egfr ?? '—'}
                    </div>
                    <div>
                      <span className="text-[var(--dash-muted)]">ALT</span> {activeSubject.profile.alt ?? '—'}
                    </div>
                    <div>
                      <span className="text-[var(--dash-muted)]">Wt</span> {activeSubject.profile.weight_kg} kg
                    </div>
                  </div>
                  <div className="space-y-2.5 pt-2.5">
                    <div>
                      <p className="mb-0.5 text-[10px] uppercase tracking-[0.15em] text-[var(--dash-muted)]">History</p>
                      <p className="text-[12px] leading-snug text-[var(--dash-soft)]">{activeSubject.medicalHistory}</p>
                    </div>
                    <div>
                      <p className="mb-0.5 text-[10px] uppercase tracking-[0.15em] text-[var(--dash-muted)]">Meds & exposures</p>
                      <p className="text-[12px] leading-snug text-[var(--dash-soft)]">{activeSubject.chemicalInfluences}</p>
                    </div>
                    {lowStressOrgans.length > 0 ? (
                      <div className="flex flex-wrap gap-x-3 gap-y-1 border-t border-[var(--dash-line)] pt-2">
                        <span className="text-[10px] uppercase tracking-[0.15em] text-[var(--dash-muted)]">Calmer organs</span>
                        {lowStressOrgans.map((entry) => (
                          <span key={entry.organ} className="text-[11px] text-[var(--dash-soft)]">
                            <span className="capitalize text-[var(--dash-muted)]">{entry.organ}</span>{' '}
                            <span className="tabular-nums text-[#7d9f8a]">{Math.max(0, 100 - Math.round(entry.peak * 100))}%</span>
                          </span>
                        ))}
                      </div>
                    ) : null}
                    <div>
                      <p className="mb-0.5 text-[10px] uppercase tracking-[0.15em] text-[var(--dash-muted)]">Clinical note</p>
                      <p className="text-[12px] leading-snug text-[var(--dash-soft)]">{clinicalLine}</p>
                    </div>
                  </div>
                </div>
              </aside>

              {/* Center: body map */}
              <section className="lg:col-span-6">
                <div className="flex flex-col overflow-hidden rounded-xl border border-[var(--dash-line)] bg-gradient-to-b from-white/[0.04] to-transparent p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-[family-name:var(--font-display)] text-xl leading-tight text-[var(--dash-fg)] md:text-2xl">
                        {activeDrug.name}
                      </p>
                      <p className="mt-0.5 text-[12px] text-[var(--dash-muted)]">
                        {selectedDoseMg ?? activeDrug.dose_mg} mg · T<sub>peak</sub> +{sim.peak_time_hours}h · T<sub>½</sub>{' '}
                        {sim.half_life_hours}h ·{' '}
                        <span className="text-[var(--dash-soft)]">
                          {activeSubject.codename} · {activeSubject.label}
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="relative h-[min(42vh,440px)] min-h-[280px] w-full overflow-hidden rounded-lg bg-black/30">
                    <BodyMap3D
                      timeline={sim.timeline}
                      currentTimeIndex={currentTimeIndex}
                      onOrganClick={setSelectedOrgan}
                      selectedOrgan={selectedOrgan}
                    />
                  </div>
                  <p className="mt-2 text-[10px] leading-snug text-[var(--dash-muted)]">
                    Drag to rotate; use the mouse wheel over the model to zoom. Click organ markers on the body for emphasis.
                  </p>
                  {tp ? (
                    <div className="mt-3 rounded-lg border border-[var(--dash-line)] bg-black/25 p-3">
                      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                        <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--dash-muted)]">Organ stress</span>
                        <span className="text-[10px] text-[var(--dash-muted)]">This timeline step · 0–100% modeled load</span>
                      </div>
                      {ORGAN_KEYS.map((key) => (
                        <OrganStressRows key={key} organ={key} tp={tp} prevTp={prevTimelinePoint} />
                      ))}
                    </div>
                  ) : null}
                </div>
              </section>

              {/* Right: model alerts */}
              <aside className="flex flex-col gap-3 lg:col-span-3">
                <div className="rounded-xl border border-[var(--dash-line)] bg-[var(--dash-panel)]/40 p-4 backdrop-blur-sm">
                  <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--dash-muted)]">Model signals</span>
                    <span className="text-[10px] text-[var(--dash-muted)]">Simulator output · not a diagnosis</span>
                  </div>
                  <div className="space-y-2.5">
                    {alertsList.map((a, idx) => {
                      const sev = (a.severity || 'LOW').toUpperCase();
                      const sevColor =
                        sev === 'CRITICAL' || sev === 'HIGH'
                          ? '#d4a8b0'
                          : sev === 'MODERATE'
                            ? '#e0c999'
                            : '#a8c4b4';
                      const titleLine = [a.pattern_label, a.pattern_example ? `(${a.pattern_example})` : null]
                        .filter(Boolean)
                        .join(' ');
                      return (
                        <div
                          key={`${a.problem}-${idx}`}
                          className="rounded-lg border border-[var(--dash-line)]/80 bg-black/20 px-2.5 py-2"
                        >
                          {titleLine ? (
                            <p className="mb-1 text-[11px] text-[var(--dash-gold)]">{titleLine}</p>
                          ) : null}
                          {a.use_when ? (
                            <p className="mb-0.5 text-[11px] text-[var(--dash-muted)]">
                              <span className="text-[var(--dash-soft)]">When · </span>
                              {a.use_when}
                            </p>
                          ) : null}
                          {a.logic_trigger ? (
                            <p className="mb-1 text-[11px] text-[#c9a85c]/90">Trigger · {a.logic_trigger}</p>
                          ) : null}
                          <div className="mb-1 flex flex-wrap items-start justify-between gap-2">
                            <span className="text-[12px] font-medium leading-snug text-[var(--dash-fg)]">
                              {a.model_output_label ?? a.problem}
                            </span>
                            <span
                              className="shrink-0 rounded-full border px-1.5 py-px text-[9px] uppercase tracking-wide"
                              style={{ color: sevColor, borderColor: `${sevColor}55` }}
                            >
                              {sev}
                            </span>
                          </div>
                          <p className="text-[11px] leading-snug text-[var(--dash-soft)]">
                            <span className="text-[var(--dash-muted)]">Why · </span>
                            {a.cause}
                          </p>
                          <p className="mt-0.5 text-[11px] leading-snug text-[var(--dash-muted)]">
                            <span className="text-[var(--dash-soft)]">Monitor · </span>
                            {a.recommended_monitoring}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </aside>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      {/* Timeline */}
      {sim && activeSubject && activeDrug && !loading && (
        <footer className="relative z-10 shrink-0 border-t border-[var(--dash-line)] bg-black/20 px-5 py-2 backdrop-blur-md md:px-8">
          <TimelineScrubber
            timelineLength={sim.timeline.length}
            currentIndex={currentTimeIndex}
            onChange={setCurrentTimeIndex}
            labels={sim.timeline.map((t) => t.time_label)}
            sciFiMode
          />
          <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-[10px] text-[var(--dash-muted)]">
            <span>Educational / investigational — not medical advice.</span>
            <span className="font-mono text-[9px] opacity-80">MediTwin · ML + LLM enrichment</span>
          </div>
        </footer>
      )}

      {!sim && (activeSubject && activeDrug) && !loading && (
        <footer className="relative z-10 shrink-0 px-5 py-2 text-center text-[10px] text-[var(--dash-muted)] md:px-8">
          Educational / investigational — not medical advice.
        </footer>
      )}
    </main>
  );
}
