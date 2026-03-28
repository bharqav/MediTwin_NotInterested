'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useSimulationStore } from '@/store/simulationStore';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export default function PharmaResultsPage() {
  const router = useRouter();
  const { populationResult, drugInputs } = useSimulationStore();
  const [sortKey, setSortKey] = useState<string>('risk_score');
  const [sortAsc, setSortAsc] = useState(false);

  if (!populationResult) { router.push('/pharma/setup'); return null; }
  const r = populationResult;
  const drug = drugInputs[0];

  // Risk distribution histogram
  const bins = [
    { range: '0-20', count: r.risk_distribution.filter(s => s <= 20).length, color: '#1D9E75' },
    { range: '21-40', count: r.risk_distribution.filter(s => s > 20 && s <= 40).length, color: '#639922' },
    { range: '41-60', count: r.risk_distribution.filter(s => s > 40 && s <= 60).length, color: '#EF9F27' },
    { range: '61-80', count: r.risk_distribution.filter(s => s > 60 && s <= 80).length, color: '#D85A30' },
    { range: '81-100', count: r.risk_distribution.filter(s => s > 80).length, color: '#E24B4A' },
  ];

  // Side effect incidence bars
  const seData = Object.entries(r.side_effect_incidence)
    .map(([effect, count]) => ({ effect, count, pct: Math.round((count / r.total_patients) * 100) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const getSortValue = (p: (typeof r.individual_results)[0], key: string): number | string => {
    if (key === 'profile.age') return p.profile.age;
    if (key === 'profile.sex') return p.profile.sex;
    if (key === 'profile.egfr') return p.profile.egfr ?? 0;
    return (p as Record<string, unknown>)[key] as number ?? 0;
  };

  const sorted = [...r.individual_results].sort((a, b) => {
    const va = getSortValue(a, sortKey);
    const vb = getSortValue(b, sortKey);
    if (typeof va === 'string' && typeof vb === 'string') return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
    return sortAsc ? (va as number) - (vb as number) : (vb as number) - (va as number);
  });

  return (
    <main className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <h1 className="text-3xl font-bold">🔬 Population Sweep Results</h1>
          <p className="text-[var(--text-secondary)]">{drug?.name} {drug?.dose_mg}mg · {r.total_patients} virtual patients</p>
        </motion.div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Mean Risk Score', value: r.mean_risk_score, color: r.mean_risk_score <= 40 ? '#1D9E75' : r.mean_risk_score <= 60 ? '#EF9F27' : '#E24B4A' },
            { label: 'High-Risk Patients', value: `${r.high_risk_count}/${r.total_patients}`, color: r.high_risk_count > 0 ? '#E24B4A' : '#1D9E75' },
            { label: 'Most Prevalent SE', value: r.most_prevalent_side_effect, color: '#00D4FF', small: true },
            { label: 'Renal-Impaired Mean', value: r.subgroup_analysis.renal_impaired_mean_risk || 'N/A', color: '#D85A30' },
          ].map((s, i) => (
            <motion.div key={i} className="glass-card p-5 text-center" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
              <div className={`text-2xl font-bold ${s.small ? 'text-sm' : ''}`} style={{ color: s.color }}>{s.value}</div>
              <div className="text-xs text-[var(--text-muted)] mt-1">{s.label}</div>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Risk histogram */}
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold text-[var(--text-muted)] mb-4">Risk Distribution</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={bins}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1A2340" vertical={false} />
                <XAxis dataKey="range" tick={{ fill: '#5A637A', fontSize: 11 }} axisLine={{ stroke: '#1A2340' }} />
                <YAxis tick={{ fill: '#5A637A', fontSize: 11 }} axisLine={{ stroke: '#1A2340' }} />
                <Tooltip contentStyle={{ background: '#0F1628', border: '1px solid #1A2340', borderRadius: 12, fontSize: 12 }} />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {bins.map((b, i) => <Cell key={i} fill={b.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* SE incidence */}
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold text-[var(--text-muted)] mb-4">Side Effect Incidence</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={seData} layout="vertical" margin={{ left: 70 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1A2340" horizontal={false} />
                <XAxis type="number" tick={{ fill: '#5A637A', fontSize: 11 }} axisLine={{ stroke: '#1A2340' }} tickFormatter={v => `${v}`} />
                <YAxis type="category" dataKey="effect" tick={{ fill: '#8B95B0', fontSize: 10 }} axisLine={{ stroke: '#1A2340' }} width={65} />
                <Tooltip contentStyle={{ background: '#0F1628', border: '1px solid #1A2340', borderRadius: 12, fontSize: 12 }}
                  formatter={(v) => [`${v} patients`, 'Count']} />
                <Bar dataKey="count" fill="#00D4FF" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Patient table */}
        <div className="glass-card p-5 overflow-x-auto">
          <h3 className="text-sm font-semibold text-[var(--text-muted)] mb-4">Individual Patient Results</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[var(--text-muted)] border-b border-[var(--border-dim)]">
                {[['#', 'patient_id'], ['Age', 'profile.age'], ['Sex', 'profile.sex'], ['eGFR', 'profile.egfr'], ['Risk', 'risk_score'], ['Top SE', 'top_side_effect']].map(([label, key]) => (
                  <th key={key} className="py-2 px-3 text-left cursor-pointer hover:text-[var(--accent-cyan)]"
                    onClick={() => { if (sortKey === key) { setSortAsc(!sortAsc); } else { setSortKey(key); setSortAsc(false); } }}>
                    {label} {sortKey === key ? (sortAsc ? '↑' : '↓') : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map(p => {
                const riskColor = p.risk_score <= 30 ? '#1D9E75' : p.risk_score <= 60 ? '#EF9F27' : '#E24B4A';
                return (
                  <tr key={p.patient_id} className="border-b border-[var(--border-dim)]/50 hover:bg-[var(--bg-card-hover)] transition-colors">
                    <td className="py-2 px-3">{p.patient_id}</td>
                    <td className="py-2 px-3">{p.profile.age}</td>
                    <td className="py-2 px-3 capitalize">{p.profile.sex}</td>
                    <td className="py-2 px-3">{p.profile.egfr}</td>
                    <td className="py-2 px-3 font-semibold" style={{ color: riskColor }}>{p.risk_score}</td>
                    <td className="py-2 px-3 text-[var(--text-secondary)]">{p.top_side_effect}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-6 p-4 rounded-xl bg-[var(--border-dim)]/50 text-xs text-[var(--text-muted)]">
          ⚠️ Population results are from ML simulation only (no individual LLM enrichment). For investigational research purposes only.
        </div>
      </div>
    </main>
  );
}
