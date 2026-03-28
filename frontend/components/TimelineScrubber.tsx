'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface TimelineScrubberProps {
  timelineLength: number;
  currentIndex: number;
  onChange: (index: number) => void;
  labels: string[];
  sciFiMode?: boolean;
  /** Tighter layout for fixed-viewport dashboards */
  compact?: boolean;
}

export default function TimelineScrubber({ timelineLength, currentIndex, onChange, labels, sciFiMode = false, compact = false }: TimelineScrubberProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const indexRef = useRef(currentIndex);

  useEffect(() => {
    indexRef.current = currentIndex;
  }, [currentIndex]);

  const advance = useCallback(() => {
    const next = indexRef.current >= timelineLength - 1 ? 0 : indexRef.current + 1;
    onChange(next);
  }, [timelineLength, onChange]);

  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(advance, 1500);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isPlaying, advance]);

  return (
    <div className={sciFiMode ? (compact ? "w-full py-0" : "w-full") : "glass-card p-4 w-full"}>
      <div className={`flex items-center ${sciFiMode ? (compact ? 'gap-1.5 mb-1' : 'gap-2 mb-1.5') : 'gap-3 mb-3'}`}>
        <button onClick={() => setIsPlaying(!isPlaying)}
          className={`flex items-center justify-center font-bold transition ${sciFiMode ? (compact ? 'text-[var(--accent-cyan)] text-base hover:text-white' : 'text-[var(--accent-cyan)] text-lg hover:text-white') : 'w-9 h-9 rounded-full bg-[var(--accent-cyan)] text-black text-sm hover:brightness-110'}`}>
          {isPlaying ? '⏸' : '▶'}
        </button>
        <button onClick={() => { onChange(0); setIsPlaying(false); }}
          className={`flex items-center justify-center transition ${sciFiMode ? (compact ? 'text-[var(--accent-cyan)] text-base hover:text-white' : 'text-[var(--accent-cyan)] text-lg hover:text-white') : 'w-9 h-9 rounded-full bg-[var(--bg-card)] border border-[var(--border-dim)] text-[var(--text-muted)] text-sm hover:border-[var(--accent-cyan)]'}`}>
          {sciFiMode ? '⏮' : '↺'}
        </button>
        <span className={`flex-1 text-center font-mono ${sciFiMode ? (compact ? 'text-[11px] text-[var(--accent-amber)] font-semibold' : 'text-sm text-[var(--accent-amber)] font-bold') : 'text-lg font-semibold text-[var(--accent-cyan)]'}`}>
          {labels[currentIndex] ? (compact ? labels[currentIndex] : `${labels[currentIndex]}_ACTIVE`) : ''}
        </span>
        <span className={`font-mono ${sciFiMode ? (compact ? 'text-[9px] text-[var(--text-muted)]' : 'text-[8px] text-[var(--text-muted)]') : 'text-xs text-[var(--text-muted)]'}`}>
          {sciFiMode ? (compact ? `${currentIndex + 1}/${timelineLength}` : `PLAYBACK SPEED: 1.0X`) : `${currentIndex + 1}/${timelineLength}`}
        </span>
      </div>
      <div className={sciFiMode ? (compact ? 'relative pt-0.5' : 'relative pt-1') : 'relative pt-2'}>
        <input type="range" min={0} max={timelineLength - 1} value={currentIndex}
          onChange={e => { onChange(+e.target.value); setIsPlaying(false); }}
          className="w-full relative z-10" />
        
        {sciFiMode && !compact && (
          <div className="flex justify-between mt-1 px-1 text-[8px] text-[var(--text-muted)] font-mono leading-none">
            {labels.map((l, i) => (
              <span key={i} className={i === currentIndex ? "text-[var(--accent-cyan)]" : ""}>{l.replace(' hours', 'h').replace(' hour', 'h').replace(' min', 'm')}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
