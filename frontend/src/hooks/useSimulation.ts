import { useState, useEffect, useRef, useCallback } from 'react';
import type { Edge } from '@xyflow/react';
import type { AppNode } from '../components/CustomNodes';
import type { FlowNodeData, TraceStep } from '../types/flow';

export interface SimStep {
  nodeId: string;
  nodeType: string;
  label: string;
  code: string;
  line?: number;
  description: string;
  phase?: string;       // 'true branch' | 'false branch' | 'loop body' | 'loop exit'
  locals?: Record<string, string>; // Ruby trace variables
  event?: string;       // Ruby trace event
}

const DESCRIPTIONS: Record<string, (label: string) => string> = {
  method:   l => `▶ Entering method "${l}"`,
  start:    _  => `✦ Execution begins`,
  end:      _  => `■ Execution complete — method returns`,
  declare:  l => `📌 Declaring variable → ${l}`,
  process:  l => `⟳ Executing statement → ${l}`,
  call:     l => `📞 Calling → ${l}`,
  decision: l => `? Evaluating condition → ${l}`,
  switch:   l => `⊞ Evaluating switch → ${l}`,
  loop:     l => `↺ Checking loop condition → ${l}`,
  return:   l => `↩ Returning → ${l}`,
  throw:    l => `⚡ Throwing exception → ${l}`,
  try:      _  => `⊙ Entering try block`,
  catch:    l => `⊘ Exception caught — ${l}`,
  finally:  _  => `⊕ Executing finally block`,
  case:     l => `▸ Case branch → ${l}`,
};

function describeStep(nodeType: string, label: string, phase?: string): string {
  const base = (DESCRIPTIONS[nodeType] ?? (l => `Processing: ${l}`))(label);
  if (phase) return `${base}  [${phase}]`;
  return base;
}

/**
 * Build an ordered list of simulation steps from the CFG nodes+edges.
 * Strategy: topological walk (DFS) per method, following forward edges only.
 * Decision nodes: true branch first, then false branch.
 * Loop nodes: body once, then exit.
 */
function buildSimSteps(nodes: AppNode[], edges: Edge[]): SimStep[] {
  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  // Only forward edges (exclude animated loop-backs)
  const fwdEdges = edges.filter(e => !e.animated);
  const adj = new Map<string, { target: string; label: string }[]>();
  for (const e of fwdEdges) {
    if (!adj.has(e.source)) adj.set(e.source, []);
    adj.get(e.source)!.push({ target: e.target, label: (e.label as string) || '' });
  }

  const steps: SimStep[] = [];
  const methods = nodes.filter(n => n.data.nodeType === 'method');

  // Sort methods by vertical position (top to bottom on canvas)
  methods.sort((a, b) => a.position.y - b.position.y);

  for (const method of methods) {
    const visited = new Set<string>();

    function visit(nodeId: string, phase?: string) {
      if (visited.has(nodeId)) return;
      const node = nodeMap.get(nodeId);
      if (!node) return;

      const nt = node.data.nodeType as string;
      // Don't cross into another method's subgraph
      if (nt === 'method' && nodeId !== method.id) return;

      visited.add(nodeId);

      steps.push({
        nodeId,
        nodeType: nt,
        label: node.data.label as string,
        code: (node.data.code || node.data.label) as string,
        line: node.data.line as number | undefined,
        description: describeStep(nt, node.data.label as string, phase),
        phase,
      });

      const nexts = adj.get(nodeId) ?? [];

      if (nt === 'decision' || nt === 'switch') {
        const trueNext  = nexts.filter(n => n.label === 'true'  || n.label === 'body' || n.label === 'each');
        const falseNext = nexts.filter(n => n.label === 'false');
        const rest      = nexts.filter(n => !['true','false','body','each'].includes(n.label));
        for (const n of trueNext)  visit(n.target, 'true branch');
        for (const n of falseNext) visit(n.target, 'false branch');
        for (const n of rest)      visit(n.target);

      } else if (nt === 'loop') {
        const bodyNext = nexts.filter(n => !n.label || n.label === 'body' || n.label === 'each' || n.label === 'true');
        const exitNext = nexts.filter(n => n.label === 'false');
        for (const n of bodyNext) visit(n.target, 'loop body (iteration 1)');
        // Simulate one more condition check
        steps.push({ ...steps[steps.length - (bodyNext.length > 0 ? 1 : 0)]!, nodeId, description: describeStep('loop', node.data.label as string, 'loop condition re-checked'), phase: 'loop exit' });
        for (const n of exitNext) visit(n.target, 'loop exit — condition false');

      } else {
        for (const n of nexts) visit(n.target, phase);
      }
    }

    visit(method.id);
  }

  return steps;
}

