import React, { useCallback, useEffect, useState } from 'react';
import ReactFlow, {
  Background, Controls, MiniMap, Panel,
  useNodesState, useEdgesState, useReactFlow,
  type Node, type Edge,
  MarkerType,
} from 'reactflow';
import dagre from 'dagre';
import 'reactflow/dist/style.css';

import { nodeTypes } from './CustomNodes';
import type { AnalyzeResult, FlowNodeData } from '../types/flow';

const NODE_W = 200;
const NODE_H = 70;

function applyDagreLayout(nodes: Node[], edges: Edge[]): Node[] {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'TB', ranksep: 70, nodesep: 40, marginx: 40, marginy: 40 });

  for (const node of nodes) {
    g.setNode(node.id, { width: NODE_W, height: NODE_H });
  }
  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }

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
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const { fitView } = useReactFlow();

  useEffect(() => {
    if (!result) { setNodes([]); setEdges([]); return; }

    const rawEdges: Edge[] = result.edges.map(e => ({
      ...e,
      type: 'smoothstep',
      style: {
        stroke: e.label === 'true' ? '#22c55e'
          : e.label === 'false' ? '#ef4444'
          : e.label === 'exception' || e.label === 'rescue' ? '#f97316'
          : '#4b5280',
        strokeWidth: 2,
      },
      labelStyle: { fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' },
      labelBgStyle: { fill: '#1a1d27', fillOpacity: 0.8 },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#4b5280' },
      animated: !!e.animated,
    }));

    const laid = applyDagreLayout(result.nodes as Node[], rawEdges);
    setNodes(laid);
    setEdges(rawEdges);

    setTimeout(() => fitView({ padding: 0.15, duration: 400 }), 50);
  }, [result]);

  const handleNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    onNodeClick(node.data as FlowNodeData);
  }, [onNodeClick]);

  const handlePaneClick = useCallback(() => onNodeClick(null), [onNodeClick]);

  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 select-none">
        <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
          <rect x="8" y="24" width="20" height="16" rx="4" fill="#2d3148" stroke="#4b5280" strokeWidth="1.5"/>
          <rect x="36" y="8" width="20" height="16" rx="4" fill="#2d3148" stroke="#4b5280" strokeWidth="1.5"/>
          <rect x="36" y="40" width="20" height="16" rx="4" fill="#2d3148" stroke="#4b5280" strokeWidth="1.5"/>
          <line x1="28" y1="32" x2="36" y2="16" stroke="#4b5280" strokeWidth="1.5"/>
          <line x1="28" y1="32" x2="36" y2="48" stroke="#4b5280" strokeWidth="1.5"/>
        </svg>
        <div className="text-center">
          <p className="text-slate-400 text-sm font-medium">Paste code and click Analyze</p>
          <p className="text-slate-600 text-xs mt-1">Flow graph will appear here</p>
        </div>
      </div>
    );
  }

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={handleNodeClick}
      onPaneClick={handlePaneClick}
      nodeTypes={nodeTypes}
      fitView
      minZoom={0.1}
      maxZoom={2}
      style={{ background: '#0f1117' }}
    >
      <Background color="#1e2235" gap={20} size={1} />
      <Controls />
      <MiniMap
        nodeColor={(n) => {
          const nt = (n.data as FlowNodeData)?.nodeType;
          const map: Record<string, string> = {
            method: '#6366f1', start: '#22c55e', end: '#ef4444',
            decision: '#f59e0b', switch: '#f59e0b', loop: '#f97316',
            return: '#16a34a', throw: '#dc2626', call: '#818cf8',
            try: '#7c3aed', catch: '#d97706', finally: '#3b82f6',
          };
          return map[nt] || '#3d4460';
        }}
        maskColor="#0f111788"
      />
      <Panel position="bottom-center">
        <div className="flex items-center gap-4 px-4 py-2 rounded-full text-[10px] text-slate-500"
          style={{ background: '#1a1d2799', border: '1px solid #2d3148' }}>
          <span className="flex items-center gap-1"><span style={{color:'#22c55e'}}>●</span> Start/End</span>
          <span className="flex items-center gap-1"><span style={{color:'#6366f1'}}>●</span> Method</span>
          <span className="flex items-center gap-1"><span style={{color:'#f59e0b'}}>◇</span> Decision</span>
          <span className="flex items-center gap-1"><span style={{color:'#f97316'}}>●</span> Loop</span>
          <span className="flex items-center gap-1"><span style={{color:'#818cf8'}}>●</span> Call</span>
          <span className="flex items-center gap-1"><span style={{color:'#dc2626'}}>●</span> Throw/Return</span>
        </div>
      </Panel>
    </ReactFlow>
  );
}
