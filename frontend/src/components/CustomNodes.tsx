import React, { memo } from 'react';
import { Handle, Position, NodeToolbar, type NodeProps, type Node } from '@xyflow/react';
import type { FlowNodeData, NodeType } from '../types/flow';

export type AppNode = Node<FlowNodeData, 'custom'>;

interface StyleDef {
  gradient: string;
  border: string;
  text: string;
  glow: string;
  badge: string;
}

const styles: Record<NodeType, StyleDef> = {
  method:   { gradient: 'from-indigo-950 to-indigo-900',   border: '#6366f1', text: '#c7d2fe', glow: '#6366f140', badge: '#4f46e5' },
  start:    { gradient: 'from-emerald-950 to-emerald-900', border: '#22c55e', text: '#86efac', glow: '#22c55e40', badge: '#16a34a' },
  end:      { gradient: 'from-rose-950 to-rose-900',       border: '#f43f5e', text: '#fda4af', glow: '#f43f5e40', badge: '#e11d48' },
  process:  { gradient: 'from-slate-900 to-slate-800',     border: '#475569', text: '#cbd5e1', glow: '#47556920', badge: '#334155' },
  declare:  { gradient: 'from-slate-900 to-slate-800',     border: '#64748b', text: '#94a3b8', glow: '#64748b20', badge: '#475569' },
  call:     { gradient: 'from-violet-950 to-violet-900',   border: '#8b5cf6', text: '#ddd6fe', glow: '#8b5cf640', badge: '#7c3aed' },
  decision: { gradient: 'from-amber-950 to-amber-900',     border: '#f59e0b', text: '#fde68a', glow: '#f59e0b40', badge: '#d97706' },
  switch:   { gradient: 'from-amber-950 to-amber-900',     border: '#f59e0b', text: '#fde68a', glow: '#f59e0b40', badge: '#d97706' },
  loop:     { gradient: 'from-orange-950 to-orange-900',   border: '#fb923c', text: '#fed7aa', glow: '#fb923c40', badge: '#ea580c' },
  return:   { gradient: 'from-teal-950 to-teal-900',       border: '#2dd4bf', text: '#99f6e4', glow: '#2dd4bf40', badge: '#0d9488' },
  throw:    { gradient: 'from-red-950 to-red-900',         border: '#ef4444', text: '#fca5a5', glow: '#ef444440', badge: '#dc2626' },
  try:      { gradient: 'from-purple-950 to-purple-900',   border: '#a855f7', text: '#e9d5ff', glow: '#a855f740', badge: '#9333ea' },
  catch:    { gradient: 'from-yellow-950 to-yellow-900',   border: '#eab308', text: '#fef08a', glow: '#eab30840', badge: '#ca8a04' },
  finally:  { gradient: 'from-blue-950 to-blue-900',       border: '#60a5fa', text: '#bfdbfe', glow: '#60a5fa40', badge: '#2563eb' },
  case:     { gradient: 'from-slate-900 to-slate-800',     border: '#4ade80', text: '#bbf7d0', glow: '#4ade8040', badge: '#16a34a' },
};

const icons: Record<NodeType, string> = {
  method: '⚙', start: '▶', end: '■',
  process: '◈', declare: '≡', call: '⤙',
  decision: '◇', switch: '⊞', loop: '↺',
  return: '↩', throw: '⚡',
  try: '⊙', catch: '⊘', finally: '⊕', case: '▸',
};

const labels: Record<NodeType, string> = {
  method: 'METHOD', start: 'START', end: 'END',
  process: 'STATEMENT', declare: 'DECLARE', call: 'CALL',
  decision: 'IF / ELSE', switch: 'SWITCH', loop: 'LOOP',
  return: 'RETURN', throw: 'THROW',
  try: 'TRY', catch: 'CATCH', finally: 'FINALLY', case: 'CASE',
};

