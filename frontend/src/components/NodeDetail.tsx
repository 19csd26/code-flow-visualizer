import React from 'react';
import { X, Code2, Hash } from 'lucide-react';
import type { FlowNodeData } from '../types/flow';

interface Props {
  data: FlowNodeData | null;
  onClose: () => void;
}

export default function NodeDetail({ data, onClose }: Props) {
  if (!data) return null;

  return (
    <div
      className="absolute right-4 top-4 z-50 w-72 rounded-xl overflow-hidden shadow-2xl"
      style={{ background: '#1a1d27', border: '1px solid #2d3148' }}
    >
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid #2d3148' }}>
        <div className="flex items-center gap-2">
          <Code2 size={14} className="text-indigo-400" />
          <span className="text-sm font-semibold text-slate-200 capitalize">{data.nodeType}</span>
        </div>
        <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
          <X size={14} />
        </button>
      </div>

      <div className="p-4 space-y-3">
        <div>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Label</p>
          <p className="text-sm text-slate-200 font-mono">{data.label}</p>
        </div>

        {data.line && (
          <div className="flex items-center gap-2">
            <Hash size={12} className="text-slate-500" />
            <span className="text-xs text-slate-400">Line {data.line}</span>
          </div>
        )}

        {(data.code || data.fullCode) && (
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Code</p>
            <pre
              className="text-xs p-3 rounded-lg overflow-x-auto leading-relaxed"
              style={{ background: '#0f1117', color: '#e2e8f0', fontFamily: 'monospace', maxHeight: 200 }}
            >
              {data.fullCode || data.code}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
