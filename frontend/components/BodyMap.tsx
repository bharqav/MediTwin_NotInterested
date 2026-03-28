'use client';

import { motion } from 'framer-motion';
import type { TimelinePoint } from '@/types/simulation';

interface BodyMapProps {
  timeline: TimelinePoint[];
  currentTimeIndex: number;
  onOrganClick: (organ: string) => void;
  selectedOrgan: string | null;
  sciFiMode?: boolean;
}

function scoreToColor(score: number): string {
  if (score < 0.15) return '#1D9E75'; // Normal mode colors
  if (score < 0.30) return '#639922';
  if (score < 0.50) return '#EF9F27';
  if (score < 0.70) return '#D85A30';
  return '#E24B4A';
}

function scoreToSciFiColor(score: number): string {
  if (score < 0.15) return '#00F0FF'; // Cyan
  if (score < 0.30) return '#00FF66'; // Green
  if (score < 0.50) return '#FFD700'; // Amber
  if (score < 0.70) return '#FF6600'; // Coral
  return '#FF3366'; // Red
}

function scoreToLabel(score: number): string {
  if (score < 0.15) return 'None';
  if (score < 0.30) return 'Minimal';
  if (score < 0.50) return 'Mild';
  if (score < 0.70) return 'Moderate';
  return 'Severe';
}

const ORGAN_POSITIONS: Record<string, { cx: number; cy: number; rx: number; ry: number; label: string }> = {
  brain:       { cx: 110, cy: 42,  rx: 28, ry: 22, label: 'Brain' },
  lungs:       { cx: 110, cy: 125, rx: 45, ry: 28, label: 'Lungs' },
  heart:       { cx: 120, cy: 145, rx: 14, ry: 14, label: 'Heart' },
  liver:       { cx: 82,  cy: 185, rx: 22, ry: 18, label: 'Liver' },
  stomach:     { cx: 125, cy: 190, rx: 20, ry: 18, label: 'Stomach' },
  kidneys:     { cx: 110, cy: 215, rx: 30, ry: 14, label: 'Kidneys' },
  bloodstream: { cx: 110, cy: 260, rx: 35, ry: 60, label: 'Bloodstream' },
  skin:        { cx: 110, cy: 180, rx: 52, ry: 150, label: 'Skin' },
};

