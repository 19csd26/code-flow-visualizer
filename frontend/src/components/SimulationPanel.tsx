import React from 'react';
import {
  Play, Pause, SkipBack, SkipForward,
  ChevronFirst, ChevronLast, RotateCcw,
} from 'lucide-react';
import type { SimulationControls } from '../hooks/useSimulation';

const NODE_COLORS: Record<string, string> = {
  method:   '#6366f1', start: '#22c55e', end: '#f43f5e',
  declare:  '#64748b', process: '#94a3b8', call: '#8b5cf6',
  decision: '#f59e0b', switch: '#f59e0b', loop: '#fb923c',
  return:   '#2dd4bf', throw:  '#ef4444',
  try:      '#a855f7', catch:  '#eab308', finally: '#60a5fa',
};

const PHASE_COLORS: Record<string, string> = {
  'true branch':  '#22c55e',
  'false branch': '#ef4444',
  'loop body (iteration 1)': '#fb923c',
  'loop condition re-checked': '#fbbf24',
  'loop exit — condition false': '#94a3b8',
  'loop exit': '#94a3b8',
};

interface Props {
  sim: SimulationControls;
}

export default function SimulationPanel({ sim }: Props) {
  const { steps, current, isPlaying, speed, play, pause, reset, stepFwd, stepBwd, seek, setSpeed, isReady } = sim;

  if (!isReady) {
    return (
      <div className="flex items-center justify-center h-full text-slate-600 text-sm">
        Analyze code first to enable simulation
      </div>
    );
  }

  const step = steps[current];
  const progress = current < 0 ? 0 : ((current + 1) / steps.length) * 100;
  const accentColor = step ? (NODE_COLORS[step.nodeType] ?? '#6366f1') : '#6366f1';
  const phaseColor = step?.phase ? (PHASE_COLORS[step.phase] ?? '#94a3b8') : null;

  return (
    <div className="flex flex-col h-full select-none" style={{ fontFamily: 'Inter, sans-serif' }}>

      {/* Progress bar */}
      <div className="h-0.5 w-full shrink-0" style={{ background: '#1e2235' }}>
        <div
          className="h-full transition-all duration-300 ease-out"
          style={{ width: `${progress}%`, background: `linear-gradient(90deg, ${accentColor}88, ${accentColor})` }}
        />
      </div>

      {/* Step counter */}
      <div className="flex items-center justify-between px-4 py-2 shrink-0"
        style={{ borderBottom: '1px solid #1e2235' }}>
        <span className="text-xs text-slate-500 font-mono">
          {current < 0 ? 'Not started' : `Step ${current + 1} / ${steps.length}`}
        </span>
        {step?.line && (
          <span className="text-xs font-mono" style={{ color: accentColor }}>
            line {step.line}
          </span>
        )}
      </div>

      {/* Current step display */}
      <div className="px-4 py-4 shrink-0" style={{ borderBottom: '1px solid #1e2235', minHeight: 160 }}>
        {!step ? (
          <div className="flex flex-col items-center justify-center h-24 gap-2 text-slate-600">
            <div className="text-2xl">▷</div>
            <p className="text-xs">Press Play to start simulation</p>
          </div>
        ) : (
          <>
            {/* Node type badge */}
            <div className="flex items-center gap-2 mb-3">
              <span
                className="px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider"
                style={{ background: accentColor + '22', color: accentColor, border: `1px solid ${accentColor}44` }}
              >
                {step.nodeType}
              </span>
              {step.phase && (
                <span className="text-xs font-mono" style={{ color: phaseColor ?? '#64748b' }}>
                  → {step.phase}
                </span>
              )}
              {step.event && (
                <span className="text-xs px-2 py-0.5 rounded font-mono"
                  style={{ background: '#1e2235', color: '#64748b' }}>
                  {step.event}
                </span>
              )}
            </div>

            {/* Description */}
            <p className="text-sm font-medium mb-3" style={{ color: '#e2e8f0', lineHeight: 1.5 }}>
              {step.description}
            </p>

            {/* Code snippet */}
            {step.code && step.code !== step.label && (
              <pre
                className="text-xs rounded-lg px-3 py-2 overflow-x-auto"
                style={{ background: '#0a0c14', color: accentColor + 'cc', fontFamily: 'JetBrains Mono, monospace', border: `1px solid ${accentColor}22` }}
              >
                {step.code.length > 200 ? step.code.slice(0, 200) + '…' : step.code}
              </pre>
            )}
          </>
        )}
      </div>

      {/* Variable inspector (Ruby trace) */}
      {step?.locals && Object.keys(step.locals).length > 0 && (
        <div className="px-4 py-3 shrink-0 overflow-y-auto" style={{ maxHeight: 160, borderBottom: '1px solid #1e2235' }}>
          <p className="text-[10px] uppercase tracking-widest text-slate-600 mb-2">Variables</p>
          <div className="space-y-1.5">
            {Object.entries(step.locals).map(([k, v]) => (
              <div key={k} className="flex items-start gap-2 text-xs font-mono">
                <span style={{ color: '#818cf8', flexShrink: 0 }}>{k}</span>
                <span style={{ color: '#475569' }}>=</span>
                <span style={{ color: '#34d399', wordBreak: 'break-all' }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All steps list */}
      <div className="flex-1 overflow-y-auto">
        <p className="px-4 pt-3 text-[10px] uppercase tracking-widest text-slate-600 mb-1">Execution steps</p>
        {steps.map((s, i) => (
          <button
            key={i}
            onClick={() => seek(i)}
            className="w-full text-left px-4 py-1.5 flex items-center gap-3 transition-colors"
            style={{
              background: i === current ? accentColor + '18' : 'transparent',
              borderLeft: i === current ? `3px solid ${accentColor}` : '3px solid transparent',
            }}
          >
            <span className="text-[10px] font-mono w-7 text-right shrink-0"
              style={{ color: i === current ? accentColor : '#334155' }}>
              {i + 1}
            </span>
            <span
              className="text-xs font-mono truncate"
              style={{ color: i === current ? NODE_COLORS[s.nodeType] ?? '#e2e8f0' : i < current ? '#475569' : '#64748b' }}
            >
              {s.label}
            </span>
            {s.line && (
              <span className="text-[9px] shrink-0" style={{ color: '#2d3148' }}>:{s.line}</span>
            )}
          </button>
        ))}
      </div>

      {/* Controls */}
      <div className="shrink-0 px-4 py-3" style={{ borderTop: '1px solid #1e2235' }}>
        {/* Scrubber */}
        <input
          type="range" min={0} max={Math.max(0, steps.length - 1)} value={Math.max(0, current)}
          onChange={e => seek(Number(e.target.value))}
          className="w-full mb-3 accent-indigo-500"
          style={{ accentColor }}
        />

        {/* Buttons */}
        <div className="flex items-center justify-center gap-1.5">
          <button onClick={reset} title="Reset"
            className="p-2 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-slate-300 transition-colors">
            <RotateCcw size={15} />
          </button>
          <button onClick={() => seek(0)} title="First"
            className="p-2 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-slate-300 transition-colors">
            <ChevronFirst size={15} />
          </button>
          <button onClick={stepBwd} title="Back"
            className="p-2 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-slate-300 transition-colors">
            <SkipBack size={15} />
          </button>

          {/* Play / Pause */}
          <button
            onClick={isPlaying ? pause : play}
            className="px-5 py-2 rounded-xl font-semibold text-sm text-white transition-all"
            style={{ background: `linear-gradient(135deg, ${accentColor}cc, ${accentColor})`, boxShadow: `0 4px 14px ${accentColor}55` }}
          >
            {isPlaying ? <Pause size={16} /> : <Play size={16} />}
          </button>

          <button onClick={stepFwd} title="Next"
            className="p-2 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-slate-300 transition-colors">
            <SkipForward size={15} />
          </button>
          <button onClick={() => seek(steps.length - 1)} title="Last"
            className="p-2 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-slate-300 transition-colors">
            <ChevronLast size={15} />
          </button>
        </div>

        {/* Speed */}
        <div className="flex items-center gap-2 mt-2 text-[10px] text-slate-600">
          <span>Slow</span>
          <input type="range" min={100} max={1800} step={100} value={1900 - speed}
            onChange={e => setSpeed(1900 - Number(e.target.value))}
            className="flex-1" style={{ accentColor }} />
          <span>Fast</span>
        </div>
      </div>

    </div>
  );
}
