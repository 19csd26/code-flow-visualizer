import React, { useCallback, useEffect } from 'react';
import {
  ReactFlow, Background, BackgroundVariant,
  Controls, MiniMap, Panel,
  useNodesState, useEdgesState, useReactFlow,
  type Node, type Edge,
  MarkerType, ConnectionLineType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';

import { nodeTypes, type AppNode } from './CustomNodes';
import type { AnalyzeResult, FlowNodeData } from '../types/flow';

const NODE_W = 200;
const NODE_H = 72;

function applyDagreLayout(nodes: AppNode[], edges: Edge[]): AppNode[] {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'TB', ranksep: 80, nodesep: 55, marginx: 60, marginy: 60 });

  for (const node of nodes) g.setNode(node.id, { width: NODE_W, height: NODE_H });
  for (const edge of edges) g.setEdge(edge.source, edge.target);

  dagre.layout(g);

  return nodes.map(node => {
    const pos = g.node(node.id);
    return { ...node, position: { x: pos.x - NODE_W / 2, y: pos.y - NODE_H / 2 } };
  });
}

interface Props {
  result: AnalyzeResult | null;
  onNodeClick: (data: FlowNodeData | null) => void;
}

export default function FlowVisualizer({ result, onNodeClick }: Props) {
  const [nodes, setNodes, onNodesChange] = useNodesState<AppNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const { fitView } = useReactFlow();

  useEffect(() => {
    if (!result) { setNodes([]); setEdges([]); return; }

    const styledEdges: Edge[] = result.edges.map(e => {
      const isLoop = !!e.animated;
      const isFalse = e.label === 'false';
      const isTrue = e.label === 'true';
      const isException = e.label === 'exception' || e.label === 'rescue';

      const color = isTrue ? '#22c55e'
        : isFalse ? '#ef4444'
        : isException ? '#fb923c'
        : isLoop ? '#a855f7'
        : '#4b5580';

      return {
        ...e,
        type: isLoop ? 'smoothstep' : 'smoothstep',
        animated: isLoop,
        style: { stroke: color, strokeWidth: isLoop ? 1.5 : 2 },
        labelStyle: { fill: color, fontSize: 10, fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 },
        labelBgStyle: { fill: '#0f1117', fillOpacity: 0.85, rx: 4 },
        labelBgPadding: [4, 6] as [number, number],
        markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color },
      };
    });

    const rawNodes = result.nodes as unknown as AppNode[];
    const laid = applyDagreLayout(rawNodes, styledEdges);
    setNodes(laid);
    setEdges(styledEdges);
    setTimeout(() => fitView({ padding: 0.15, duration: 500 }), 80);
  }, [result]);

  const handleNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    onNodeClick(node.data as unknown as FlowNodeData);
  }, [onNodeClick]);

  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-5 select-none">
        <div style={{ position: 'relative', width: 80, height: 80 }}>
          <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
            {/* Animated glow ring */}
            <circle cx="40" cy="40" r="36" stroke="#6366f120" strokeWidth="1" fill="none" />
            {/* Nodes */}
            <rect x="26" y="10" width="28" height="18" rx="6" fill="#312e81" stroke="#6366f1" strokeWidth="1.5"/>
            <rect x="8" y="52" width="28" height="18" rx="6" fill="#1e2235" stroke="#475569" strokeWidth="1.5"/>
            <rect x="44" y="52" width="28" height="18" rx="6" fill="#422006" stroke="#f59e0b" strokeWidth="1.5"/>
            {/* Edges */}
            <line x1="40" y1="28" x2="22" y2="52" stroke="#4b5580" strokeWidth="1.5"/>
            <line x1="40" y1="28" x2="58" y2="52" stroke="#f59e0b" strokeWidth="1.5"/>
            {/* Arrow heads */}
            <polygon points="22,52 18,46 26,46" fill="#4b5580"/>
            <polygon points="58,52 54,46 62,46" fill="#f59e0b"/>
          </svg>
        </div>
        <div className="text-center">
          <p className="text-slate-400 text-sm font-semibold">Paste your code and click Analyze</p>
          <p className="text-slate-600 text-xs mt-1">Interactive flow graph will appear here</p>
        </div>
      </div>
    );
  }

  return (
    <ReactFlow
      nodes={nodes as Node[]}
      edges={edges}
      onNodesChange={onNodesChange as Parameters<typeof ReactFlow>[0]['onNodesChange']}
      onEdgesChange={onEdgesChange}
      onNodeClick={handleNodeClick}
      onPaneClick={() => onNodeClick(null)}
      nodeTypes={nodeTypes}
      connectionLineType={ConnectionLineType.SmoothStep}
      fitView
      minZoom={0.08}
      maxZoom={2.5}
      style={{ background: '#0a0c14' }}
    >
      <Background
        variant={BackgroundVariant.Dots}
        gap={24}
        size={1.2}
        color="#1e2235"
      />
      <Controls
        style={{ background: '#1a1d27', border: '1px solid #2d3148', borderRadius: 10 }}
      />
      <MiniMap
        style={{ background: '#1a1d27', border: '1px solid #2d3148', borderRadius: 10 }}
        nodeColor={(n) => {
          const nt = (n.data as FlowNodeData)?.nodeType;
          const map: Record<string, string> = {
            method: '#6366f1', start: '#22c55e', end: '#f43f5e',
            decision: '#f59e0b', switch: '#f59e0b', loop: '#fb923c',
            return: '#2dd4bf', throw: '#ef4444', call: '#8b5cf6',
            try: '#a855f7', catch: '#eab308', finally: '#60a5fa',
          };
          return map[nt] || '#334155';
        }}
        maskColor="#0a0c1488"
        pannable
        zoomable
      />

      {/* Legend */}
      <Panel position="bottom-center">
        <div className="flex items-center gap-3 px-5 py-2.5 text-[10px] font-medium"
          style={{ background: '#1a1d27cc', border: '1px solid #2d3148', borderRadius: 999, backdropFilter: 'blur(8px)', color: '#64748b' }}>
          {[
            { color: '#22c55e', label: 'Start/End' },
            { color: '#6366f1', label: 'Method' },
            { color: '#f59e0b', label: 'Decision' },
            { color: '#fb923c', label: 'Loop' },
            { color: '#8b5cf6', label: 'Call' },
            { color: '#2dd4bf', label: 'Return' },
            { color: '#ef4444', label: 'Throw' },
            { color: '#a855f7', label: 'Try/Catch' },
          ].map(({ color, label }) => (
            <span key={label} className="flex items-center gap-1.5">
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, display: 'inline-block' }} />
              {label}
            </span>
          ))}
        </div>
      </Panel>
    </ReactFlow>
  );
}
