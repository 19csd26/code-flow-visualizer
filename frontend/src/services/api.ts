import type { Language, AnalyzeResult, TraceResult } from '../types/flow';

const BASE = '/api';

export async function analyzeCode(code: string, language: Language): Promise<AnalyzeResult> {
  const res = await fetch(`${BASE}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, language }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Analysis failed');
  return data;
}

export async function traceCode(code: string, language: Language): Promise<TraceResult> {
  const res = await fetch(`${BASE}/trace`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, language }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Trace failed');
  return data;
}
