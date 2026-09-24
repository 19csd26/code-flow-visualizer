import { buildJavaCFG } from '../lib/javaParser';
import { buildRubyCFG } from '../lib/rubyParser';
import type { Language, AnalyzeResult, TraceResult } from '../types/flow';

// All parsing runs in-browser via web-tree-sitter WASM — no backend needed.
export async function analyzeCode(code: string, language: Language): Promise<AnalyzeResult> {
  if (language === 'java') return buildJavaCFG(code);
  if (language === 'ruby') return buildRubyCFG(code);
  throw new Error('Unsupported language');
}

// Ruby trace still requires a backend (TracePoint needs a live Ruby process).
// Fails gracefully when no backend is available.
export async function traceCode(code: string, language: Language): Promise<TraceResult> {
  const res = await fetch('/api/trace', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, language }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Trace failed');
  return data;
}
