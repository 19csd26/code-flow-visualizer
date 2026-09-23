# CodeFlow — Interactive Java & Ruby Code Visualizer

Paste Java or Ruby code and instantly see an interactive control flow graph. For Ruby, step through execution line-by-line with live variable inspection.

## Features

- **Control Flow Graph** — visualizes methods, if/else branches, loops, try/catch, switch, calls, and returns as an interactive node graph
- **Step-by-step Trace** (Ruby) — executes Ruby code and lets you step through every line with a variable inspector and scrubber
- **Interactive graph** — zoom, pan, click nodes to inspect code, minimap navigation
- **Monaco editor** — VS Code-quality editor with syntax highlighting for Java and Ruby
- **Auto-layout** — dagre-based hierarchical graph layout

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18 + Vite + TypeScript + Tailwind CSS |
| Code editor | Monaco Editor (`@monaco-editor/react`) |
| Graph | React Flow + dagre layout |
| Backend | Node.js + Express |
| Parsing | tree-sitter (Java + Ruby grammars) |
| Ruby tracing | TracePoint API via child process |

## Getting Started

### Prerequisites

- Node.js 18+
- Ruby (for step-trace feature)
- Python 3 + node-gyp (for tree-sitter native compilation)

### Install

```bash
npm run install:all
```

### Run

```bash
npm run dev
```

Opens:
- Frontend: http://localhost:5173
- Backend API: http://localhost:3001

## Usage

1. **Select language** — Java or Ruby using the toggle in the header
2. **Paste your code** in the editor (or use the sample code)
3. **Click "Analyze Flow"** to generate the interactive control flow graph
4. **Click any node** to inspect the underlying code snippet
5. For Ruby: **click "Step Trace"** to execute and step through your code with variable inspection

## API

```
POST /api/analyze
Body: { "code": "...", "language": "java" | "ruby" }
Returns: { nodes, edges, language }

POST /api/trace  (Ruby only)
Body: { "code": "...", "language": "ruby" }
Returns: { steps: [{ event, line, locals, source }], total }
```

## Node Types

| Type | Color | Meaning |
|------|-------|---------|
| Method | 🟣 Indigo | Method/function declaration |
| Start/End | 🟢🔴 | Entry/exit points |
| Decision | 🟡 Yellow | if/else, switch |
| Loop | 🟠 Orange | for, while, until |
| Call | 💜 Purple | Method invocations |
| Return | 🟢 Green | return statements |
| Throw/Raise | 🔴 Red | throw/raise |
| Try/Rescue | 🔵 Blue/Purple | Exception handling |
