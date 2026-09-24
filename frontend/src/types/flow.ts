export type Language = 'java' | 'ruby';

export type NodeType =
  | 'method' | 'start' | 'end'
  | 'process' | 'declare' | 'call'
  | 'decision' | 'switch'
  | 'loop'
  | 'return' | 'throw'
  | 'try' | 'catch' | 'finally'
  | 'case';

export interface FlowNodeData extends Record<string, unknown> {
  label: string;
  nodeType: NodeType;
  code?: string;
  line?: number;
  fullCode?: string;
}

export interface TraceStep {
  event: string;
  line: number;
  method_id: string;
  locals: Record<string, string>;
  source: string;
}

export interface TraceResult {
  steps: TraceStep[];
  total: number;
}

export interface AnalyzeResult {
  nodes: { id: string; type: string; data: FlowNodeData; position: { x: number; y: number } }[];
  edges: { id: string; source: string; target: string; label: string; animated: boolean; markerEnd?: unknown }[];
  language: Language;
}
