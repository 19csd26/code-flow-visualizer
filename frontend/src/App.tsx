import React, { useState, useCallback, useRef } from 'react';
import Editor, { type Monaco } from '@monaco-editor/react';
import { ReactFlowProvider } from 'reactflow';
import {
  GitBranch, Play, Zap, AlertCircle, Loader2,
  ChevronDown, Code2, Activity,
} from 'lucide-react';

import FlowVisualizer from './components/FlowVisualizer';
import NodeDetail from './components/NodeDetail';
import TracePlayer from './components/TracePlayer';
import { analyzeCode, traceCode } from './services/api';
import type { Language, AnalyzeResult, TraceResult, FlowNodeData } from './types/flow';

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

type Tab = 'flow' | 'trace';

export default function App() {
  const [language, setLanguage] = useState<Language>('java');
  const [code, setCode] = useState(JAVA_SAMPLE);
  const [tab, setTab] = useState<Tab>('flow');

  const [flowResult, setFlowResult] = useState<AnalyzeResult | null>(null);
  const [traceResult, setTraceResult] = useState<TraceResult | null>(null);
  const [selectedNode, setSelectedNode] = useState<FlowNodeData | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [highlightedLine, setHighlightedLine] = useState<number | null>(null);

  const editorRef = useRef<Parameters<NonNullable<React.ComponentProps<typeof Editor>['onMount']>>[0] | null>(null);
  const decorationsRef = useRef<string[]>([]);

  function handleEditorMount(editor: Parameters<NonNullable<React.ComponentProps<typeof Editor>['onMount']>>[0]) {
    editorRef.current = editor;
  }

  const highlightLine = useCallback((line: number | null) => {
    setHighlightedLine(line);
    const editor = editorRef.current;
    if (!editor) return;
    const newDecs = line
      ? [{ range: { startLineNumber: line, endLineNumber: line, startColumn: 1, endColumn: 1 }, options: { isWholeLine: true, className: 'highlighted-line', linesDecorationsClassName: 'highlighted-line-gutter' } }]
      : [];
    decorationsRef.current = editor.deltaDecorations(decorationsRef.current, newDecs);
  }, []);

  async function handleAnalyze() {
    if (!code.trim()) return;
    setLoading(true);
    setError(null);
    setSelectedNode(null);
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
  }

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
              <button
                key={l.value}
                onClick={() => handleLangChange(l.value)}
                className="px-3 py-1.5 text-sm font-medium transition-colors"
                style={{
                  background: language === l.value ? '#312e81' : 'transparent',
                  color: language === l.value ? '#c7d2fe' : '#64748b',
                }}
              >
                {l.icon} {l.label}
              </button>
            ))}
          </div>

          {/* Analyze */}
          <button
            onClick={handleAnalyze}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-semibold text-white transition-all"
            style={{ background: loading ? '#3730a3' : '#4f46e5' }}
          >
            {loading && tab === 'flow' ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
            Analyze Flow
          </button>

          {/* Trace (Ruby only) */}
          {language === 'ruby' && (
            <button
              onClick={handleTrace}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all"
              style={{ background: '#1e1b4b', color: '#a5b4fc', border: '1px solid #4338ca' }}
            >
              {loading && tab === 'trace' ? <Loader2 size={14} className="animate-spin" /> : <Activity size={14} />}
              Step Trace
            </button>
          )}
        </div>
      </header>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 px-5 py-2 text-sm text-red-300 shrink-0"
          style={{ background: '#450a0a', borderBottom: '1px solid #7f1d1d' }}>
          <AlertCircle size={14} />
          {error}
        </div>
      )}

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Code editor pane */}
        <div className="flex flex-col w-1/2 shrink-0" style={{ borderRight: '1px solid #2d3148' }}>
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
          <div className="flex items-center shrink-0" style={{ background: '#1a1d27', borderBottom: '1px solid #2d3148' }}>
            {(['flow', 'trace'] as Tab[]).map(t => (
              (t === 'trace' && language !== 'ruby') ? null : (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className="px-5 py-2.5 text-xs font-semibold capitalize transition-colors"
                  style={{
                    color: tab === t ? '#c7d2fe' : '#64748b',
                    borderBottom: tab === t ? '2px solid #6366f1' : '2px solid transparent',
                  }}
                >
                  {t === 'flow' ? '⚡ Flow Graph' : '▶ Step Trace'}
                </button>
              )
            ))}
            {flowResult && tab === 'flow' && (
              <span className="ml-auto mr-4 text-[10px] text-slate-600 font-mono">
                {flowResult.nodes.length} nodes · {flowResult.edges.length} edges
              </span>
            )}
            {traceResult && tab === 'trace' && (
              <span className="ml-auto mr-4 text-[10px] text-slate-600 font-mono">
                {traceResult.total} steps{traceResult.total >= 500 ? ' (capped)' : ''}
              </span>
            )}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-hidden relative">
            {tab === 'flow' && (
              <ReactFlowProvider>
                <FlowVisualizer result={flowResult} onNodeClick={setSelectedNode} />
                <NodeDetail data={selectedNode} onClose={() => setSelectedNode(null)} />
              </ReactFlowProvider>
            )}

            {tab === 'trace' && (
              traceResult ? (
                <TracePlayer steps={traceResult.steps} highlightLine={highlightLine} />
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-500">
                  <Activity size={32} className="text-slate-700" />
                  <p className="text-sm">Click <strong className="text-slate-400">Step Trace</strong> to run your Ruby code step-by-step</p>
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