export default function BodyMap({ timeline, currentTimeIndex, onOrganClick, selectedOrgan, sciFiMode = false }: BodyMapProps) {
  const currentTP = timeline[currentTimeIndex];
  if (!currentTP) return null;
  const organs = currentTP.organ_effects;
  const getColor = sciFiMode ? scoreToSciFiColor : scoreToColor;

  return (
    <div className="flex flex-col items-center w-full h-full relative">
      <svg viewBox="0 0 220 400" className={`w-full max-w-[300px] h-auto ${sciFiMode ? '' : 'filter drop-shadow-[0_0_30px_rgba(0,212,255,0.1)]'}`}>
        {/* SciFi Grid Background */}
        {sciFiMode && (
          <g opacity="0.2">
            {[...Array(20)].map((_, i) => (
              <line key={`v${i}`} x1={i * 11} y1="0" x2={i * 11} y2="400" stroke="#00F0FF" strokeWidth="0.5" />
            ))}
            {[...Array(40)].map((_, i) => (
              <line key={`h${i}`} x1="0" y1={i * 10} x2="220" y2={i * 10} stroke="#00F0FF" strokeWidth="0.5" />
            ))}
          </g>
        )}

        {/* Body silhouette */}
        <ellipse cx="110" cy="40" rx="30" ry="35" fill="transparent" stroke={sciFiMode ? "var(--accent-cyan-dim)" : "#1A2340"} strokeWidth={sciFiMode ? "1" : "1.5"} strokeDasharray={sciFiMode ? "4 2" : "none"} />
        <line x1="110" y1="75" x2="110" y2="230" stroke={sciFiMode ? "var(--accent-cyan-dim)" : "#1A2340"} strokeWidth={sciFiMode ? "1" : "2"} />
        <line x1="110" y1="100" x2="55" y2="180" stroke={sciFiMode ? "var(--accent-cyan-dim)" : "#1A2340"} strokeWidth={sciFiMode ? "1" : "2"} />
        <line x1="110" y1="100" x2="165" y2="180" stroke={sciFiMode ? "var(--accent-cyan-dim)" : "#1A2340"} strokeWidth={sciFiMode ? "1" : "2"} />
        <line x1="110" y1="230" x2="75" y2="370" stroke={sciFiMode ? "var(--accent-cyan-dim)" : "#1A2340"} strokeWidth={sciFiMode ? "1" : "2"} />
        <line x1="110" y1="230" x2="145" y2="370" stroke={sciFiMode ? "var(--accent-cyan-dim)" : "#1A2340"} strokeWidth={sciFiMode ? "1" : "2"} />

        {/* Skin (background glow) */}
        {organs.skin && organs.skin.effect_score > 0.15 && (
          <motion.ellipse
            cx={ORGAN_POSITIONS.skin.cx} cy={ORGAN_POSITIONS.skin.cy}
            rx={ORGAN_POSITIONS.skin.rx} ry={ORGAN_POSITIONS.skin.ry}
            fill={getColor(organs.skin.effect_score)}
            opacity={0.08}
            animate={{ opacity: [0.05, 0.12, 0.05] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        )}

        {/* Bloodstream */}
        {organs.bloodstream && (
          <motion.ellipse
            cx={ORGAN_POSITIONS.bloodstream.cx} cy={ORGAN_POSITIONS.bloodstream.cy}
            rx={ORGAN_POSITIONS.bloodstream.rx} ry={ORGAN_POSITIONS.bloodstream.ry}
            fill={getColor(organs.bloodstream.effect_score)}
            opacity={0.15}
            animate={{ opacity: organs.bloodstream.effect_score > 0.4 ? [0.1, 0.25, 0.1] : 0.15 }}
            transition={{ duration: 1.5, repeat: Infinity }}
            onClick={() => onOrganClick('bloodstream')}
            className="cursor-pointer"
          />
        )}

        {/* Major organs */}
        {['brain', 'lungs', 'heart', 'liver', 'stomach', 'kidneys'].map(organ => {
          const pos = ORGAN_POSITIONS[organ];
          const score = organs[organ]?.effect_score ?? 0;
          const color = getColor(score);
          const isSelected = selectedOrgan === organ;
          const shouldPulse = score > 0.4;

          return (
            <g key={organ} onClick={() => onOrganClick(organ)} className="cursor-pointer">
              {sciFiMode ? (
                // Sci-Fi Target box
                <motion.rect
                  x={pos.cx - pos.rx} y={pos.cy - pos.ry}
                  width={pos.rx * 2} height={pos.ry * 2}
                  fill="transparent"
                  stroke={color}
                  strokeWidth="1.5"
                  opacity={0.8}
                  animate={shouldPulse ? { scale: [1, 1.1, 1], opacity: [0.5, 1, 0.5] } : { scale: 1 }}
                  transition={{ duration: 1.5, repeat: shouldPulse ? Infinity : 0 }}
                  style={{ transformOrigin: `${pos.cx}px ${pos.cy}px` }}
                />
              ) : (
                <motion.ellipse
                  cx={pos.cx} cy={pos.cy}
                  rx={pos.rx} ry={pos.ry}
                  fill={color}
                  opacity={0.85}
                  stroke={isSelected ? '#fff' : color}
                  strokeWidth={isSelected ? 2 : 1}
                  animate={shouldPulse ? { scale: [1, 1.06, 1], opacity: [0.7, 0.95, 0.7] } : { scale: 1 }}
                  transition={{ duration: 1.5, repeat: shouldPulse ? Infinity : 0 }}
                  style={{ transformOrigin: `${pos.cx}px ${pos.cy}px` }}
                />
              )}
              
              {/* Add target lines in scifi mode */}
              {sciFiMode && (
                <>
                  <line x1={pos.cx - pos.rx - 10} y1={pos.cy} x2={pos.cx - pos.rx} y2={pos.cy} stroke={color} strokeWidth="1" />
                  <line x1={pos.cx + pos.rx} y1={pos.cy} x2={pos.cx + pos.rx + 10} y2={pos.cy} stroke={color} strokeWidth="1" />
                </>
              )}

              <text x={pos.cx} y={pos.cy + 1} textAnchor="middle" dominantBaseline="central"
                fontSize={sciFiMode ? "6" : "8"} fill={sciFiMode ? color : "#fff"} fontWeight="600" pointerEvents="none" opacity={0.9} className={sciFiMode ? 'font-mono' : ''}>
                {pos.label.toUpperCase()}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="flex gap-3 mt-4 text-xs">
        {[{ label: 'None', color: '#1D9E75' }, { label: 'Mild', color: '#EF9F27' }, { label: 'Moderate', color: '#D85A30' }, { label: 'Severe', color: '#E24B4A' }].map(l => (
          <div key={l.label} className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: l.color }} />
            <span className="text-[var(--text-muted)]">{l.label}</span>
          </div>
        ))}
      </div>

      {/* Selected organ detail */}
      {selectedOrgan && organs[selectedOrgan] && (
        <motion.div
          className="mt-4 p-4 rounded-xl bg-[var(--bg-card)] border border-[var(--border-dim)] w-full max-w-xs"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-semibold capitalize">{selectedOrgan}</h4>
            <span className="text-xs px-2 py-1 rounded-full" style={{ background: scoreToColor(organs[selectedOrgan].effect_score) + '33', color: scoreToColor(organs[selectedOrgan].effect_score) }}>
              {scoreToLabel(organs[selectedOrgan].effect_score)} ({(organs[selectedOrgan].effect_score * 100).toFixed(0)}%)
            </span>
          </div>
          <p className="text-sm text-[var(--text-secondary)]">{organs[selectedOrgan].description || 'No description available'}</p>
        </motion.div>
      )}
    </div>
  );
}
