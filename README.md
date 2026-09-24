# CodeFlow — Interactive Java & Ruby Code Visualizer

> Paste code → see the execution flow as an interactive animated graph.  
> Step through every node, watch variables change, and understand your code visually.

![Java](https://img.shields.io/badge/Java-ED8B00?style=flat&logo=openjdk&logoColor=white)
![Ruby](https://img.shields.io/badge/Ruby-CC342D?style=flat&logo=ruby&logoColor=white)
![React](https://img.shields.io/badge/React_18-61DAFB?style=flat&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat&logo=node.js&logoColor=white)

---

## What It Does

| Paste this Java code… | …get this flow graph |
|---|---|
| `if / else`, `while`, `for`, `try/catch`, `switch`, method calls | Color-coded interactive node graph with dagre auto-layout |
| Click **Simulate ▶** | Graph animates node-by-node with pulsing highlight + auto-pan |
| Ruby code + **Trace** | Real execution with live variable inspector at each line |

---

## Features

### ⚡ Flow Graph
Parses Java or Ruby code with [tree-sitter](https://tree-sitter.github.io/) and builds a full **Control Flow Graph (CFG)**:
- Methods, constructors, and top-level blocks as entry points
- `if / else if / else` and `switch` → diamond decision nodes
- `for`, `while`, `do-while`, `until`, `for-each` → loop nodes with back-edges
- `try / catch / finally` and `begin / rescue / ensure` → exception subgraphs
- Method calls, variable declarations, return and throw statements
- Animated loop-back edges in purple

### ▶ Simulate (Java + Ruby)
Hit **Simulate** and the graph comes alive:
- Each node pulses with a glowing white ring as execution reaches it
- The graph **auto-pans and zooms** to keep the active node in view
- A side panel shows the **current node type**, **source line**, **description**, and **execution phase** (`true branch`, `loop body`, `loop exit`, etc.)
- A clickable step list lets you jump to any point in the execution
- Scrubber + speed control for full playback control
- The **Monaco editor highlights the active line** in sync

### 🔍 Step Trace (Ruby only)
Runs your Ruby code via `TracePoint` and records every line, call, and return:
- Real variable values at every step (not simulated — actual execution)
- Play/pause, step forward/back, speed control
- Variable inspector shows the current binding state

### 🖱 Interactive Graph
- Zoom, pan, drag nodes
- Click any node → code detail panel with the full source snippet
- Hover → `NodeToolbar` shows the code inline above the node
- Minimap with pan + zoom; active node shown in white during simulation

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite + TypeScript + Tailwind CSS |
| Graph | **@xyflow/react v12** (React Flow) + dagre auto-layout |
| Code editor | Monaco Editor (same engine as VS Code) |
| Backend | Node.js + Express |
| Parsing | **tree-sitter** with native Java + Ruby grammars |
| Ruby execution | `TracePoint` API via sandboxed child process |

---

## Getting Started

### Prerequisites

- **Node.js 18+** — [nodejs.org](https://nodejs.org)
- **Ruby** — for the Step Trace feature (`ruby --version`)
- **Python 3 + node-gyp** — for tree-sitter native module compilation

### Install

```bash
git clone https://github.com/19csd26/code-flow-visualizer.git
cd code-flow-visualizer
npm run install:all
```

### Run

```bash
npm run dev
```

| Service | URL |
|---------|-----|
| App (frontend) | http://localhost:5173 |
| API (backend)  | http://localhost:3001 |

---

## Usage

```
1. Select language     →  ☕ Java  or  💎 Ruby  toggle in the header
2. Paste your code     →  or use the built-in sample (binary search / fibonacci)
3. Click Analyze       →  generates the interactive flow graph
4. Click Simulate ▶    →  animates through every node step-by-step
5. Click any node      →  opens the code detail panel
6. Ruby only: Trace    →  real execution with live variable inspection
```

---

## Live Examples

Try pasting these directly into the editor.

### Example 1 — Java: Binary Search

```java
public class BinarySearch {
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
}
```

**What you'll see:**
```
[⚙ search()]
    │
[▶ Start]
    │
[≡ int left = 0]  →  [≡ int right = arr.length - 1]
    │
[↺ while (left <= right)]  ◄────────────────────┐
    │ true                                        │
[≡ int mid = ...]                                │
    │                                            │
[◇ if (arr[mid] == target)]                      │
   true ↓            false ↓                    │
[↩ return mid]   [◇ if (arr[mid] < target)]     │
                   true ↓      false ↓           │
              [left = mid+1] [right = mid-1] ────┘
    │ false (loop exit)
[↩ return -1]
    │
[■ End]
```

---

### Example 2 — Java: Exception Handling

```java
public class FileProcessor {
    public String readFile(String path) {
        try {
            if (path == null || path.isEmpty()) {
                throw new IllegalArgumentException("Path cannot be empty");
            }
            String content = loadContent(path);
            return content;
        } catch (IllegalArgumentException e) {
            System.err.println("Invalid path: " + e.getMessage());
            return null;
        } catch (Exception e) {
            System.err.println("Unexpected error: " + e.getMessage());
            return null;
        } finally {
            System.out.println("Done processing");
        }
    }
}
```

**What you'll see:**
```
[⚙ readFile()]
    │
[▶ Start]
    │
[⊙ try]
    │              ──────────────── exception ──────┐
[◇ if (path == null...)]                            │
  true ↓   false ↓                                  ▼
[⚡ throw]  [⤙ loadContent(path)]  [⊘ catch(IllegalArgumentException e)]
            │                      [⊘ catch(Exception e)]
            ↓                                       │
[↩ return content]                                  │
            └──────────────────┬────────────────────┘
                               ▼
                          [⊕ finally]
                               │
                           [■ End]
```

---

### Example 3 — Ruby: Fibonacci with Variable Trace

```ruby
def fibonacci(n)
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

puts fibonacci(8)
```

Click **Trace** to see real variable state at every step:

| Step | Line | Event | Variables |
|------|------|-------|-----------|
| 1 | 1 | `call` | `n = 8` |
| 2 | 2 | `line` | `n = 8` |
| 3 | 6 | `line` | `n = 8` |
| 4 | 7 | `line` | `n = 8`, `a = 0` |
| 5 | 8 | `line` | `n = 8`, `a = 0`, `b = 1` |
| 6 | 9 | `line` | `n = 8`, `a = 0`, `b = 1`, `i = 2` |
| … | … | `line` | `a`, `b`, `temp`, `i` updating each iteration |
| 22 | 17 | `line` | `a = 13`, `b = 21`, `i = 9` |
| 23 | 1 | `return` | returns `21` |

---

### Example 4 — Ruby: Pattern Matching with Exception Handling

```ruby
def classify_score(score)
  begin
    raise ArgumentError, "Score must be 0-100" unless (0..100).include?(score)

    grade = case score
    when 90..100 then "A"
    when 80..89  then "B"
    when 70..79  then "C"
    when 60..69  then "D"
    else              "F"
    end

    puts "Score #{score} → Grade #{grade}"
    grade
  rescue ArgumentError => e
    puts "Error: #{e.message}"
    nil
  end
end

classify_score(85)
classify_score(150)
```

---

### Example 5 — Java: Nested Loops

```java
public class MatrixUtils {
    public static int[][] transpose(int[][] matrix) {
        int rows = matrix.length;
        int cols = matrix[0].length;
        int[][] result = new int[cols][rows];

        for (int i = 0; i < rows; i++) {
            for (int j = 0; j < cols; j++) {
                result[j][i] = matrix[i][j];
            }
        }
        return result;
    }
}
```

---

## API Reference

```
POST /api/analyze
Body:    { "code": "...", "language": "java" | "ruby" }
Returns: { nodes: Node[], edges: Edge[], language }

POST /api/trace    (Ruby only)
Body:    { "code": "...", "language": "ruby" }
Returns: { steps: [{ event, line, method_id, locals, source }], total }

GET /api/health
Returns: { status: "ok" }
```

---

## Node Type Reference

| Node | Color | Icon | Meaning |
|------|-------|------|---------|
| Method | Indigo | ⚙ | Method / function entry point |
| Start | Green | ▶ | Execution entry |
| End | Red | ■ | Execution exit |
| Statement | Gray | ◈ | Generic statement |
| Declare | Slate | ≡ | Variable declaration |
| Call | Violet | ⤙ | Method / function call |
| Decision | Amber | ◇ | `if`, `unless`, `switch` |
| Loop | Orange | ↺ | `for`, `while`, `until`, `do-while` |
| Return | Teal | ↩ | `return` statement |
| Throw/Raise | Red | ⚡ | `throw` / `raise` |
| Try/Begin | Purple | ⊙ | `try` / `begin` block |
| Catch/Rescue | Yellow | ⊘ | `catch` / `rescue` clause |
| Finally/Ensure | Blue | ⊕ | `finally` / `ensure` block |

### Edge Colors

| Color | Meaning |
|-------|---------|
| 🟢 Green | `true` branch |
| 🔴 Red | `false` branch |
| 🟠 Orange | Exception / rescue |
| 🟣 Purple (animated) | Loop back-edge |
| ⬜ Gray | Sequential flow |

---

## Project Structure

```
code-flow-visualizer/
├── backend/
│   └── src/
│       ├── server.js              # Express API
│       ├── parsers/
│       │   ├── javaParser.js      # tree-sitter Java → CFG nodes + edges
│       │   └── rubyParser.js      # tree-sitter Ruby → CFG nodes + edges
│       └── utils/
│           └── rubyTracer.js      # TracePoint execution + sandboxing
└── frontend/
    └── src/
        ├── App.tsx                # Root layout, tabs, state
        ├── components/
        │   ├── FlowVisualizer.tsx # React Flow canvas + dagre layout
        │   ├── CustomNodes.tsx    # Styled node components (all types)
        │   ├── SimulationPanel.tsx# Play/pause/step UI + variable inspector
        │   ├── TracePlayer.tsx    # Ruby step trace player
        │   └── NodeDetail.tsx     # Click-to-inspect panel
        ├── hooks/
        │   └── useSimulation.ts   # DFS step builder + playback state
        ├── services/
        │   └── api.ts             # Fetch wrappers for /api/*
        └── types/
            └── flow.ts            # Shared TypeScript types
```
