import React, { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import type { FlowNodeData, NodeType } from '../types/flow';

const nodeStyles: Record<NodeType, { bg: string; border: string; text: string; shape?: string }> = {
  method:   { bg: '#312e81', border: '#6366f1', text: '#c7d2fe', shape: 'rounded-lg' },
  start:    { bg: '#14532d', border: '#22c55e', text: '#86efac', shape: 'rounded-full' },
  end:      { bg: '#7f1d1d', border: '#ef4444', text: '#fca5a5', shape: 'rounded-full' },
  process:  { bg: '#1e2235', border: '#3d4460', text: '#e2e8f0', shape: 'rounded' },
  declare:  { bg: '#1e293b', border: '#475569', text: '#cbd5e1', shape: 'rounded' },
  call:     { bg: '#1e1b4b', border: '#818cf8', text: '#c7d2fe', shape: 'rounded' },
  decision: { bg: '#422006', border: '#f59e0b', text: '#fde68a', shape: 'diamond' },
  switch:   { bg: '#422006', border: '#f59e0b', text: '#fde68a', shape: 'diamond' },
  loop:     { bg: '#431407', border: '#f97316', text: '#fed7aa', shape: 'rounded' },
  return:   { bg: '#052e16', border: '#16a34a', text: '#86efac', shape: 'rounded' },
  throw:    { bg: '#450a0a', border: '#dc2626', text: '#fca5a5', shape: 'rounded' },
  try:      { bg: '#1e1b4b', border: '#7c3aed', text: '#ddd6fe', shape: 'rounded' },
  catch:    { bg: '#2d1b00', border: '#d97706', text: '#fde68a', shape: 'rounded' },
  finally:  { bg: '#1e3a5f', border: '#3b82f6', text: '#93c5fd', shape: 'rounded' },
  case:     { bg: '#0c1a0c', border: '#4ade80', text: '#86efac', shape: 'rounded' },
};

const icons: Record<NodeType, string> = {
  method:   '⚙',
  start:    '▶',
  end:      '■',
  process:  '◈',
  declare:  '≡',
  call:     '⤙',
  decision: '◇',
  switch:   '⊞',
  loop:     '↺',
  return:   '↩',
  throw:    '⚡',
  try:      '⊙',
  catch:    '⊘',
  finally:  '⊕',
  case:     '▸',
};

function DiamondNode({ data, selected }: { data: FlowNodeData; selected: boolean }) {
  const s = nodeStyles[data.nodeType] || nodeStyles.process;
  return (
    <div className="relative flex items-center justify-center" style={{ width: 130, height: 70 }}>
      <Handle type="target" position={Position.Top} style={{ background: s.border, top: 5 }} />
      <svg width="130" height="70" className="absolute inset-0">
        <polygon
          points="65,4 126,35 65,66 4,35"
          fill={s.bg}
          stroke={selected ? '#fff' : s.border}
          strokeWidth={selected ? 2 : 1.5}
        />
      </svg>
      <div className="relative z-10 px-2 text-center" style={{ maxWidth: 110 }}>
        <span className="text-xs font-semibold leading-tight" style={{ color: s.text }}>
          {icons[data.nodeType]} {data.label}
        </span>
      </div>
      <Handle type="source" position={Position.Bottom} style={{ background: s.border, bottom: 5 }} />
      <Handle type="source" id="false" position={Position.Right} style={{ background: '#ef4444', right: 2 }} />
    </div>
  );
}

function StandardNode({ data, selected }: { data: FlowNodeData; selected: boolean }) {
  const nt = data.nodeType as NodeType;
  const s = nodeStyles[nt] || nodeStyles.process;
  const isTerminal = nt === 'start' || nt === 'end';
  const isMethod = nt === 'method';

  return (
    <div
      className="relative"
      style={{
        minWidth: isMethod ? 160 : 140,
        maxWidth: 240,
        background: s.bg,
        border: `${selected ? 2 : 1.5}px solid ${selected ? '#fff' : s.border}`,
        borderRadius: isTerminal ? 999 : isMethod ? 10 : 6,
        boxShadow: selected ? `0 0 0 2px ${s.border}40` : 'none',
        transition: 'box-shadow 0.15s',
      }}
    >
      {!isTerminal && <Handle type="target" position={Position.Top} style={{ background: s.border }} />}

      <div className="px-3 py-2">
        {isMethod && (
          <div className="text-[10px] mb-1" style={{ color: s.border }}>
            METHOD
          </div>
        )}
        <div className="flex items-start gap-1.5">
          <span style={{ color: s.border, fontSize: 11, lineHeight: 1.6, flexShrink: 0 }}>
            {icons[nt]}
          </span>
          <span
            className="font-mono text-xs font-medium leading-relaxed break-all"
            style={{ color: s.text }}
          >
            {data.label}
          </span>
        </div>
        {data.line && (
          <div className="mt-1 text-[10px]" style={{ color: s.border + 'aa' }}>
            line {data.line}
          </div>
        )}
      </div>

      {!isTerminal && <Handle type="source" position={Position.Bottom} style={{ background: s.border }} />}
    </div>
  );
}

export const CustomNode = memo(({ data, selected }: NodeProps<FlowNodeData>) => {
  const nt = data.nodeType as NodeType;
  const s = nodeStyles[nt] || nodeStyles.process;
  if (s.shape === 'diamond') {
    return <DiamondNode data={data} selected={!!selected} />;
  }
  return <StandardNode data={data} selected={!!selected} />;
});

CustomNode.displayName = 'CustomNode';

export const nodeTypes = { custom: CustomNode };
