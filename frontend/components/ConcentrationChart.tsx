'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, Area, AreaChart } from 'recharts';
import type { TimelinePoint } from '@/types/simulation';

interface ConcentrationChartProps {
  timeline: TimelinePoint[];
  peakTimeHours: number;
  halfLifeHours: number;
  clearanceTimeHours: number;
  sciFiMode?: boolean;
}

export default function ConcentrationChart({ timeline, peakTimeHours, halfLifeHours, clearanceTimeHours, sciFiMode = false }: ConcentrationChartProps) {
  const data = timeline.map(tp => ({
    time: tp.time_hours,
    label: tp.time_label,
    activity: tp.organ_effects.bloodstream?.effect_score ?? 0,
    plasma: tp.plasma_level,
  }));

  return (
    <div className={sciFiMode ? "" : "glass-card p-5"}>
      {!sciFiMode && <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-4">Plasma Concentration Timeline</h3>}
      <ResponsiveContainer width="100%" height={sciFiMode ? 100 : 220}>
        <AreaChart data={data} margin={{ top: 5, right: 15, left: -15, bottom: 5 }}>
          <defs>
            <linearGradient id="colorActivity" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#00D4FF" stopOpacity={sciFiMode ? 0.6 : 0.3} />
              <stop offset="95%" stopColor="#00D4FF" stopOpacity={0} />
            </linearGradient>
          </defs>
          {!sciFiMode && <CartesianGrid strokeDasharray="3 3" stroke="#1A2340" vertical={false} />}
          {!sciFiMode && <XAxis dataKey="time" tick={{ fill: '#5A637A', fontSize: 11 }} axisLine={{ stroke: '#1A2340' }} tickFormatter={v => `${v}h`} />}
          {!sciFiMode && <YAxis tick={{ fill: '#5A637A', fontSize: 11 }} axisLine={{ stroke: '#1A2340' }} domain={[0, 1]} tickFormatter={v => `${(v * 100).toFixed(0)}%`} />}
          
          <Tooltip
            contentStyle={{ background: '#0F1628', border: '1px solid #1A2340', borderRadius: sciFiMode ? 0 : 12, fontSize: 12, fontFamily: sciFiMode ? 'monospace' : 'inherit' }}
            labelFormatter={v => `T+${v}h`}
            formatter={(v) => [`${(Number(v) * 100).toFixed(1)}%`, 'Activity']}
          />
          
          <ReferenceLine x={peakTimeHours} stroke="#FFD700" strokeDasharray={sciFiMode ? "3 3" : "5 5"} label={{ value: 'Cmax_PEAK', fill: '#FFD700', fontSize: 8, fontFamily: 'monospace' }} />
          <ReferenceLine x={halfLifeHours} stroke="#5A637A" strokeDasharray={sciFiMode ? "3 3" : "5 5"} label={{ value: 'T1/2_HALF_LIFE', fill: '#5A637A', fontSize: 8, fontFamily: 'monospace' }} />
          
          <Area type="monotone" dataKey="activity" stroke="#00D4FF" strokeWidth={sciFiMode ? 1.5 : 2.5} fill="url(#colorActivity)" dot={!sciFiMode ? { fill: '#00D4FF', r: 3, strokeWidth: 0 } : false} activeDot={{ r: 4, strokeWidth: 0, fill: '#00D4FF' }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
