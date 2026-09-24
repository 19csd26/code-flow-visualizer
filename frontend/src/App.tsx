import React, { useState, useCallback, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { ReactFlowProvider } from '@xyflow/react';
import type { Edge } from '@xyflow/react';
import {
  GitBranch, Zap, AlertCircle, Loader2,
  Code2, Activity, Play,
} from 'lucide-react';

import FlowVisualizer from './components/FlowVisualizer';
import NodeDetail from './components/NodeDetail';
import TracePlayer from './components/TracePlayer';
import SimulationPanel from './components/SimulationPanel';
import { analyzeCode, traceCode } from './services/api';
import { useSimulation } from './hooks/useSimulation';
import type { AppNode } from './components/CustomNodes';
import type { Language, AnalyzeResult, TraceResult, FlowNodeData, TraceStep } from './types/flow';

const JAVA_SAMPLE = `public class BinarySearch {
    public static int search(int[] arr, int target) {
        int left = 0;
        int right = arr.length - 1;

        while (left <= right) {
            int mid = left + (right - left) / 2;

            if (arr[mid] == target) {
                return mid;
            } else if (arr[mid] < target) {
                left = mid + 1;
            } else {
                right = mid - 1;
            }
        }
        return -1;
    }

    public static void main(String[] args) {
        int[] data = {1, 3, 5, 7, 9, 11};
        int result = search(data, 7);
        if (result != -1) {
            System.out.println("Found at index: " + result);
        } else {
            System.out.println("Not found");
        }
    }
}`;

const RUBY_SAMPLE = `def fibonacci(n)
  if n <= 1
    return n
  end

  a = 0
  b = 1
  i = 2

  while i <= n
    temp = a + b
    a = b
    b = temp
    i += 1
  end

  b
end

def greet(name)
  if name.nil? || name.empty?
    raise ArgumentError, "Name cannot be empty"
  end
  "Hello, #{name}!"
end

result = fibonacci(8)
puts result
puts greet("World")`;

const LANGS: { value: Language; label: string; icon: string }[] = [
  { value: 'java', label: 'Java', icon: '☕' },
  { value: 'ruby', label: 'Ruby', icon: '💎' },
];

type Tab = 'flow' | 'simulate' | 'trace';

export default function App() {
  const [language, setLanguage]       = useState<Language>('java');
  const [code, setCode]               = useState(JAVA_SAMPLE);
  const [tab, setTab]                 = useState<Tab>('flow');

  const [flowResult, setFlowResult]   = useState<AnalyzeResult | null>(null);
  const [traceResult, setTraceResult] = useState<TraceResult | null>(null);
  const [selectedNode, setSelectedNode] = useState<FlowNodeData | null>(null);

  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);

  // Laid-out nodes/edges (set by FlowVisualizer after dagre runs)
  const [layoutNodes, setLayoutNodes] = useState<AppNode[]>([]);
  const [layoutEdges, setLayoutEdges] = useState<Edge[]>([]);

  const editorRef = useRef<Parameters<NonNullable<React.ComponentProps<typeof Editor>['onMount']>>[0] | null>(null);
  const decorationsRef = useRef<string[]>([]);

  // Simulation hook — wired to the laid-out graph + optional Ruby trace
  const sim = useSimulation(
    layoutNodes,
    layoutEdges,
    traceResult?.steps as TraceStep[] | undefined
  );

  function handleEditorMount(editor: Parameters<NonNullable<React.ComponentProps<typeof Editor>['onMount']>>[0]) {
    editorRef.current = editor;
  }

  // Highlight active line in Monaco when simulation is running
  const highlightLine = useCallback((line: number | null) => {
    const editor = editorRef.current;
    if (!editor) return;
    const newDecs = line
      ? [{ range: { startLineNumber: line, endLineNumber: line, startColumn: 1, endColumn: 1 }, options: { isWholeLine: true, className: 'highlighted-line', linesDecorationsClassName: 'highlighted-line-gutter' } }]
      : [];
    decorationsRef.current = editor.deltaDecorations(decorationsRef.current, newDecs);
  }, []);

  // Highlight line in editor whenever simulation advances
  const prevLine = useRef<number | null>(null);
  if (sim.steps[sim.current]?.line !== prevLine.current) {
    prevLine.current = sim.steps[sim.current]?.line ?? null;
    highlightLine(prevLine.current);
  }

  async function handleAnalyze() {
    if (!code.trim()) return;
    setLoading(true);
    setError(null);
    setSelectedNode(null);
    sim.reset();
    try {
      const result = await analyzeCode(code, language);
      setFlowResult(result);
      setTab('flow');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function handleTrace() {
    if (!code.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const result = await traceCode(code, language);
      setTraceResult(result);
      setTab('trace');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  function handleLangChange(lang: Language) {
    setLanguage(lang);
    setCode(lang === 'java' ? JAVA_SAMPLE : RUBY_SAMPLE);
    setFlowResult(null);
    setTraceResult(null);
    setError(null);
    setSelectedNode(null);
    setLayoutNodes([]);
    setLayoutEdges([]);
    sim.reset();
  }

  const handleLayoutReady = useCallback((nodes: AppNode[], edges: Edge[]) => {
    setLayoutNodes(nodes);
    setLayoutEdges(edges);
  }, []);

  const TABS: { id: Tab; label: string; hidden?: boolean }[] = [
    { id: 'flow',     label: '⚡ Flow Graph' },
    { id: 'simulate', label: '▶ Simulate', hidden: !flowResult },
    { id: 'trace',    label: '🔍 Step Trace', hidden: language !== 'ruby' },
  ];

  return (
    <div className="flex flex-col h-screen" style={{ background: '#0f1117' }}>

      {/* Header */}
      <header className="flex items-center justify-between px-5 py-3 shrink-0"
        style={{ background: '#1a1d27', borderBottom: '1px solid #2d3148' }}>
        <div className="flex items-center gap-3">
          <GitBranch size={20} className="text-indigo-400" />
          <span className="font-bold text-slate-100 text-base tracking-tight">CodeFlow</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full text-indigo-300 font-mono"
            style={{ background: '#312e81' }}>
            Java & Ruby
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Language picker */}
          <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid #2d3148' }}>
            {LANGS.map(l => (
              <button key={l.value} onClick={() => handleLangChange(l.value)}
                className="px-3 py-1.5 text-sm font-medium transition-colors"
                style={{ background: language === l.value ? '#312e81' : 'transparent', color: language === l.value ? '#c7d2fe' : '#64748b' }}>
                {l.icon} {l.label}
              </button>
            ))}
          </div>

          {/* Analyze */}
          <button onClick={handleAnalyze} disabled={loading}
            className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-semibold text-white transition-all"
            style={{ background: loading ? '#3730a3' : '#4f46e5' }}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
            Analyze
          </button>

          {/* Quick-simulate shortcut */}
          {flowResult && (
            <button
              onClick={() => { setTab('simulate'); setTimeout(() => sim.play(), 100); }}
              className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all"
              style={{ background: '#14532d', color: '#86efac', border: '1px solid #166534' }}>
              <Play size={14} />
              Simulate
            </button>
          )}

          {/* Ruby trace */}
          {language === 'ruby' && (
            <button onClick={handleTrace} disabled={loading}
              className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all"
              style={{ background: '#1e1b4b', color: '#a5b4fc', border: '1px solid #4338ca' }}>
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Activity size={14} />}
              Trace
            </button>
          )}
        </div>
      </header>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 px-5 py-2 text-sm text-red-300 shrink-0"
          style={{ background: '#450a0a', borderBottom: '1px solid #7f1d1d' }}>
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">

        {/* Code editor pane */}
        <div className="flex flex-col shrink-0" style={{ width: '42%', borderRight: '1px solid #2d3148' }}>
          <div className="flex items-center gap-2 px-4 py-2 shrink-0"
            style={{ background: '#1a1d27', borderBottom: '1px solid #2d3148' }}>
            <Code2 size={14} className="text-slate-500" />
            <span className="text-xs text-slate-500 font-mono">
              {language === 'java' ? 'Main.java' : 'main.rb'}
            </span>
          </div>
          <div className="flex-1 overflow-hidden">
            <Editor
              language={language === 'java' ? 'java' : 'ruby'}
              value={code}
              onChange={v => setCode(v ?? '')}
              onMount={handleEditorMount}
              theme="vs-dark"
              options={{
                fontSize: 13,
                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                lineNumbers: 'on',
                padding: { top: 12 },
                wordWrap: 'on',
                smoothScrolling: true,
                cursorSmoothCaretAnimation: 'on',
                bracketPairColorization: { enabled: true },
              }}
            />
          </div>
        </div>

        {/* Right pane */}
        <div className="flex flex-col flex-1 overflow-hidden">

          {/* Tab bar */}
          <div className="flex items-center shrink-0"
            style={{ background: '#1a1d27', borderBottom: '1px solid #2d3148' }}>
            {TABS.filter(t => !t.hidden).map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className="px-5 py-2.5 text-xs font-semibold transition-colors"
                style={{
                  color: tab === t.id ? '#c7d2fe' : '#64748b',
                  borderBottom: tab === t.id ? '2px solid #6366f1' : '2px solid transparent',
                }}>
                {t.label}
              </button>
            ))}
            {/* Node/edge counts */}
            {flowResult && (
              <span className="ml-auto mr-4 text-[10px] text-slate-600 font-mono">
                {flowResult.nodes.length} nodes · {flowResult.edges.length} edges
              </span>
            )}
          </div>

          {/* Tab content */}
          <div className="flex flex-1 overflow-hidden">

            {/* Flow graph (always mounted to keep layout state) */}
            <div className={`flex-1 relative overflow-hidden ${tab !== 'flow' && tab !== 'simulate' ? 'hidden' : ''}`}>
              <ReactFlowProvider>
                <FlowVisualizer
                  result={flowResult}
                  onNodeClick={setSelectedNode}
                  activeNodeId={tab === 'simulate' ? sim.activeNodeId : null}
                  onLayoutReady={handleLayoutReady}
                />
                {tab === 'flow' && <NodeDetail data={selectedNode} onClose={() => setSelectedNode(null)} />}
              </ReactFlowProvider>
            </div>

            {/* Simulation side panel */}
            {tab === 'simulate' && (
              <div className="w-72 shrink-0 overflow-hidden flex flex-col"
                style={{ borderLeft: '1px solid #2d3148' }}>
                <SimulationPanel sim={sim} />
              </div>
            )}

            {/* Ruby step trace */}
            {tab === 'trace' && (
              <div className="flex-1 overflow-hidden">
                {traceResult ? (
                  <TracePlayer steps={traceResult.steps} highlightLine={highlightLine} />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-500">
                    <Activity size={32} className="text-slate-700" />
                    <p className="text-sm">Click <strong className="text-slate-400">Trace</strong> to run your Ruby code step-by-step</p>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