function DiamondNode({ data, selected }: { data: FlowNodeData; selected: boolean }) {
  const s = styles[data.nodeType] || styles.process;
  const W = 148, H = 80;

  return (
    <div style={{ width: W, height: H, position: 'relative' }}>
      <Handle type="target" position={Position.Top}
        style={{ background: s.border, width: 8, height: 8, border: `2px solid ${s.border}` }} />

      <svg width={W} height={H} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
        <defs>
          <filter id={`glow-${data.nodeType}`}>
            <feGaussianBlur stdDeviation={selected ? 4 : 2} result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        {selected && (
          <polygon points={`${W/2},6 ${W-6},${H/2} ${W/2},${H-6} 6,${H/2}`}
            fill="none" stroke={s.border} strokeWidth={3} opacity={0.4}
            style={{ filter: `drop-shadow(0 0 8px ${s.border})` }} />
        )}
        <polygon points={`${W/2},8 ${W-8},${H/2} ${W/2},${H-8} 8,${H/2}`}
          fill={`url(#diamond-grad-${data.nodeType})`}
          stroke={s.border} strokeWidth={selected ? 2 : 1.5}
          style={{ filter: selected ? `drop-shadow(0 0 6px ${s.border})` : 'none' }}
        />
        <defs>
          <linearGradient id={`diamond-grad-${data.nodeType}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={s.glow.replace('40', '80')} />
            <stop offset="100%" stopColor="#0f1117" />
          </linearGradient>
        </defs>
      </svg>

      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 12px' }}>
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', color: s.border, marginBottom: 2, fontFamily: 'Inter, sans-serif' }}>
          {icons[data.nodeType]} {labels[data.nodeType]}
        </div>
        <div style={{ fontSize: 11, fontWeight: 600, color: s.text, textAlign: 'center', lineHeight: 1.3, fontFamily: 'JetBrains Mono, monospace', wordBreak: 'break-all', maxWidth: 110 }}>
          {data.label}
        </div>
      </div>

      <Handle type="source" position={Position.Bottom}
        style={{ background: s.border, width: 8, height: 8, border: `2px solid ${s.border}` }} />
      <Handle type="source" id="right" position={Position.Right}
        style={{ background: '#ef4444', width: 8, height: 8, border: '2px solid #ef4444' }} />
    </div>
  );
}

function StandardNode({ data, selected }: { data: FlowNodeData; selected: boolean }) {
  const nt = data.nodeType as NodeType;
  const s = styles[nt] || styles.process;
  const isTerminal = nt === 'start' || nt === 'end';
  const isMethod = nt === 'method';

  return (
    <>
      <NodeToolbar isVisible={selected} position={Position.Top} style={{ background: '#1e2235', border: `1px solid ${s.border}`, borderRadius: 6, padding: '4px 10px', fontSize: 11, color: s.text, fontFamily: 'monospace', maxWidth: 300, wordBreak: 'break-all', zIndex: 1000 }}>
        {data.code || data.label}
      </NodeToolbar>

      <div
        style={{
          minWidth: isMethod ? 180 : 150,
          maxWidth: 250,
          background: `linear-gradient(135deg, ${s.glow.replace('40', '30')}, #0f1117)`,
          border: `${selected ? 2 : 1.5}px solid ${s.border}`,
          borderRadius: isTerminal ? 999 : isMethod ? 12 : 8,
          boxShadow: selected
            ? `0 0 0 3px ${s.glow}, 0 8px 24px ${s.glow}, inset 0 1px 0 ${s.border}40`
            : `0 2px 8px #00000060, inset 0 1px 0 ${s.border}20`,
          transition: 'box-shadow 0.2s, border-color 0.2s',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Subtle top highlight line */}
        <div style={{ position: 'absolute', top: 0, left: '10%', right: '10%', height: 1, background: `linear-gradient(90deg, transparent, ${s.border}60, transparent)` }} />

        {!isTerminal && <Handle type="target" position={Position.Top}
          style={{ background: s.border, width: 8, height: 8, border: `2px solid ${s.border}`, top: -5 }} />}

        <div style={{ padding: isTerminal ? '6px 20px' : '8px 12px' }}>
          {/* Badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: isTerminal ? 0 : 4 }}>
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', color: s.border, fontFamily: 'Inter, sans-serif' }}>
              {icons[nt]}
            </span>
            {!isTerminal && (
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', color: s.border, fontFamily: 'Inter, sans-serif' }}>
                {labels[nt]}
              </span>
            )}
            {data.line && !isTerminal && (
              <span style={{ marginLeft: 'auto', fontSize: 9, color: s.border + '88', fontFamily: 'monospace' }}>
                :{data.line}
              </span>
            )}
          </div>

          {/* Label */}
          <div style={{
            fontSize: isTerminal ? 12 : 11,
            fontWeight: isTerminal ? 700 : 600,
            color: s.text,
            fontFamily: isMethod ? 'Inter, sans-serif' : 'JetBrains Mono, monospace',
            lineHeight: 1.4,
            wordBreak: 'break-all',
            textAlign: isTerminal ? 'center' : 'left',
          }}>
            {data.label}
          </div>
        </div>

        {!isTerminal && <Handle type="source" position={Position.Bottom}
          style={{ background: s.border, width: 8, height: 8, border: `2px solid ${s.border}`, bottom: -5 }} />}
      </div>
    </>
  );
}

export const CustomNode = memo(({ data, selected }: NodeProps<AppNode>) => {
  const nt = data.nodeType as NodeType;
  const s = styles[nt] || styles.process;
  if (s && (nt === 'decision' || nt === 'switch')) {
    return <DiamondNode data={data} selected={!!selected} />;
  }
  return <StandardNode data={data} selected={!!selected} />;
});

CustomNode.displayName = 'CustomNode';

export const nodeTypes = { custom: CustomNode };