/**
 * Merge Ruby TracePoint steps with CFG sim steps:
 * For each trace step, find a CFG node on the same line and annotate it with locals.
 */
function mergeTrace(simSteps: SimStep[], traceSteps: TraceStep[]): SimStep[] {
  const lineToStep = new Map<number, TraceStep>();
  for (const t of traceSteps) if (t.line > 0) lineToStep.set(t.line, t);

  return simSteps.map(s => {
    if (!s.line) return s;
    const trace = lineToStep.get(s.line);
    if (!trace) return s;
    return { ...s, locals: trace.locals, event: trace.event };
  });
}

export interface SimulationControls {
  steps: SimStep[];
  current: number;
  activeNodeId: string | null;
  isPlaying: boolean;
  speed: number;

  play:    () => void;
  pause:   () => void;
  reset:   () => void;
  stepFwd: () => void;
  stepBwd: () => void;
  seek:    (i: number) => void;
  setSpeed: (s: number) => void;
  isReady: boolean;
}

export function useSimulation(
  nodes: AppNode[],
  edges: Edge[],
  traceSteps?: TraceStep[]
): SimulationControls {
  const [steps, setSteps]       = useState<SimStep[]>([]);
  const [current, setCurrent]   = useState(-1);
  const [isPlaying, setPlaying] = useState(false);
  const [speed, setSpeed]       = useState(800);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Rebuild steps when graph changes
  useEffect(() => {
    if (nodes.length === 0) { setSteps([]); setCurrent(-1); return; }
    let s = buildSimSteps(nodes, edges);
    if (traceSteps && traceSteps.length > 0) s = mergeTrace(s, traceSteps);
    setSteps(s);
    setCurrent(-1);
    setPlaying(false);
  }, [nodes.length, edges.length, traceSteps]);

  // Playback timer
  useEffect(() => {
    if (!isPlaying) { if (timerRef.current) clearTimeout(timerRef.current); return; }

    timerRef.current = setTimeout(() => {
      setCurrent(c => {
        if (c >= steps.length - 1) { setPlaying(false); return c; }
        return c + 1;
      });
    }, speed);

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [isPlaying, current, speed, steps.length]);

  const play    = useCallback(() => { if (current >= steps.length - 1) setCurrent(0); setPlaying(true); }, [current, steps.length]);
  const pause   = useCallback(() => setPlaying(false), []);
  const reset   = useCallback(() => { setPlaying(false); setCurrent(-1); }, []);
  const stepFwd = useCallback(() => { setPlaying(false); setCurrent(c => Math.min(steps.length - 1, c + 1)); }, [steps.length]);
  const stepBwd = useCallback(() => { setPlaying(false); setCurrent(c => Math.max(0, c - 1)); }, []);
  const seek    = useCallback((i: number) => { setPlaying(false); setCurrent(i); }, []);

  return {
    steps,
    current,
    activeNodeId: steps[current]?.nodeId ?? null,
    isPlaying,
    speed,
    play, pause, reset, stepFwd, stepBwd, seek, setSpeed,
    isReady: steps.length > 0,
  };
}
