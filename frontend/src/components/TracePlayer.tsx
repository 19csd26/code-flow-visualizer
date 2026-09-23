import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, SkipBack, SkipForward, ChevronFirst, ChevronLast } from 'lucide-react';
import type { TraceStep } from '../types/flow';

interface Props {
  steps: TraceStep[];
  highlightLine: (line: number | null) => void;
}

const EVENT_COLORS: Record<string, string> = {
  line:   '#818cf8',
  call:   '#22c55e',
  return: '#f59e0b',
  raise:  '#ef4444',
  error:  '#ef4444',
};

export default function TracePlayer({ steps, highlightLine }: Props) {
  const [current, setCurrent] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(600);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const step = steps[current];

  useEffect(() => {
    highlightLine(step?.line ?? null);
  }, [current, step]);

  useEffect(() => {
    if (playing) {
      intervalRef.current = setInterval(() => {
        setCurrent(c => {
          if (c >= steps.length - 1) { setPlaying(false); return c; }
          return c + 1;
        });
      }, speed);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [playing, speed, steps.length]);

  if (!steps.length) return null;

  const progress = ((current + 1) / steps.length) * 100;

  return (
    <div className="flex flex-col h-full" style={{ fontFamily: 'Inter, sans-serif' }}>
      {/* Progress bar */}
      <div className="h-1 w-full" style={{ background: '#2d3148' }}>
        <div
          className="h-full transition-all duration-200"
          style={{ width: `${progress}%`, background: '#6366f1' }}
        />
      </div>

      {/* Current step */}
      <div className="p-3" style={{ borderBottom: '1px solid #2d3148' }}>
        <div className="flex items-center gap-2 mb-2">
          <span
            className="px-2 py-0.5 rounded text-xs font-mono font-semibold"
            style={{ background: EVENT_COLORS[step?.event] + '22', color: EVENT_COLORS[step?.event] || '#818cf8' }}
          >
            {step?.event?.toUpperCase()}
          </span>
          <span className="text-xs text-slate-500">
            Step {current + 1} / {steps.length}
          </span>
          {step?.line > 0 && (
            <span className="text-xs text-slate-600">line {step.line}</span>
          )}
          {step?.method_id && (
            <span className="text-xs text-indigo-400 font-mono">{step.method_id}()</span>
          )}
        </div>
        {step?.source && (
          <pre className="text-xs font-mono p-2 rounded" style={{ background: '#0f1117', color: '#c7d2fe' }}>
            {step.source}
          </pre>
        )}
      </div>

      {/* Variables */}
      <div className="flex-1 overflow-y-auto p-3">
        <p className="text-[10px] uppercase tracking-wider text-slate-600 mb-2">Variables</p>
        {Object.keys(step?.locals || {}).length === 0 ? (
          <p className="text-xs text-slate-600 italic">No local variables</p>
        ) : (
          <div className="space-y-1">
            {Object.entries(step?.locals || {}).map(([k, v]) => (
              <div key={k} className="flex items-start gap-2 text-xs font-mono">
                <span className="text-indigo-400 shrink-0">{k}</span>
                <span className="text-slate-500">=</span>
                <span className="text-emerald-400 break-all">{v}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="p-3 flex flex-col gap-2" style={{ borderTop: '1px solid #2d3148' }}>
        {/* Scrubber */}
        <input
          type="range"
          min={0}
          max={steps.length - 1}
          value={current}
          onChange={e => { setPlaying(false); setCurrent(Number(e.target.value)); }}
          className="w-full accent-indigo-500"
        />

        {/* Buttons */}
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => { setPlaying(false); setCurrent(0); }} title="First"
            className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors">
            <ChevronFirst size={16} />
          </button>
          <button onClick={() => { setPlaying(false); setCurrent(c => Math.max(0, c - 1)); }} title="Back"
            className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors">
            <SkipBack size={16} />
          </button>
          <button
            onClick={() => setPlaying(p => !p)}
            className="px-4 py-1.5 rounded-lg text-white font-semibold text-sm transition-colors"
            style={{ background: playing ? '#7c3aed' : '#4f46e5' }}
          >
            {playing ? <Pause size={16} /> : <Play size={16} />}
          </button>
          <button onClick={() => { setPlaying(false); setCurrent(c => Math.min(steps.length - 1, c + 1)); }} title="Forward"
            className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors">
            <SkipForward size={16} />
          </button>
          <button onClick={() => { setPlaying(false); setCurrent(steps.length - 1); }} title="Last"
            className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors">
            <ChevronLast size={16} />
          </button>
        </div>

        {/* Speed */}
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>Slow</span>
          <input type="range" min={100} max={1500} step={100} value={1600 - speed}
            onChange={e => setSpeed(1600 - Number(e.target.value))}
            className="flex-1 accent-indigo-500" />
          <span>Fast</span>
        </div>
      </div>
    </div>
  );
}
