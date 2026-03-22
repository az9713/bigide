# BigIDE Zero-to-Hero Study Plan

**For:** Developers with C/C++/Java background, new to web/Electron/React development
**Approach:** Theory and implementation hand-in-hand, using the BigIDE codebase as the primary example
**Codebase root:** `bigide/` (all file paths below are relative to this root)

This plan takes you from zero web knowledge to confidently reading, modifying, and extending a real-world Electron + React + TypeScript desktop application. No time pressure. Work at whatever pace keeps the concepts sticking.

---

## How to Use This Plan

Each module follows the same structure:

1. **Goals** — What you will understand when you finish
2. **Theory** — Concepts explained, with analogies to C/C++/Java
3. **Reading** — Specific files in BigIDE, with guidance on what to focus on
4. **Exercises** — Hands-on tasks that cement the concepts

Do not skip the exercises. Reading code is necessary but insufficient. You must write and break things.

---

## Module 1: Foundations — How the Web Platform Works

### Goals

By the end of this module you will understand:
- What HTML, CSS, and JavaScript each do, and how they relate to each other
- How a browser turns text files into pixels on screen
- Why the browser's execution model differs fundamentally from a C or Java program
- How BigIDE's renderer entry point bootstraps the entire UI

---

### Theory

#### The Three Languages of the Web

The web is built on three languages with strictly separated concerns:

**HTML** (HyperText Markup Language) describes *structure*. It defines what elements exist on the page — paragraphs, buttons, input fields, divs — and their hierarchy. Think of it as the declaration of a data structure: a tree of nodes called the DOM (Document Object Model).

```html
<div id="root">
  <button class="btn-primary">Click me</button>
</div>
```

**CSS** (Cascading Style Sheets) describes *appearance*. It says which elements should look how. Rules are matched by selectors (element name, class, ID) and applied to change colour, size, position, font, and animation.

```css
.btn-primary {
  background-color: #2563eb;
  color: white;
  padding: 8px 16px;
  border-radius: 4px;
}
```

**JavaScript** describes *behaviour*. It is the only Turing-complete language of the three. It can read and modify the DOM, respond to user events, make network requests, and perform computations.

```javascript
document.querySelector('#root button').addEventListener('click', () => {
  console.log('Button clicked!')
})
```

**The C/C++ analogy:** If you were writing a GUI with Qt:
- HTML = the `.ui` file (or `QWidget` hierarchy in code)
- CSS = the stylesheet (`setStyleSheet`)
- JavaScript = the slot/signal handler code

#### The Browser as a Runtime

In C, you compile to a native binary and the OS runs it directly. In the browser, you ship source files (HTML, CSS, JS) and the browser engine interprets them at runtime. Under the hood, browsers compile JavaScript to native code via JIT compilation (V8, SpiderMonkey, JavaScriptCore), so performance is not the naive "interpreted = slow" story.

The browser provides:
- A **DOM API**: `document.getElementById()`, `element.appendChild()`, etc.
- A **layout engine**: computes sizes and positions of all elements
- A **paint/compositing engine**: turns the computed layout into pixels
- An **event loop**: the mechanism that makes the browser responsive

#### How a Page Renders: The Critical Path

1. Browser parses HTML → builds the **DOM tree** (a tree of node objects)
2. Browser parses CSS → builds the **CSSOM** (CSS Object Model)
3. DOM + CSSOM are combined into the **render tree** (only visible nodes)
4. **Layout** pass: calculates exact pixel position and size of every element
5. **Paint** pass: fills in pixels according to colour, image, border, text
6. **Composite**: layers are combined and sent to the GPU

This happens initially when the page loads, and partially re-runs whenever JavaScript modifies the DOM or CSS changes. This is why frameworks like React (Module 5) batch DOM updates — unnecessary layout recalculations are expensive.

#### The Event Loop: Why There Is No `main()`

A C `main()` runs top-to-bottom and exits. A Java application has a main thread that blocks on a message queue. A browser page is similar to the second model: there is a single **event loop** that processes one task at a time.

The loop looks like this conceptually:

```
while (true) {
  task = taskQueue.dequeue()        // get the next thing to do
  task.execute()                     // run it to completion
  // render update (if needed)
  microtaskQueue.drainAll()         // process all Promises
}
```

Two critical consequences:

1. **JavaScript is single-threaded.** There is only one thread running user code. If your code takes 500ms to run, the page freezes for 500ms. This is the web equivalent of blocking the Win32 message pump.

2. **Async code is cooperative, not preemptive.** When you `await` a Promise, you yield back to the event loop. Nothing runs in parallel in the same thread; it is interleaved.

Compare to Java's `CompletableFuture.supplyAsync()` which spawns a thread. In JavaScript, `await fetch(url)` suspends the current function and lets other code run, then resumes when the network response arrives — all in one thread.

---

### Reading in BigIDE

#### `src/renderer/index.html`

This is the *only* HTML file in the entire application. Open it and read all 12 lines.

```
Line 1: DOCTYPE declaration — tells browsers this is HTML5
Line 2: <html lang="en" class="dark"> — root element, dark class enables dark mode in Tailwind
Line 8: <body class="bg-[#0f0f13] ..."> — background colour applied via Tailwind utility class
Line 9: <div id="root"></div> — the single mount point for React. Everything visible is injected here.
Line 10: <script type="module" src="./main.tsx"> — loads the React entry point
```

Notice there is no content inside `<body>` except one empty `<div>`. The entire application UI is generated programmatically by React running in JavaScript. This is the SPA (Single-Page Application) pattern.

#### `src/renderer/app.css`

Focus on:
- The `@import "tailwindcss"` line (line 1) — this pulls in TailwindCSS (covered in Module 7)
- `:root { color-scheme: dark }` — tells the browser to use dark mode for system UI elements
- `#root { height: 100vh; width: 100vw }` — makes the React container fill the entire window
- `overflow: hidden` on body — prevents scrollbars on the outer window (the app manages its own scrolling)

#### `src/renderer/styles.css`

This is a second CSS file loaded alongside `app.css`. It handles:
- xterm.js terminal styles (Module 8)
- React Flow canvas overrides (Module 12)
- Custom scrollbar styling (`-webkit-scrollbar` pseudo-elements)
- The `.diff-unified` class for the diff viewer (Module 9)

---

### Exercises

**Exercise 1.1 — Change a colour:**
In `app.css`, find the body background `#030712` and change it to `#1a0000` (dark red). Run the app with `npm run dev` and verify the background changed. Change it back.

**Exercise 1.2 — Add a DOM element:**
In `index.html`, add `<p id="test-para">Hello from HTML</p>` inside the body, before the `<div id="root">`. Run the app. Can you see the paragraph? Open DevTools (F12 in the Electron window) and find it in the Elements panel. Why is it hidden behind the React app? (Hint: what CSS property does `#root` have?)

**Exercise 1.3 — Observe the DOM:**
With the app running, open DevTools and click the Elements tab. Expand `<div id="root">`. You will see the entire application component tree rendered as HTML. Notice that no HTML element existed in `index.html` — React generated all of it. This is what React does.

**Exercise 1.4 — Event loop intuition:**
In the browser console (DevTools > Console), type:
```javascript
setTimeout(() => console.log('timeout fired'), 0)
console.log('this runs first')
```
The second `console.log` runs before the first even though the timeout delay is zero. This is the event loop in action. The `setTimeout` callback is queued as a future task; current synchronous code finishes first.

---

## Module 2: JavaScript and TypeScript Essentials

### Goals

By the end of this module you will understand:
- JavaScript syntax including destructuring, spread, and arrow functions
- How Promises and async/await work, analogised to Java's CompletableFuture
- ES modules: import/export as the equivalent of Java packages
- TypeScript's type system, including generics, union types, and optional properties
- How BigIDE's shared type definitions flow through the entire application

---

### Theory

#### JavaScript Syntax Crash Course

JavaScript looks like Java/C but has important differences. Key points for someone with Java experience:

**Variables:**
```javascript
let mutable = 'can change'        // block-scoped, like Java local var
const immutable = 'cannot change' // block-scoped, cannot be reassigned
var legacy = 'avoid this'         // function-scoped, hoisted — avoid
```

**Functions — three syntaxes:**
```javascript
// Traditional (like Java method)
function add(a, b) { return a + b }

// Arrow function (concise, and binds 'this' lexically — important later)
const add = (a, b) => a + b

// Arrow with body
const add = (a, b) => {
  const result = a + b
  return result
}
```

**Objects and destructuring:**
```javascript
const person = { name: 'Alice', age: 30, role: 'admin' }

// Destructuring: extract fields into variables (like Java record deconstruction)
const { name, age } = person
console.log(name) // 'Alice'

// Spread: copy and override (like builder pattern)
const updated = { ...person, age: 31 }
```

**Arrays:**
```javascript
const nums = [1, 2, 3]

// map: transform each element (like Java Stream.map)
const doubled = nums.map(n => n * 2)   // [2, 4, 6]

// filter: keep matching elements
const evens = nums.filter(n => n % 2 === 0)  // [2]

// find: first match or undefined
const first = nums.find(n => n > 1)  // 2

// Spread to combine arrays
const more = [...nums, 4, 5]  // [1, 2, 3, 4, 5]
```

**Optional chaining and nullish coalescing:**
```javascript
// Instead of: if (obj && obj.prop && obj.prop.sub)
const value = obj?.prop?.sub        // undefined if any step is null/undefined

// Nullish coalescing: use right side if left is null/undefined
const label = task.title ?? 'Untitled'
```

#### Promises and async/await

In C++, async operations often use callbacks or `std::future`. In Java, `CompletableFuture` provides a composable async model. JavaScript's native equivalent is `Promise`.

A Promise is an object representing a value that will be available in the future:

```javascript
// Creating a promise
const p = new Promise((resolve, reject) => {
  setTimeout(() => resolve('done'), 1000)
})

// Consuming with .then/.catch (callback style)
p.then(value => console.log(value))
 .catch(err => console.error(err))

// Consuming with async/await (syntactic sugar over .then)
async function run() {
  try {
    const value = await p
    console.log(value)
  } catch (err) {
    console.error(err)
  }
}
```

The `await` keyword suspends the async function until the Promise resolves, then returns the value. It does not block the thread — it yields to the event loop. This is analogous to Java's `future.get()` but without blocking the thread.

**Important:** You can only use `await` inside an `async` function. An `async` function always returns a Promise.

#### ES Modules

ES modules are JavaScript's native module system. They are roughly analogous to Java packages combined with explicit exports.

```javascript
// math.js — exporting
export function add(a, b) { return a + b }
export const PI = 3.14159
export default class Calculator { ... }  // one default export per file

// main.js — importing
import Calculator from './math.js'          // import default export
import { add, PI } from './math.js'         // import named exports
import { add as sum } from './math.js'      // rename on import
import * as math from './math.js'           // import everything as namespace
```

Compare to Java:
- `export` = `public`
- Named exports = individual `public static` methods or classes
- `import { X } from './file'` = `import package.X`

#### TypeScript

TypeScript is a typed superset of JavaScript. Every valid JavaScript file is valid TypeScript. TypeScript adds a compile-time type layer, then erases all types to produce plain JavaScript. There is no runtime overhead.

**Basic types:**
```typescript
let count: number = 0
let name: string = 'Alice'
let active: boolean = true
let value: string | null = null      // union type
let maybe: string | undefined        // optional
```

**Interfaces vs types:**
```typescript
// interface: defines an object shape, can be extended/implemented
interface User {
  id: string
  name: string
  email?: string   // optional property (the ? means it may be undefined)
}

// type alias: can be anything — union, intersection, primitive alias
type TaskStatus = 'todo' | 'running' | 'needs-review' | 'done' | 'error'
type UserId = string   // alias for clarity
```

The rule of thumb: use `interface` for object shapes (especially when they may be extended), use `type` for unions, intersections, and aliases.

**Generics:**
```typescript
// Like Java generics: <T> is a type parameter
function first<T>(arr: T[]): T | undefined {
  return arr[0]
}

// Generic interface
interface Result<T> {
  data: T
  error: string | null
}
```

**Utility types:**
```typescript
// Omit<T, K>: like T but without fields K
// Used extensively in BigIDE IPC types:
type CreateTask = Omit<AgentTask, 'id' | 'worktreePath' | 'ptyId'>

// Partial<T>: all fields optional (useful for update operations)
type TaskUpdate = Partial<AgentTask>

// Record<K, V>: object with keys of type K and values of type V
type TaskMap = Record<string, AgentTask[]>
```

---

### Reading in BigIDE

#### `src/shared/types.ts` — Read every line

This file is the contract for the entire application. Everything that crosses a process boundary (main ↔ renderer) is typed here.

Work through each type and ask yourself: what real-world thing does this represent?

- `Project`: a git repository the user has added to BigIDE
- `TaskStatus`: a discriminated union — only these five strings are valid. Compare to a Java `enum`.
- `AgentTask`: a unit of AI agent work. Note the nullable fields (`worktreePath: string | null`) — they start null and are populated as the task progresses through its lifecycle.
- `ToolLogEntry`: a record of one thing the agent did (edited a file, ran a bash command)
- `TaskPermissions`: the allow/deny policy for a task's agent
- `DEFAULT_PERMISSIONS`: a constant with export — the safe defaults
- `Notification`: a message shown to the user about a task event
- `IpcChannels`: a **type-level map** from channel name to function signature. This is TypeScript being used not just for type safety but as documentation of the entire IPC API.
- `IpcEvents`: the push-only events that main sends to renderer (not request-response)

Pay close attention to the comment `// Push events (main → renderer)` before `IpcEvents`. This distinguishes the two communication patterns:
- `IpcChannels`: request → response (like RPC)
- `IpcEvents`: fire-and-forget push (like pub/sub)

#### `tsconfig.json` — Read and understand each option

- `"target": "ES2022"` — compile to ES2022 syntax (modern JS, Electron supports it)
- `"module": "ESNext"` — emit ES module syntax (`import`/`export`)
- `"moduleResolution": "bundler"` — resolve modules like Vite/webpack do
- `"strict": true` — enables all strict type checks (no implicit `any`, strict null checks, etc.)
- `"jsx": "react-jsx"` — transform JSX syntax using React's new JSX transform
- `"paths": { "@shared/*": ["src/shared/*"] }` — path alias so any file can `import from '@shared/types'` instead of `../../shared/types`

---

### Exercises

**Exercise 2.1 — Add a field to Project:**
In `src/shared/types.ts`, add an optional `description?: string` field to the `Project` interface. Notice that TypeScript's strict mode will not complain about this addition because it's optional. Now try removing a non-optional field. What errors appear?

**Exercise 2.2 — Create a type alias:**
Below the `TaskStatus` type, add:
```typescript
export type AgentModelName = 'gemini-cli' | 'claude-code' | 'codex' | 'copilot' | 'custom'
```
Find where the `model` field is used in `AgentTask`. Could you change its type from `string` to `AgentModelName`? What would break?

**Exercise 2.3 — Trace a type through the stack:**
Start with `AgentTask` in `src/shared/types.ts`. Now find:
1. Where `IpcChannels['task:create']` uses `Omit<AgentTask, ...>` — understand why those fields are omitted (they don't exist yet at creation time)
2. How `src/main/ipc-handlers.ts` handles `task:create` and constructs the full `AgentTask`
3. How `src/renderer/stores/task-store.ts` calls `window.bigide.taskCreate()` and stores the result typed as `AgentTask`

This is the full type safety chain: a type defined once flows through three process boundaries.

**Exercise 2.4 — async/await practice:**
In `src/renderer/stores/workspace-store.ts`, find `loadProjects`. Write out in plain English what each line does, noting where execution suspends (each `await`) and where it resumes.

---

## Module 3: Node.js — JavaScript on the Server

### Goals

By the end of this module you will understand:
- What Node.js is and how it differs from browser JavaScript
- How npm manages packages and dependencies
- How to use Node.js for file I/O and running child processes
- How BigIDE's main process persists data and runs git commands

---

### Theory

#### What Is Node.js?

Node.js takes Google's V8 JavaScript engine (the same engine in Chrome) and embeds it in a standalone runtime that adds system APIs:

- **File system** (`fs` module): read/write files, like `fopen`/`fread` in C
- **Child processes** (`child_process` module): spawn programs, like `fork`/`exec` in C or `ProcessBuilder` in Java
- **Networking** (`net`, `http`, `https` modules): TCP sockets, HTTP servers
- **Streams**: readable/writable byte streams, composable pipelines
- **Path** (`path` module): cross-platform path manipulation
- **Crypto** (`crypto` module): UUIDs, hashing, encryption

Node.js does NOT have:
- A DOM
- `window`, `document`, `localStorage`
- Browser-specific APIs (these are browser built-ins, not JavaScript language features)

This is why BigIDE has two separate environments: the main process (Node.js, has system access) and the renderer process (Chromium browser, has DOM but no direct system access).

#### The Node.js Module System

Node.js originally used CommonJS modules:
```javascript
// CommonJS (old style)
const fs = require('fs')
module.exports = { myFunction }
```

Modern Node.js and the web both support ES modules:
```javascript
// ES Modules (modern)
import { readFileSync } from 'fs'
export function myFunction() { ... }
```

BigIDE uses ES modules throughout (configured in `tsconfig.json` and `electron.vite.config.ts`).

#### npm and package.json

`npm` (Node Package Manager) is the equivalent of Maven/Gradle for the JavaScript ecosystem. `package.json` is like `pom.xml` or `build.gradle` but simpler.

```json
{
  "dependencies": {
    "react": "^19.1.0"
  },
  "devDependencies": {
    "typescript": "^5.8.3"
  },
  "scripts": {
    "dev": "electron-vite dev"
  }
}
```

- `dependencies`: packages needed at runtime
- `devDependencies`: packages needed only during development (linters, compilers, bundlers)
- `scripts`: shorthand commands run via `npm run <name>`
- `^19.1.0`: caret range — allows patch and minor updates, not major

Running `npm install` downloads all packages into `node_modules/`. Running `npm run dev` executes `electron-vite dev` as if you typed it in the terminal.

#### Child Processes

Node.js can spawn child processes, giving full control over their stdin, stdout, and stderr — exactly like `popen` in C or `ProcessBuilder` in Java.

```javascript
import { exec, spawn } from 'child_process'

// exec: run command, buffer all output, return when done
exec('git status', (err, stdout, stderr) => {
  console.log(stdout)
})

// spawn: stream stdin/stdout in real-time (important for long-running processes)
const proc = spawn('claude', ['--prompt', 'Write a test'])
proc.stdout.on('data', data => process.stdout.write(data))
```

BigIDE uses `node-pty` instead of raw child processes for the terminal, because PTYs give proper terminal emulation (covered in Module 8). But the underlying concept is the same: spawn a subprocess and pipe its I/O.

---

### Reading in BigIDE

#### `package.json` — Every dependency matters

Read through `dependencies` and understand what each package does:

| Package | Purpose |
|---|---|
| `@xyflow/react` | The canvas/graph view for visualising projects |
| `electron-store` | Persistent key-value storage to a JSON file |
| `node-pty` | Native PTY (pseudo-terminal) support |
| `octokit` | GitHub REST API client |
| `react`, `react-dom` | The UI framework |
| `react-diff-view` | Renders unified diffs with syntax highlighting |
| `react-resizable-panels` | Draggable panel splitters |
| `simple-git` | Node.js wrapper around git commands |
| `unidiff` | Parses unified diff format strings |
| `@xterm/xterm` | Terminal emulator rendered in the browser |
| `@xterm/addon-fit` | Makes xterm resize to fill its container |
| `@xterm/addon-web-links` | Makes URLs in the terminal clickable |
| `zustand` | Lightweight state management for React |

And `devDependencies`:

| Package | Purpose |
|---|---|
| `@tailwindcss/vite` | TailwindCSS integration with the Vite bundler |
| `electron` | The Electron runtime itself |
| `electron-builder` | Packages the app into installers |
| `electron-vite` | Development toolchain combining Electron + Vite |
| `tailwindcss` | Utility-first CSS framework |
| `typescript` | The TypeScript compiler |
| `vite` | The fast modern build tool / dev server |

#### `src/main/store.ts` — File-based persistence

This file wraps `electron-store`, which saves data as a JSON file on disk (typically in the user's app data directory, e.g., `%APPDATA%/bigide/bigide-state.json` on Windows).

Key observations:
- `new Store<StoreSchema>()` — TypeScript generic specifies the shape of stored data
- `store.get('projects')` — reads from the JSON file
- `store.set('projects', projects)` — writes to the JSON file (synchronous)
- All functions are pure wrappers: read all, modify in memory, write all back
- This is a simple approach; not appropriate for large datasets but perfectly fine for a few dozen projects/tasks

#### `src/main/git-service.ts` — Node.js library usage

This file shows the pattern of using an npm library (`simple-git`) to wrap a command-line tool (`git`). Notice:

- `simpleGit(repoPath)` creates a git client pointed at a directory
- `git.raw(['worktree', 'add', '-b', branchName, worktreePath, baseBranch])` runs `git worktree add -b <branch> <path> <base>` as if you typed it in the terminal
- `git.raw(...)` returns a Promise — this is async I/O (Node.js delegates to the OS, does not block the JS thread)
- Error handling with `try/catch` wrapping `await` calls

The `createPullRequest` function shows something more sophisticated: it dynamically `import`s two modules (`octokit` and `child_process`), uses `execSync` to call the `gh` CLI, and makes an authenticated HTTP call to the GitHub API.

---

### Exercises

**Exercise 3.1 — Inspect Node.js:**
Open a terminal and run:
```
node -e "console.log(process.versions)"
node -e "console.log(process.platform, process.arch)"
node -e "const {readFileSync} = require('fs'); console.log(readFileSync('./package.json', 'utf8').slice(0, 100))"
```
You now know what version of Node.js (and V8) you are running.

**Exercise 3.2 — Trace simple-git:**
In `src/main/git-service.ts`, find `getDiff`. Write out the equivalent shell command it would run. Then find where `getDiff` is called (in `src/main/ipc-handlers.ts`). Trace the call: IPC handler → git service → shell command → back to Promise resolution.

**Exercise 3.3 — Read the npm scripts:**
In `package.json`, the `dev` script runs `electron-vite dev`. Look at `electron.vite.config.ts` if it exists. Understand what `electron-vite` does: it starts a Vite dev server for the renderer (hot reload), compiles the main process TypeScript, and launches Electron pointing at the dev server URL.

**Exercise 3.4 — Understand the store:**
In `src/main/store.ts`, the `updateTask` function reads all tasks, finds one by ID, updates it, and writes all tasks back. This is O(n) on every update. For a production system, what would be a better approach? (Think: SQLite, or an in-memory Map with periodic flush.) This exercise is conceptual — don't change the code.

---

## Module 4: Electron — Desktop Apps with Web Technology

### Goals

By the end of this module you will understand:
- Electron's three-process architecture: main, renderer, preload
- Why these processes are isolated and how they communicate safely
- IPC (Inter-Process Communication) in both directions
- How BigIDE's IPC layer is structured end-to-end
- Why you must use the preload bridge instead of directly accessing Node.js from the renderer

---

### Theory

#### Electron Architecture

Electron embeds two things in one executable: Node.js and Chromium. These run as separate processes:

```
┌─────────────────────────────────────────────────────────────────┐
│  Electron App (OS process)                                       │
│                                                                  │
│  ┌──────────────────────┐         ┌───────────────────────────┐ │
│  │  Main Process        │         │  Renderer Process         │ │
│  │  (Node.js)           │◄───IPC─►│  (Chromium)               │ │
│  │                      │         │                           │ │
│  │  - Full Node.js API  │         │  - DOM, CSS, Web APIs     │ │
│  │  - File system       │         │  - React/Vue/etc          │ │
│  │  - Native modules    │         │  - Sandboxed by default   │ │
│  │  - Creates windows   │         │                           │ │
│  └──────────────────────┘         └───────────────────────────┘ │
│           ▲                                    ▲                 │
│           │                          ┌─────────┴──────────┐     │
│           │                          │  Preload Script    │     │
│           │                          │  (Bridge)          │     │
│           └──────────────────────────┤                    │     │
│                                      │  - Runs before     │     │
│                                      │    renderer JS     │     │
│                                      │  - Has limited     │     │
│                                      │    Node.js access  │     │
│                                      │  - Exposes safe    │     │
│                                      │    API via         │     │
│                                      │    contextBridge   │     │
│                                      └────────────────────┘     │
└─────────────────────────────────────────────────────────────────┘
```

**The Qt analogy:** Compare this to a Qt application where:
- Main process = the `QApplication` and backend logic
- Renderer process = a `QWebEngineView` loading a web page
- Preload = the JavaScript injected into the web view to provide a C++↔JS bridge
- IPC = signals/slots or QWebChannel

#### Why Context Isolation?

By default, Electron sets `contextIsolation: true` and `nodeIntegration: false` for security. This means:

- The renderer cannot access Node.js APIs (`require`, `fs`, `process`, etc.)
- The renderer cannot access Electron's `ipcRenderer` directly
- Code in the renderer runs in a sandboxed web page, just like in Chrome

Without this, any malicious website loaded in an Electron window (or any XSS vulnerability) would have full access to the user's file system. This was a real historical vulnerability.

The preload script is the **controlled bridge**. It runs in a privileged context (can see both the browser `window` and Electron's `ipcRenderer`), but it only exposes what you explicitly choose to expose via `contextBridge.exposeInMainWorld()`.

#### IPC: Two Patterns

**Pattern 1 — Request/Response (ipcMain.handle + ipcRenderer.invoke):**

Like an RPC (Remote Procedure Call):

```
Renderer: const result = await ipcRenderer.invoke('channel-name', arg1, arg2)
Main:     ipcMain.handle('channel-name', async (event, arg1, arg2) => {
            return computeResult(arg1, arg2)
          })
```

The renderer's `invoke` returns a Promise that resolves with whatever the main handler returns. This is used for all of BigIDE's CRUD operations.

**Pattern 2 — Push Events (webContents.send + ipcRenderer.on):**

Like a pub/sub or callback:

```
Main:     win.webContents.send('event-name', data1, data2)
Renderer: ipcRenderer.on('event-name', (event, data1, data2) => {
            handleEvent(data1, data2)
          })
```

The main process can push events at any time without the renderer asking. Used in BigIDE for terminal output, task status changes, governance approvals, and notifications.

---

### Reading in BigIDE

#### `src/main/index.ts` — Read line by line

```
Line 1-3:   Imports from electron and node
Line 5:     mainWindow declared at module scope (null initially)
Lines 7-43: createWindow() function:
              Line 8: new BrowserWindow({...}) — this is how Electron creates a visible window
              Lines 9-10: width/height — initial window dimensions
              Lines 15-21: webPreferences — CRITICAL SECURITY SETTINGS:
                preload: path to the preload script
                contextIsolation: true — renderer cannot access Node.js APIs
                nodeIntegration: false — renderer cannot require() Node modules
                sandbox: false — needed for node-pty native module
                (webviewTag is not set — browser panel uses iframe + local HTTP server instead)
              Line 24: hide menu bar (app has its own UI for this)
              Lines 27-30: route external link clicks to system browser
              Lines 33-35: auto-open DevTools in development mode
              Lines 38-42: load the renderer: dev server URL or built HTML file
Lines 45-52: app.whenReady() — like main() entry point:
              Registers IPC handlers BEFORE creating window
              Creates the window
              Handles macOS re-activation (dock click when no windows open)
Lines 54-56: app.on('window-all-closed') — quit on Windows/Linux when last window closes
              (macOS apps conventionally stay running with no windows)
Lines 58-60: getMainWindow() — exported so other modules can send events to the renderer
```

#### `src/preload/index.ts` — Read line by line

This file is the security boundary. Read it carefully.

```
Lines 1:    Import contextBridge and ipcRenderer from electron
Lines 3-70: Build the 'api' object — every method is a wrapper
            Pattern for request/response:
              projectList: () => ipcRenderer.invoke('project:list')
              // No arguments → invoke with just channel name
              taskCreate: (task: any) => ipcRenderer.invoke('task:create', task)
              // Arguments are passed after the channel name

            Pattern for event subscription (lines 43-69):
              onTerminalData: (cb: ...) => {
                // Wrap the callback to strip Electron's internal 'event' parameter
                const listener = (_: any, ptyId: string, data: string) => cb(ptyId, data)
                ipcRenderer.on('terminal:data', listener)
                // Return a cleanup function — caller must call this to unsubscribe
                return () => ipcRenderer.removeListener('terminal:data', listener)
              }
Lines 72:   contextBridge.exposeInMainWorld('bigide', api)
            // This makes window.bigide available in the renderer
            // The renderer cannot see ipcRenderer directly — only this safe API
Line 74:    Export the type — so TypeScript in the renderer knows window.bigide's shape
```

The `_: any` in event listeners is the Electron `IpcRendererEvent` object. The renderer doesn't need it (it contains Electron internals), so the wrapper strips it, only passing the actual data arguments to the callback.

#### `src/main/ipc-handlers.ts` — Read line by line

This is the backend service registry. Every call from the renderer ends up here.

The file structure:
- Imports from all service modules (store, pty-manager, git-service, etc.)
- One `registerIpcHandlers()` function that registers every handler
- Handlers are thin: they validate input, call services, and return results
- The `_` parameter in `ipcMain.handle('channel', (_, ...args) => ...)` is the IpcMainInvokeEvent — BigIDE doesn't need it, so it's discarded

The handlers demonstrate the service layer architecture. The IPC handler for `task:create`:
1. Receives the task data from the renderer
2. Generates a new UUID for the ID
3. Calls `createWorktree()` from the git service
4. Calls `addTask()` from the store
5. Returns the complete task object

This pattern — thin handler, delegating to services — keeps the IPC layer free of business logic.

---

### Exercises

**Exercise 4.1 — Trace a round trip:**
Start at `src/renderer/stores/workspace-store.ts`, function `loadProjects`. Trace the complete execution path:

1. `window.bigide.projectList()` is called
2. Find where `projectList` is defined in `src/preload/index.ts`
3. Find where `'project:list'` is handled in `src/main/ipc-handlers.ts`
4. Find where `getProjects()` is implemented in `src/main/store.ts`
5. Follow the response back: return value → Promise resolution → `set({ projects })` → React re-render

Draw this as a sequence diagram with the three processes (renderer / preload / main) as columns.

**Exercise 4.2 — Trace a push event:**
Start at `src/main/output-parser.ts`, function `emitStatusChange`. Trace:
1. `win.webContents.send('task:status-changed', ...)` in `output-parser.ts`
2. The listener registered in `src/preload/index.ts` (`onTaskStatusChanged`)
3. The subscription in `src/renderer/stores/task-store.ts` (the `window.bigide.onTaskStatusChanged(...)` call at the top)
4. How `_updateTaskStatus` modifies the store
5. How React components subscribed to this store data re-render

**Exercise 4.3 — Add a new IPC channel:**
Add a new channel `app:get-version` that returns the current app version from `package.json`.

Steps:
1. In `src/shared/types.ts`, add `'app:get-version': () => string` to `IpcChannels`
2. In `src/main/ipc-handlers.ts`, add:
   ```typescript
   import { app } from 'electron'
   // inside registerIpcHandlers():
   ipcMain.handle('app:get-version', () => app.getVersion())
   ```
3. In `src/preload/index.ts`, add:
   ```typescript
   getVersion: () => ipcRenderer.invoke('app:get-version'),
   ```
4. In the browser console (DevTools in the running app), call:
   ```javascript
   await window.bigide.getVersion()
   ```
   You should see the version string from `package.json`.

**Exercise 4.4 — Security thought experiment:**
What would happen if you added `nodeIntegration: true` to `BrowserWindow`'s webPreferences? What could a malicious `<script>` tag (injected via XSS) do with access to `require('fs')`? Why does context isolation solve this?

---

## Module 5: React — Building User Interfaces

### Goals

By the end of this module you will understand:
- What a component is and how components compose into trees
- JSX syntax and how it compiles to JavaScript
- The four most important hooks: useState, useEffect, useRef, useCallback
- How data flows in React: props down, callbacks up
- How BigIDE's component tree is structured

---

### Theory

#### Components

A React component is a function that returns a description of UI. That description is written in JSX — a syntax extension that looks like HTML embedded in JavaScript.

```typescript
// The simplest possible component
function Greeting({ name }: { name: string }) {
  return <h1>Hello, {name}!</h1>
}

// Using it: <Greeting name="Alice" />
// React calls the function, gets the JSX, turns it into DOM nodes
```

The C++ analogy: a component is like a function that returns a `QWidget*`, but instead of constructing actual objects, it returns a *description* of what the UI should look like. React reconciles that description against the real DOM and applies only the necessary changes. This is the Virtual DOM pattern.

#### JSX

JSX is syntactic sugar. The Babel/TypeScript compiler transforms:

```jsx
<button className="btn" onClick={handleClick}>
  Click me
</button>
```

Into:

```javascript
React.createElement('button', { className: 'btn', onClick: handleClick }, 'Click me')
```

Rules:
- JSX attributes use camelCase: `className` not `class`, `onClick` not `onclick`
- `{}` interpolates any JavaScript expression: `{count}`, `{user.name}`, `{isLoading ? 'Loading...' : 'Done'}`
- Components start with uppercase: `<TaskCard>` calls the `TaskCard` function; `<div>` creates a DOM element
- Every JSX tree must have one root element (or use `<>...</>` fragment syntax)

#### useState

`useState` declares a piece of state — data that, when changed, causes the component to re-render.

```typescript
const [count, setCount] = useState(0)
// count: current value (0 initially)
// setCount: function to update the value, triggers re-render
```

The Java mental model: `count` is like a private field, `setCount` is like a setter, except React manages the re-render cycle. You must use `setCount` (never mutate `count` directly) to trigger a re-render.

```typescript
// Wrong: mutating state directly — no re-render
count = count + 1

// Right: using setter — triggers re-render
setCount(count + 1)
setCount(prev => prev + 1)  // preferred form when new state depends on old state
```

#### useEffect

`useEffect` runs side effects in response to renders. A side effect is anything that reaches outside the component: subscribing to events, fetching data, setting up timers, directly manipulating the DOM.

```typescript
useEffect(() => {
  // This runs after the component renders
  console.log('Component mounted or updated')

  // Return a cleanup function (optional)
  return () => {
    console.log('Cleanup: component unmounted or before next effect')
  }
}, [dependency1, dependency2])
// The dependency array controls WHEN the effect re-runs:
// [] — run once on mount, cleanup on unmount (like constructor/destructor)
// [dep] — run whenever dep changes
// omitted — run after every render (dangerous, rarely correct)
```

The C++ analogy:
- Constructor (setup) = the body of the effect function
- Destructor (cleanup) = the returned cleanup function
- The dependency array = "only re-construct when these values change"

#### useRef

`useRef` stores a mutable value that persists across renders but does NOT trigger re-renders when changed. The most common use is holding a reference to a DOM element.

```typescript
const containerRef = useRef<HTMLDivElement>(null)

// In JSX: attach the ref to a DOM element
return <div ref={containerRef} />

// Then in a useEffect, access the actual DOM node
useEffect(() => {
  const element = containerRef.current  // the real <div> DOM node
  // do something with it...
}, [])
```

#### Props and Data Flow

Props are the inputs to a component — like constructor arguments that can be any type, including functions (callbacks).

```typescript
interface TaskCardProps {
  task: AgentTask
  isSelected?: boolean
  onSelect: (taskId: string) => void  // callback prop
}

function TaskCard({ task, isSelected, onSelect }: TaskCardProps) {
  return (
    <div onClick={() => onSelect(task.id)}>
      {task.title}
    </div>
  )
}
```

Data flows **down** (parent → child via props). Events flow **up** (child → parent via callback props). This one-way data flow makes React applications predictable.

---

### Reading in BigIDE

#### `src/renderer/main.tsx`

```
Line 1: import React — needed for error boundary JSX usage
Line 2: ReactDOM.createRoot — the React 18+ API for mounting the root
Line 3: import App from './App' — the root component
Line 4: import './styles.css' — CSS is loaded as a side effect of importing

Lines 7-10: Global error handler — if React crashes catastrophically, show a red error box
Lines 12-14: Unhandled promise rejection handler

Lines 16-25: Mount React into #root:
  document.getElementById('root') — finds the empty <div> from index.html
  ReactDOM.createRoot(root).render(<React.StrictMode><App /></React.StrictMode>)
  StrictMode: development-only wrapper that double-invokes effects to catch bugs
```

#### `src/renderer/App.tsx`

This is the root component. Read it carefully.

```
Lines 1-9: Imports — hooks, store selectors, component imports

Line 12: export default function App() — functional component declaration

Line 13: const focusedProjectId = useWorkspaceStore(s => s.focusedProjectId)
         — subscribe to one piece of store state (covered in Module 6)
         — when focusedProjectId changes, App re-renders

Line 14: const loadProjects = useWorkspaceStore(s => s.loadProjects)
         — get the action (function), won't cause re-renders when called

Line 15: const [listView, setListView] = useState(false)
         — local state: is the user in list view?

Lines 17-19: useEffect with [loadProjects] dependency
         — runs once on mount (loadProjects is stable across renders)
         — triggers the initial data load

Line 21: useKeyboardShortcuts() — sets up keyboard event listeners (Module 6)

Lines 23-43: Return JSX — the component tree:
  <div className="h-screen w-screen flex flex-col ...">  — full screen container
    <NotificationBar />                                   — always rendered at top
    <div className="flex-1 overflow-hidden flex">         — content area
      <ErrorBoundary>                                     — catch render errors
        {focusedProjectId ? (                             — ternary: project open?
          <ProjectView projectId={focusedProjectId} />    — yes: show project
        ) : listView ? (                                  — no: list view?
          <Sidebar /> + placeholder text                  — yes: show sidebar
        ) : (
          <CanvasView onToggleListView={...} />           — no: show canvas
        )}
      </ErrorBoundary>
    </div>
    <GovernanceModal />                                   — always rendered (hidden unless active)
  </div>
```

The three-way conditional `focusedProjectId ? A : listView ? B : C` is a nested ternary. When `focusedProjectId` is non-null, always show `ProjectView` regardless of `listView`. When it's null, choose between the canvas and list view.

#### `src/renderer/components/TaskCard.tsx`

A concrete component with real complexity. Read in order:

1. `StatusDot` sub-component (lines 12-22): A tiny component that maps a status string to a coloured dot. Notice the `Record<AgentTask['status'], string>` type — it enforces that every status has a colour.

2. `TaskCard` function (line 24): The main component. It receives `task` (data), `isSelected`/`isActive` (display state), and `onSelect` (callback).

3. Lines 26-61: Event handlers — each calls `e.stopPropagation()` to prevent the click from bubbling up to the parent `onClick`. This is the browser event bubbling mechanism.

4. Lines 68-184: JSX return value. Note how the action buttons section (lines 116-183) conditionally renders different buttons based on `task.status`. This is a state machine expressed as JSX.

#### `src/renderer/components/ErrorBoundary.tsx`

This is the only *class component* in BigIDE. Class components are the older React API. Error boundaries can only be implemented as class components (as of React 19).

```
getDerivedStateFromError: static method called when a child throws — returns new state
componentDidCatch: called after an error is caught — good for error logging
render: if error state is set, show fallback UI; otherwise render children
```

In any other circumstance, prefer functional components with hooks.

---

### Exercises

**Exercise 5.1 — Read the component tree:**
With the app running, open React DevTools (install the Chrome extension, it works in Electron). Navigate the component tree. Find `App`, then `ProjectView`, then `TaskBoard`, then individual `TaskCard` components. See how props flow down.

**Exercise 5.2 — Add a banner component:**
Create `src/renderer/components/WelcomeBanner.tsx`:
```typescript
export function WelcomeBanner({ message }: { message: string }) {
  return (
    <div className="bg-blue-900 px-4 py-2 text-sm text-blue-100">
      {message}
    </div>
  )
}
```
Import and render it at the top of the canvas view (somewhere in `CanvasView.tsx`). Pass a static string as the `message` prop. Verify it appears.

**Exercise 5.3 — Trace all useState calls:**
In `src/renderer/components/NotificationBar.tsx`, find every `useState` call. For each, write:
- What is the initial value?
- What event triggers a state change?
- What changes in the UI when this state changes?

**Exercise 5.4 — Understand effect cleanup:**
In `src/renderer/components/TerminalPanel.tsx`, the `useEffect` at line 17 returns a cleanup function (lines 101-107). List every cleanup action it performs. Why is each cleanup necessary if the component unmounts? What would happen if `terminal.dispose()` was not called?

**Exercise 5.5 — Trace conditional rendering:**
Starting in `App.tsx`, trace the complete logic to determine which main component renders when:
(a) No projects have been added yet
(b) The user has just launched the app with projects saved
(c) The user clicks on a project node in the canvas

---

## Module 6: State Management with Zustand

### Goals

By the end of this module you will understand:
- Why global state management is needed in a component tree
- How Zustand stores work: shape, actions, selectors
- How stores in BigIDE subscribe to IPC events at initialization time
- How to trace a user action through the store to the UI

---

### Theory

#### The Problem: Prop Drilling

Imagine a deeply nested component tree. A leaf component needs data that only lives in the root component. Passing that data through every intermediate component as props is called "prop drilling," and it's painful:

```
App (has projects state)
  └── Layout
        └── Sidebar
              └── ProjectList
                    └── ProjectItem  (needs projects data)
```

You'd have to thread `projects` through `Layout`, `Sidebar`, and `ProjectList` even though they don't use it. This also means any change to `projects` re-renders all intermediate components.

#### The Solution: A Global Store

A store is a singleton object outside the component tree. Any component can subscribe to exactly the parts it needs. Updates only re-render components that subscribed to changed data.

The observer pattern in Java:
```java
class ProjectStore {
  private List<Project> projects = new ArrayList<>();
  private List<Observer> observers = new ArrayList<>();

  void setProjects(List<Project> p) {
    this.projects = p;
    observers.forEach(o -> o.update());  // notify
  }
}
```

Zustand encapsulates this pattern in about 10 lines:

```typescript
import { create } from 'zustand'

interface CounterState {
  count: number
  increment: () => void
  reset: () => void
}

const useCounterStore = create<CounterState>((set) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
  reset: () => set({ count: 0 }),
}))
```

Using it in a component:
```typescript
function Counter() {
  // This component only re-renders when `count` changes
  const count = useCounterStore((state) => state.count)
  const increment = useCounterStore((state) => state.increment)

  return <button onClick={increment}>{count}</button>
}
```

The function passed to `useCounterStore` is called a **selector**. It extracts a specific slice of state. The component only re-renders if the selected value changes (by shallow comparison).

#### Zustand's `set` Function

The `set` function merges updates into the current state:

```typescript
// Merge style (partial update, existing keys preserved)
set({ count: 5 })

// Functional style (when new state depends on previous)
set((state) => ({ count: state.count + 1 }))

// get() reads current state without subscribing
const { tasks } = get()
```

---

### Reading in BigIDE

#### `src/renderer/stores/workspace-store.ts`

The simplest store. Read line by line:

- **Shape** (lines 4-12): two data fields (`projects` array, `focusedProjectId`) and five action functions
- **`create<WorkspaceState>((set) => ({...}))`**: the Zustand factory — one function call creates the entire store
- **`loadProjects`** (lines 18-25): calls `window.bigide.projectList()` (IPC), then calls `set` with the result. Notice the async/await and try/catch.
- **`addProject`** (lines 27-45): opens a file dialog (IPC), derives project name from path, calls `window.bigide.projectAdd()` (IPC), uses the functional `set` form to append to the existing array
- **`updateCanvasPosition`** (lines 63-74): a good example of `set` with a map operation — updates one item in the array without mutating the original

#### `src/renderer/stores/task-store.ts`

More complex. The crucial section is at lines 20-26:

```typescript
export const useTaskStore = create<TaskState>((set, get) => {
  // Subscribe to task:status-changed events (guard for preload availability)
  if (typeof window !== 'undefined' && window.bigide) {
    window.bigide.onTaskStatusChanged((taskId, status, needsInput) => {
      get()._updateTaskStatus(taskId, status as TaskStatus, needsInput)
    })
  }
  return { ... }
})
```

This is **event-driven state management**: the store subscribes to IPC events at creation time. When the main process pushes a `task:status-changed` event (from the output parser), the store updates immediately. No polling. No manual refresh. Any component subscribed to task data automatically re-renders.

The `if (typeof window !== 'undefined' && window.bigide)` guard handles the case where the store module is imported in a context without Electron's preload (e.g., unit tests or server-side rendering). It's defensive programming.

Note `get()` inside the callback — this is how you read current state in a non-reactive context (not inside a component). `get()` is the second parameter of the `create` callback.

**`_findTask` and `_updateTaskStatus`** (lines 158-176): The underscore prefix signals these are "internal" helpers. `_findTask` iterates over a `Record<string, AgentTask[]>` (tasks keyed by projectId). `_updateTaskStatus` uses `set` with a deep object transformation to update a single task in a nested structure.

#### `src/renderer/stores/notification-store.ts`

Shorter and shows the same IPC subscription pattern. Notable: `markRead` keeps the `unreadCount` derived automatically from the array — it's re-computed inside the `set` callback every time. This is an inline derived value (not memoised; fine at this scale).

#### `src/renderer/stores/governance-store.ts`

The simplest event-driven store. One piece of state: `pendingApproval`. When `governance:approval-needed` fires, it's set. When `respond` is called, IPC is invoked and state is cleared.

---

### Exercises

**Exercise 6.1 — Trace a task creation:**
Starting from a button click in `src/renderer/components/TaskCreateModal.tsx` (find this file), trace the complete path:
1. User fills form and clicks "Create"
2. Store action `createTask` is called
3. IPC `task:create` is invoked
4. Main process handler runs in `ipc-handlers.ts`
5. Worktree is created in `git-service.ts`
6. Task is stored via `store.ts`
7. Response returned to store
8. Store updates its `tasks` map
9. `TaskBoard` component re-renders showing the new task

Write this as a numbered list of function calls with file names.

**Exercise 6.2 — Add a filter to the task store:**
In `src/renderer/stores/task-store.ts`, add a new field:
```typescript
statusFilter: TaskStatus | 'all'
setStatusFilter: (filter: TaskStatus | 'all') => void
```
Implement `setStatusFilter` using `set`. This is a UI filter that doesn't need IPC. Notice how easy it is to add state to a Zustand store compared to Redux.

**Exercise 6.3 — Understand selector re-renders:**
In `src/renderer/App.tsx`:
```typescript
const focusedProjectId = useWorkspaceStore(s => s.focusedProjectId)
```
If `useWorkspaceStore(s => s.projects)` were used instead (subscribed to the whole project list), when would `App` re-render? Would it re-render more or less often? Why does selector precision matter for performance?

---

## Module 7: Styling with TailwindCSS

### Goals

By the end of this module you will understand:
- The CSS box model, flexbox, and basic layout concepts
- TailwindCSS's utility-first philosophy
- How to decode and modify Tailwind class names in BigIDE components
- Why BigIDE's dark theme looks consistent without custom CSS

---

### Theory

#### CSS Fundamentals

Every HTML element is a rectangular box. The box model:

```
┌─────────────────────────────────────┐
│ margin (outside the border)         │
│  ┌───────────────────────────────┐  │
│  │ border                        │  │
│  │  ┌─────────────────────────┐  │  │
│  │  │ padding                 │  │  │
│  │  │  ┌───────────────────┐  │  │  │
│  │  │  │ content           │  │  │  │
│  │  │  └───────────────────┘  │  │  │
│  │  └─────────────────────────┘  │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

**Flexbox** is a layout model for arranging elements in a row or column. It replaced floats and positioning for most layout needs.

Key flex properties:
```css
.container {
  display: flex;           /* activate flexbox */
  flex-direction: row;     /* or column */
  justify-content: center; /* align on main axis */
  align-items: center;     /* align on cross axis */
  gap: 8px;                /* space between items */
}
.item {
  flex: 1;                 /* grow to fill available space */
  flex-shrink: 0;          /* don't shrink below natural size */
}
```

**Positioning:**
```css
position: relative;  /* item, positioned relative to itself */
position: absolute;  /* item, positioned relative to nearest non-static ancestor */
position: fixed;     /* item, positioned relative to viewport */
```

**Units:**
```css
px   /* pixels — absolute */
rem  /* relative to root font size (16px by default) */
vh   /* viewport height percentage */
vw   /* viewport width percentage */
%    /* percentage of parent */
```

#### TailwindCSS: Utility-First

Traditional CSS:
```css
/* custom.css */
.card {
  background-color: #1f2937;
  border-radius: 8px;
  padding: 12px;
  border: 1px solid #374151;
}
```
```html
<div class="card">...</div>
```

TailwindCSS (utility-first):
```html
<div class="bg-gray-800 rounded-lg p-3 border border-gray-700">...</div>
```

Every Tailwind class applies one or two CSS properties. The class names follow a consistent naming convention:

| Pattern | Example | Meaning |
|---|---|---|
| `bg-{color}-{shade}` | `bg-gray-800` | background-color |
| `text-{color}-{shade}` | `text-gray-100` | color |
| `p-{n}` | `p-4` | padding: 1rem (n × 0.25rem) |
| `px-{n}` | `px-3` | padding-left + padding-right |
| `py-{n}` | `py-2` | padding-top + padding-bottom |
| `m-{n}` | `m-2` | margin |
| `w-{n}` | `w-64` | width: 16rem |
| `h-{n}` | `h-8` | height: 2rem |
| `w-full` | `w-full` | width: 100% |
| `h-screen` | `h-screen` | height: 100vh |
| `flex` | `flex` | display: flex |
| `flex-col` | `flex-col` | flex-direction: column |
| `items-center` | `items-center` | align-items: center |
| `justify-between` | `justify-between` | justify-content: space-between |
| `gap-{n}` | `gap-2` | gap: 0.5rem |
| `rounded-{size}` | `rounded-lg` | border-radius |
| `border` | `border` | border-width: 1px |
| `border-{color}` | `border-gray-700` | border-color |
| `text-{size}` | `text-sm` | font-size |
| `font-{weight}` | `font-medium` | font-weight |
| `overflow-hidden` | `overflow-hidden` | overflow: hidden |
| `cursor-pointer` | `cursor-pointer` | cursor: pointer |
| `transition-colors` | `transition-colors` | transition on color changes |
| `hover:{class}` | `hover:bg-gray-700` | applied on hover |
| `flex-1` | `flex-1` | flex: 1 1 0% (grow to fill) |
| `flex-shrink-0` | `flex-shrink-0` | flex-shrink: 0 |
| `truncate` | `truncate` | overflow: hidden + text-overflow: ellipsis |
| `animate-pulse` | `animate-pulse` | pulsing opacity animation |
| `fixed` | `fixed` | position: fixed |
| `inset-0` | `inset-0` | top/right/bottom/left: 0 |
| `z-{n}` | `z-50` | z-index: 50 |

**Arbitrary values** use square brackets:
```html
<div class="bg-[#0f0f13] w-[320px] text-[13px]">...</div>
```

TailwindCSS v4 (used in BigIDE) configures via CSS files (`@import "tailwindcss"`) rather than a `tailwind.config.js`. The theme colours follow the Tailwind default palette.

---

### Reading in BigIDE

#### `src/renderer/styles.css` and `src/renderer/app.css`

Both files start with `@import "tailwindcss"`. In TailwindCSS v4, this single import makes all utility classes available globally. The rest of each file provides:
- Overrides for third-party component styles (xterm, React Flow)
- Scrollbar customisation (non-standard but supported in Chromium)

#### `src/renderer/components/TaskCard.tsx` — Decode the styles

Focus on the outermost `<div>` (lines 69-76):
```
rounded         → border-radius: 0.25rem
border          → border-width: 1px
p-3             → padding: 0.75rem
transition-colors → CSS transition on color properties
mb-2            → margin-bottom: 0.5rem
cursor-pointer  → cursor: pointer

Conditional (selected):
  border-blue-500   → border-color: #3b82f6 (blue)
  bg-gray-750       → background: custom hex (not standard Tailwind — note it would need a custom value)

Conditional (not selected):
  border-gray-700   → border-color: #374151
  bg-gray-800       → background-color: #1f2937
  hover:border-gray-600 → on hover, border becomes #4b5563
```

Now decode the `StatusDot` component. The `base` string is shared classes. The `colors` object maps each status to its dot colour. `animate-pulse` makes the `running` dot pulse — a built-in Tailwind animation.

#### `src/renderer/components/GovernanceModal.tsx` — Overlay pattern

Lines 36-38: The overlay uses `fixed inset-0 z-50` to cover the entire viewport at the highest z-index. `bg-black/70 backdrop-blur-sm` creates the semi-transparent darkened background with a blur effect. This is a standard modal pattern in Tailwind.

---

### Exercises

**Exercise 7.1 — Change task card background:**
In `src/renderer/components/TaskCard.tsx`, find where non-selected task cards get `bg-gray-800`. Change it to `bg-indigo-950`. Observe the result.

**Exercise 7.2 — Add a border to task cards:**
Find the `rounded border p-3` classes on the outer div. Add `shadow-lg` to give cards a drop shadow. TailwindCSS provides built-in shadow utilities.

**Exercise 7.3 — Make the notification bell bigger:**
In `src/renderer/components/NotificationBar.tsx`, find the bell button. It currently has `h-7 w-7` (28px × 28px). Change it to `h-9 w-9` and adjust the icon size from `text-sm` to `text-base`. Verify in the running app.

**Exercise 7.4 — Decode a complex layout:**
In `App.tsx`, decode this class string:
```
h-screen w-screen flex flex-col bg-[#0f0f13] text-gray-100
```
Write the equivalent CSS rules. Then decode:
```
flex-1 overflow-hidden flex
```
Explain why `flex-1` is important here (what would happen if it were missing?).

**Exercise 7.5 — Build a new styled component:**
Build a small `Badge` component:
```typescript
function Badge({ label, variant }: { label: string; variant: 'success' | 'error' | 'warning' }) {
  const styles = {
    success: 'bg-green-900 text-green-300 border-green-700',
    error: 'bg-red-900 text-red-300 border-red-700',
    warning: 'bg-yellow-900 text-yellow-300 border-yellow-700',
  }
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${styles[variant]}`}>
      {label}
    </span>
  )
}
```
Render `<Badge label="success" variant="success" />` somewhere visible. Experiment with the Tailwind classes.

---

## Module 8: Terminal Emulation with xterm.js

### Goals

By the end of this module you will understand:
- What a pseudo-terminal (PTY) is and why it matters
- How ANSI escape codes work for terminal colour and formatting
- How xterm.js renders a terminal in the browser
- The complete data flow for keyboard input and process output in BigIDE

---

### Theory

#### What Is a PTY?

A pseudo-terminal (PTY) is a virtual terminal device — a software abstraction that makes a process believe it is running inside a real terminal (like an old VT100 physical terminal). It consists of two ends:

- **Master side**: The application controlling the terminal (BigIDE's main process). Writes to master = data sent to the slave's stdin. Reads from master = data the process wrote to its stdout/stderr.
- **Slave side**: The spawned process (bash, PowerShell, claude). It thinks it's talking to a real terminal.

Why is this necessary? Because many programs behave differently when not attached to a terminal:
- Programs disable colour output when stdout is a pipe (not a TTY)
- Programs like `claude` check `isatty(STDOUT_FILENO)` to decide whether to use interactive mode
- The terminal also handles signals: typing `Ctrl+C` sends `SIGINT` to the foreground process

Compare to C on Linux:
```c
// Opens a PTY master
int master_fd = posix_openpt(O_RDWR);
// The slave is the actual terminal the child process talks to
int slave_fd = open(ptsname(master_fd), O_RDWR);
// Fork and exec with slave as stdin/stdout/stderr
```

`node-pty` wraps this platform-specific (Linux/macOS: POSIX PTY, Windows: ConPTY) behaviour.

#### ANSI Escape Codes

Terminal programs communicate appearance via escape codes embedded in the output stream. These are sequences starting with `\x1b[` (ESC + `[`):

```
\x1b[32m Hello \x1b[0m      — green text, then reset to default
\x1b[1m Bold text \x1b[22m  — bold on, then bold off
\x1b[2J                      — clear entire screen
\x1b[H                       — move cursor to home position (0,0)
\x1b[A                       — move cursor up one line
```

xterm.js parses these sequences and renders the appropriate colours, cursor positions, and formatting. This is why a terminal in BigIDE can display coloured output from tools like `git diff` or `npm install` — the raw byte stream contains these codes, xterm.js interprets them.

#### xterm.js Architecture

xterm.js is a terminal emulator that renders in a browser `<canvas>` element (or DOM, via a renderer addon). It:

1. Maintains an internal buffer of terminal cells (characters + attributes)
2. Parses incoming data (from the PTY) and updates the buffer
3. Renders the buffer to canvas efficiently (only changed rows)
4. Captures user keystrokes and reports them as raw bytes via `terminal.onData`

Addons extend the terminal:
- `FitAddon`: recalculates column/row count to fit the container's pixel dimensions
- `WebLinksAddon`: detects URLs in output and makes them clickable

---

### Reading in BigIDE

#### `src/main/pty-manager.ts` — Read line by line

```
Lines 1-9:  Lazy-load node-pty (native module, may fail in some environments)
Lines 11-15: PtyInstance interface — just the process handle and an ID
Line 16:    ptys: Map<string, PtyInstance> — registry of active terminals
Lines 18-53: createPty():
              - Determine shell path: COMSPEC on Windows, SHELL on Unix
              - pty.spawn(): create PTY process
                  name: 'xterm-256color' — tells the process it's a 256-color terminal
                  cols/rows: initial terminal dimensions
                  cwd: working directory for the shell
                  env: inherit parent process environment
              - Store in ptys Map
              - proc.onData: forward raw output to renderer via IPC (webContents.send)
              - proc.onExit: cleanup on process death
Lines 55-58: writeToPty(): forward input from renderer to PTY stdin
Lines 60-65: killPty(): send SIGTERM to the process and clean up
Lines 68-71: resizePty(): tell PTY about new dimensions (SIGWINCH equivalent)
Lines 73-80: getPty(), getAllPtyIds(): accessors for the parser
```

The `proc.onData` callback (lines 40-44) is the core output path: every byte the subprocess writes goes to the renderer via `win.webContents.send('terminal:data', id, data)`. This is the push event path.

#### `src/renderer/components/TerminalPanel.tsx` — Read line by line

This is one of the most complex components. Read the entire `useEffect` body carefully.

```
Lines 17-109: useEffect with [ptyId, taskId] dependency
              — runs when ptyId or taskId changes (i.e., when a task is started)
              — cleanup on unmount or when dependencies change

Lines 20-50: Initialize xterm.js Terminal:
              - theme object: map terminal colour names to hex values
              - fontFamily: monospace fonts in priority order
              - scrollback: 5000 lines of history

Lines 52-57: Initialize addons:
              - FitAddon: auto-sizing
              - WebLinksAddon: clickable URLs

Lines 55-57: Load addons into terminal (must happen before open())

Line 57:     terminal.open(containerRef.current) — mount terminal into DOM

Lines 60-62: requestAnimationFrame(() => fitAddon.fit())
              — fit AFTER the browser has laid out the container
              — rAF ensures the DOM has been painted before we measure

Lines 68-72: terminal.onData((data) => window.bigide.taskSendInput(taskId, data))
              — every keystroke → send to main process → write to PTY stdin

Lines 75-81: window.bigide.onTerminalData((incomingPtyId, data) => {...})
              — subscribe to PTY output events
              — filter by ptyId (multiple terminals may be active)
              — terminal.write(data) renders the data in the terminal

Lines 85-96: ResizeObserver:
              — fires whenever the container element changes size
              — calls fitAddon.fit() to recalculate cols/rows
              — reports new dimensions to main process via IPC (terminal:resize)
              — main calls resizePty(), which sends SIGWINCH to the child process

Lines 101-107: Cleanup function:
               — dispose terminal input listener
               — unsubscribe from IPC events (call the cleanup function returned by onTerminalData)
               — disconnect ResizeObserver
               — dispose xterm.js Terminal (releases canvas, memory)
```

#### `src/renderer/hooks/useTerminal.ts`

A custom hook that extracts the terminal data subscription into a reusable abstraction. Note `onDataRef` (line 18-19): storing the callback in a ref prevents the `useEffect` from re-running every time the callback function reference changes (because inline arrow functions create a new reference on every render).

---

### Exercises

**Exercise 8.1 — Trace a keystroke:**
You press `g` in the terminal. Trace the full path:
1. xterm.js `onData` fires with `'g'`
2. `window.bigide.taskSendInput(taskId, 'g')` is called
3. Preload `taskSendInput` invokes IPC channel `task:send-input`
4. Handler in `ipc-handlers.ts` calls `sendInputToAgent`
5. `agent-launcher.ts` `sendInputToAgent` calls `writeToPty`
6. `pty-manager.ts` `writeToPty` calls `instance.process.write('g')`
7. `g` is delivered to the shell's stdin

Write this as a numbered list of function calls with file names.

**Exercise 8.2 — Trace a line of output:**
The shell outputs `$ git status`. Trace the path back to the screen:
1. PTY master receives bytes from shell process
2. `proc.onData` fires in `pty-manager.ts`
3. `win.webContents.send('terminal:data', id, data)` is called
4. Preload `onTerminalData` listener fires
5. IPC event arrives in `TerminalPanel.tsx`'s subscription
6. `terminal.write(data)` renders it in xterm

**Exercise 8.3 — Change the terminal appearance:**
In `TerminalPanel.tsx`, modify the `theme` object:
- Change `background` from `'#0d1117'` to `'#000000'` (pure black)
- Change `foreground` from `'#c9d1d9'` to `'#00ff00'` (green text)
- Change `fontSize` from `13` to `15`
Observe the result in a running terminal.

**Exercise 8.4 — Understand ResizeObserver:**
The `ResizeObserver` calls `window.bigide.terminalResize(ptyId, cols, rows)` whenever the container resizes. Trace this call to `resizePty` in `pty-manager.ts`. What does `instance.process.resize(cols, rows)` do to the running process? (Hint: look up SIGWINCH.) Why is it important to send the new dimensions to the PTY?

---

## Module 9: Git Integration

### Goals

By the end of this module you will understand:
- Git worktrees and why they enable parallel agent work
- How BigIDE creates and manages worktrees per task
- How unified diffs are generated and displayed
- How GitHub Pull Requests are created programmatically

---

### Theory

#### Git Worktrees

A normal git workflow: one repository, one working directory, one branch checked out at a time.

A git worktree allows multiple working directories from a single repository, each on a different branch, simultaneously:

```
repo/                    ← main worktree (main branch)
  .git/
  src/

../.bigide-worktrees/
  feature-x/             ← linked worktree (feature-x branch)
    src/
  bugfix-y/              ← linked worktree (bugfix-y branch)
    src/
```

This is exactly what BigIDE uses. Each AI agent task gets its own worktree, so multiple agents can work on different branches simultaneously without interfering. Compare to running parallel builds in separate directories in a C makefile.

Creating a worktree:
```bash
git worktree add -b new-branch /path/to/worktree base-branch
```

Removing one:
```bash
git worktree remove /path/to/worktree --force
```

#### Unified Diff Format

The output of `git diff main...feature-x` is a unified diff — a compact format for representing changes:

```diff
diff --git a/src/foo.ts b/src/foo.ts
index abc123..def456 100644
--- a/src/foo.ts
+++ b/src/foo.ts
@@ -10,7 +10,9 @@ function bar() {
   const x = 1
-  return x
+  const y = 2
+  return x + y
 }
```

- Lines starting with `-`: removed from the old version
- Lines starting with `+`: added in the new version
- Lines with neither prefix: unchanged context
- `@@` hunk headers: show the line number range and some context

The `react-diff-view` library (`Diff`, `Hunk`, `parseDiff` from the import) parses this text format into structured objects and renders them as a coloured side-by-side or unified view.

#### GitHub API via Octokit

Octokit is the official JavaScript client for the GitHub REST API. BigIDE uses it only to create pull requests:

```typescript
const octokit = new Octokit({ auth: token })
const { data } = await octokit.rest.pulls.create({
  owner,         // github username or org
  repo,          // repository name
  title,         // PR title
  body,          // PR description (Markdown)
  head,          // the source branch
  base,          // the target branch (usually main)
})
return data.html_url  // the URL of the created PR
```

---

### Reading in BigIDE

#### `src/main/git-service.ts` — Read line by line

**`createWorktree` (lines 5-14):**
```typescript
const worktreePath = join(repoPath, '..', '.bigide-worktrees', branchName)
```
Worktrees are placed in `.bigide-worktrees/` directory, sibling to the repo root. The `..` goes up one level from the repo to put worktrees outside the working tree (so they don't appear in `git status` of the main repo).

```typescript
await git.raw(['worktree', 'add', '-b', branchName, worktreePath, baseBranch])
```
`-b branchName` creates a new branch. `baseBranch` is the starting point (usually `main`). This is equivalent to `git worktree add -b <branch> <path> main`.

**`getDiff` (lines 34-45):**
```typescript
return await git.raw(['diff', `${baseBranch}...${branchName}`])
```
The three-dot `...` syntax compares the tip of `branchName` to the merge base with `baseBranch`. This shows only the changes introduced by the branch, not any changes on main that haven't been merged in. This is what you want for a PR review.

**`getDiffStats` (lines 47-67):**
Runs `git diff --stat` which produces summary output like:
```
 3 files changed, 45 insertions(+), 12 deletions(-)
```
Then uses regex to extract the numbers. Note the `.match()` pattern with `parseInt`.

**`createPullRequest` (lines 74-112):**
1. Pushes the branch: `git.push('origin', task.branchName)`
2. Dynamic import of `octokit` (lazy-loads the library only when needed)
3. Gets GitHub token from `GITHUB_TOKEN` env var or `gh auth token` CLI command
4. Creates the Octokit client with the token
5. Parses `owner/repo` from `project.githubRepo` string
6. Constructs PR body from `task.agentSummary` if available
7. Creates the PR via REST API
8. Returns the HTML URL

#### `src/renderer/components/DiffPanel.tsx`

The component structure:
1. `useEffect` fetches the diff string via `window.bigide.taskGetDiff(taskId)` when `taskId` changes
2. Handles three non-content states: loading, error, no changes
3. Calls `parseDiff(diffText)` from `react-diff-view` — returns an array of file objects
4. Computes stats by iterating the hunk/change structure
5. Renders a stats bar and a per-file diff view using `<Diff>` and `<Hunk>` components
6. Uses inline `<style>` to override `react-diff-view`'s default styles with BigIDE's dark theme

The `cancelled` flag (line 27) prevents state updates after the component unmounts — a common React pattern for cancelling async operations in `useEffect`.

---

### Exercises

**Exercise 9.1 — Trace the worktree lifecycle:**
Starting from the "Create Task" button in the UI, trace the complete worktree lifecycle:

1. User submits new task form
2. `task:create` IPC handler in `ipc-handlers.ts` creates worktree
3. Agent is started, works in the worktree
4. Task transitions to `needs-review`
5. User clicks "Create PR" → branch pushed → PR created → `prUrl` stored
6. User clicks "Cleanup" → `task:cleanup` handler → `removeWorktree()` called → PTY killed

**Exercise 9.2 — Understand three-dot diff:**
In a test git repository (or any local repo), run:
```
git diff main...HEAD
git diff main..HEAD
```
Note the difference: `...` shows changes since branching; `..` shows the full diff between tips. Why is `...` more appropriate for reviewing a feature branch?

**Exercise 9.3 — Inspect the DiffPanel:**
With a task in `needs-review` status, click "View Diff" to open the DiffPanel. Open DevTools, go to Network or use the Sources panel to inspect. What is the raw diff string that comes back from IPC? How does `parseDiff` transform it?

**Exercise 9.4 — Add push tracking:**
In `git-service.ts`'s `createPullRequest`, add a `console.log` before and after `git.push()` to log timing. Observe in the main process console (the terminal where `npm run dev` is running) when a PR is created.

---

## Module 10: Real-Time Output Parsing and Pattern Matching

### Goals

By the end of this module you will understand:
- How BigIDE detects agent state changes from raw PTY output
- Regular expressions for pattern matching in streaming text
- The state machine embedded in the output parser
- How tool calls are extracted and logged

---

### Theory

#### Regular Expressions

A regex is a pattern that matches text. JavaScript uses a `/pattern/flags` syntax:

```javascript
const pattern = /successfully\s+(created|updated)/i
//              ^          ^  ^              ^     ^
//              |          |  |              |     case insensitive flag
//              |          |  capturing group
//              |          \s+ = one or more whitespace chars
//              literal text

pattern.test('Successfully created the file')  // true
'File created. Done.'.match(/done[.!]?\s*$/im) // matches 'Done.'
```

Common quantifiers:
- `*` — zero or more
- `+` — one or more
- `?` — zero or one (also makes `+` and `*` non-greedy with `+?`)
- `{n,m}` — between n and m

Common character classes:
- `\s` — any whitespace
- `\d` — any digit
- `\w` — word character (letter, digit, underscore)
- `.` — any character except newline
- `[abc]` — character set
- `[^abc]` — negated character set

Flags:
- `i` — case insensitive
- `m` — multiline (^ and $ match line boundaries)
- `g` — global (find all matches, not just first)

#### Streaming Text Parsing

Agent output arrives as a stream of raw bytes over time. The parser accumulates this into a buffer and scans it for patterns that indicate state changes.

This is conceptually similar to a lexer/scanner phase of a compiler: you are reading a character stream and recognising tokens (patterns). In BigIDE's case, the "tokens" are:
- Completion signals (`"Successfully implemented..."`)
- Error signals (`"Error: ..."`)
- Input prompts (`"Press Enter..."`)
- Tool calls (`"Edited src/foo.ts"`)
- Governance-sensitive commands (`"$ git push"`)

The difference from a compiler lexer: this is not a formal grammar, so the parser uses heuristics (regex patterns) rather than a formal state machine. This can produce false positives (a comment in code containing "Error:" might trigger the error state), which is a known trade-off.

---

### Reading in BigIDE

#### `src/main/output-parser.ts` — Read line by line

**Pattern arrays (lines 19-58):**

Each pattern group is an array of regexes. Read each and understand what output would trigger it.

`NEEDS_INPUT_PATTERNS`: prompts waiting for user input:
- `/^[>❯]\s*$/m` — a line with only a shell prompt character
- `/\?\s*$/m` — a line ending with a question mark
- `/\(y\/n\)/i` — yes/no confirmation prompt
- `/press enter/i` — explicit "press enter" instruction
- `/waiting for input/i` — explicit wait message

`COMPLETION_PATTERNS`: signals the agent has finished:
- `/[✓✔]\s*.+completed/i` — checkmark + "completed"
- `/successfully\s+(created|updated|fixed|added|implemented)/i` — success verb
- `/all\s+\d+\s+tests?\s+passed/i` — test pass summary
- `/done[.!]?\s*$/im` — line ending with "done"

`ERROR_PATTERNS`: unrecoverable errors:
- `/^error:/im` — starts with "error:"
- `/[✗✘]\s+/m` — cross mark symbol
- `/fatal:/i`, `/panic:/i` — fatal error keywords
- `/unhandled\s+exception/i`, `/stack\s+trace/i` — exception indicators

`TOOL_PATTERNS` (lines 43-50): Each entry has a `pattern` and a `tool` name. The first capture group `(.+)` extracts the arguments (file path, command, etc.).

`GOVERNANCE_PATTERNS` (lines 53-58): Look for bash commands (`$`) followed by sensitive operations. These trigger the approval flow.

**`startOutputParsing` (lines 60-88):**
- Creates a `ParserState` object tracking the buffer and timing
- Subscribes to `ptyProcess.onData` — this means the parser sees the SAME data as the terminal display. One event, two subscribers (terminal forwarding in pty-manager + parsing here).
- Sets up an idle timer: if no output for 30 seconds and the task is still `running`, assume it needs input

**`processOutput` (lines 90-161):**
The main parsing loop runs on every data chunk:

1. Update `lastOutputTime` and append to buffer
2. Trim buffer to 10,000 chars (prevents unbounded memory growth — keep last 5,000 chars)
3. Update `lastOutputLine` in the store (shown in the task card's subtitle)
4. Check GOVERNANCE_PATTERNS — always first, before status decisions
5. Check TOOL_PATTERNS — extract and log tool calls
6. Check COMPLETION_PATTERNS — if matched, transition to `needs-review` and stop parsing
7. Check ERROR_PATTERNS — if matched, transition to `error`
8. Check NEEDS_INPUT_PATTERNS — if matched, set `needsInput: true` on task

Note the early `return` after completion (line 139, `stopParsing` + `return`). Once completed, no further parsing happens. Error and needs-input patterns do not stop parsing, because these can be transient (the agent might hit an error and recover).

#### `src/main/tool-log-service.ts`

**`logToolCall` (lines 5-17):** Appends an entry to the task's `toolLog` array (in the store) and immediately pushes it to the renderer via `webContents.send`.

**`generateAgentSummary` (lines 19-74):** Post-processing to create a human-readable Markdown summary. Groups file operations into "created" vs "modified" buckets, de-duplicates, and formats. This summary is used as the PR body in `createPullRequest`.

---

### Exercises

**Exercise 10.1 — List all patterns:**
Create a table with columns: Pattern Group, Regex, What It Detects, What Happens When Matched. Fill in a row for each of the 20+ patterns across all five arrays.

**Exercise 10.2 — Trace a completion event:**
Agent outputs `"Successfully implemented the new feature.Done."`. Trace:
1. `pty-manager.ts` `proc.onData` fires
2. Data forwarded to renderer and to parser
3. `processOutput` called
4. Which GOVERNANCE_PATTERN matches? None.
5. Which TOOL_PATTERN matches? None.
6. Which COMPLETION_PATTERN matches? `successfully\s+(created|updated|fixed|added|implemented)/i`? Actually yes — `Successfully implemented`.
7. `emitStatusChange(taskId, 'needs-review', false)` fires
8. `updateTask` sets status in store
9. `stopParsing` clears the interval timer
10. Renderer receives `task:status-changed` event
11. `_updateTaskStatus` in task-store updates the task's status
12. `TaskCard` re-renders with `needs-review` status and shows "View Diff", "Merge", "Create PR" buttons

**Exercise 10.3 — Add a new governance pattern:**
In `output-parser.ts`, add a pattern to detect `docker rm`:
```typescript
/\$\s+(docker\s+rm)/i,
```
Add it to `GOVERNANCE_PATTERNS`. Then in `src/shared/types.ts`, ensure `'docker rm'` is in the `DEFAULT_PERMISSIONS.requireApprovalFor` array. Conceptually trace what would happen if an agent ran `$ docker rm my-container`.

**Exercise 10.4 — Understand idle detection:**
The idle timer fires every 5 seconds. It checks if output stopped for 30 seconds and if so, sets `needsInput: true`. In what scenario would this be a false positive? (Hint: what if the agent is just computing something slowly?) How could you make this heuristic more accurate?

---

## Module 11: Governance and Security

### Goals

By the end of this module you will understand:
- How permission models work in BigIDE
- The complete approval flow from detection to resolution
- How denial sends a cancellation signal to the running process
- How Electron's security model (context isolation) relates to BigIDE's governance model

---

### Theory

#### Permission Models

BigIDE's governance is a simplified RBAC (Role-Based Access Control) system with two mechanisms:

1. **Categorical permissions**: Boolean flags controlling broad capabilities (file write, bash execution, network access, git push). These are checked synchronously and immediately deny or allow without user interaction.

2. **Pattern-based approval list**: A list of command patterns that require user confirmation before proceeding. These interrupt the agent and wait for the user to click Approve or Deny.

This is analogous to:
- Android app permissions (REQUEST_INTERNET, WRITE_EXTERNAL_STORAGE) for the categorical booleans
- `sudo` prompts in Unix for the approval list
- UAC (User Account Control) dialogs in Windows

The defence-in-depth principle: multiple independent layers of protection, so a compromised layer does not mean total compromise.

#### Signal-Based Cancellation

When a user clicks "Deny", BigIDE sends `Ctrl+C` to the running process:

```typescript
writeToPty(task.ptyId, '\x03')
```

`\x03` is the ASCII control character for ETX (End of Text), which in terminal context is interpreted as SIGINT by the TTY layer — the same signal sent when a user presses `Ctrl+C` in a terminal. Most interactive programs (including `claude`) handle SIGINT by cancelling the current operation.

This is the correct approach for a PTY-attached process. A cleaner alternative for programmatic use would be to spawn the process with a handle and call `process.kill(pid, 'SIGINT')`, but since BigIDE already has the PTY, writing `\x03` is the natural choice.

---

### Reading in BigIDE

#### `src/main/governance-service.ts` — Read line by line

**`DEFAULT_PROJECT_PERMISSIONS` (lines 77-83):**
Defined at module level — the same default exported from `src/shared/types.ts`. Both `governance-service.ts` and `types.ts` define identical defaults, which is a small code duplication (could be unified). The defaults are conservative: file writes and bash are allowed (necessary for the agent to function), but network access and git push are off by default.

**`checkPermission` (lines 13-29):**
Called by the `task:check-permission` IPC handler when the renderer wants to query permission. Returns a boolean synchronously. Note the order:
1. Check `allowFileWrite`, `allowBash`, `allowNetworkAccess`, `allowGitPush` — these are category denials (no approval flow)
2. Check `requireApprovalFor` patterns — if matched, return `false` (not directly allowed)

The function returns `false` for anything in `requireApprovalFor`, even though the actual approval flow goes through `checkGovernanceAction` (called from the output parser). This makes the permission model consistent: `checkPermission` is a yes/no query; the approval UI is separate.

**`checkGovernanceAction` (lines 31-55):**
Called from `output-parser.ts` when a GOVERNANCE_PATTERN matches in the PTY output.
1. Checks if the action is in `requireApprovalFor`
2. If yes: sends `governance:approval-needed` event to renderer with the action text
3. Logs the approval request to the tool log

Note: this function does NOT pause execution. JavaScript is single-threaded — there is no `wait for approval` primitive. The agent's PTY output continues streaming. The current design is a best-effort governance check rather than a hard block. For a production-quality system, you would need to pause the PTY (by not reading from it) until approval is received.

**`handleGovernanceResponse` (lines 58-74):**
Called from the `governance:respond` IPC handler when the user clicks Approve or Deny.
1. Logs the decision (Approved/Denied) to the tool log
2. If denied: writes `\x03` (Ctrl+C) to the PTY to cancel the current operation

#### `src/renderer/stores/governance-store.ts`

The minimal store: subscribes to `governance:approval-needed` at creation time, sets the `pendingApproval` state. The `respond` action calls IPC and clears the state.

#### `src/renderer/components/GovernanceModal.tsx`

When `pendingApproval` is non-null (line 21: `if (!pendingApproval) return null`), the modal renders. When null, the component returns nothing — it's invisible but always mounted.

The `alwaysAllow` checkbox (lines 71-80) is a UI placeholder — the underlying functionality is not yet implemented (there is no code to add the action to a permanent allow list). This is honest code: the UI acknowledges a future feature without breaking anything.

The `responding` state (line 19) prevents double-submission if the user clicks rapidly.

---

### Exercises

**Exercise 11.1 — Trace a complete governance flow:**
Trace every step from detection to resolution for the scenario: agent outputs `$ git push origin feature-x`:

1. `processOutput` in `output-parser.ts` receives data
2. GOVERNANCE_PATTERNS loop: `/\$\s+(git\s+push)/i` matches, `match[1]` = `'git push'`
3. `checkGovernanceAction(taskId, 'git push')` is called
4. `task.permissions.requireApprovalFor` contains `'git push'` → approval needed
5. `win.webContents.send('governance:approval-needed', taskId, 'git push', '...')` fires
6. Preload `onGovernanceApprovalNeeded` listener fires
7. `governance-store`'s subscription receives the event, sets `pendingApproval`
8. `GovernanceModal` component re-renders, becomes visible
9. User clicks "Approve"
10. `respond(taskId, true)` calls `window.bigide.governanceRespond(taskId, true)` (IPC)
11. `handleGovernanceResponse(taskId, true)` in `governance-service.ts`:
    - Logs "Approved by user"
    - Does NOT write `\x03` (approved, so no cancel)
12. `pendingApproval` is set to null
13. `GovernanceModal` disappears

If the user clicks "Deny", step 11 writes `\x03` to the PTY, cancelling the git push command.

**Exercise 11.2 — Add a new governance pattern:**
Task: add governance for any `npm install --save` command (a non-interactive npm package install):
1. Add `/\$\s+(npm\s+install\s+--save)/i` to `GOVERNANCE_PATTERNS` in `output-parser.ts`
2. Add `'npm install --save'` to the `requireApprovalFor` array in `DEFAULT_PERMISSIONS` in `src/shared/types.ts`
3. Test by running a task that would execute this command

**Exercise 11.3 — Understand the non-blocking governance:**
Read `checkGovernanceAction` again. There is no `await` or blocking — the function fires and returns immediately. Meanwhile the PTY continues writing output. Write a paragraph explaining: what could go wrong with this approach? (Hint: what if the agent's next output is the actual `git push` output, arriving before the user clicks Approve/Deny?)

**Exercise 11.4 — Review the security model:**
BigIDE runs AI agents in PTYs with access to the local file system. What are the three main defences it provides against harmful agent actions? What attacks do they NOT protect against? Write this as a threat model paragraph.

---

## Module 12: Putting It All Together — The Complete Picture

### Goals

By the end of this module you will:
- Understand the complete lifecycle of a task from creation to cleanup
- Be able to identify every architectural pattern used in BigIDE
- Understand the build pipeline from TypeScript source to distributable app
- Have ideas for extending the codebase yourself

---

### Theory

#### Architectural Patterns in BigIDE

BigIDE uses several classic software architecture patterns. Identifying them helps you reason about the codebase and design extensions:

**Bridge Pattern (Preload Layer):**
The preload script is a Bridge between two incompatible interfaces: Electron's `ipcRenderer` API (which the renderer cannot access) and the renderer's `window` object. `contextBridge.exposeInMainWorld` creates the bridge.

**Observer Pattern (IPC Event Subscriptions):**
Zustand stores subscribe to IPC events at creation time. Any state change in the main process immediately propagates to any subscribed React component. This is the Observer pattern: subjects (main process services) notify observers (Zustand stores) of state changes.

**State Machine (Task Status):**
`TaskStatus` is a finite set of states: `todo → running → needs-review → done` (and `error` as an exceptional state). The output parser drives transitions from `running` to `needs-review` or `error`. The user drives transitions from `todo → running` (start) and `needs-review → done` (cleanup). This is a deterministic finite automaton (DFA).

**Repository Pattern (store.ts):**
`store.ts` is a Repository — it abstracts the persistence mechanism (the JSON file) from the rest of the application. Services call `getProjects()`, `addTask()`, etc. without knowing whether the backing store is a file, SQLite, or a remote API.

**Service Layer (git-service, pty-manager, agent-launcher):**
Each backend module encapsulates a coherent set of operations around one external system. `git-service.ts` owns all git operations. `pty-manager.ts` owns all PTY operations. IPC handlers are thin orchestrators that call these services.

**Command Pattern (Agent Commands):**
In `agent-launcher.ts`, `MODEL_COMMANDS` maps model names to functions that produce command strings. Each function is a Command object in the classic sense — an encapsulated operation that can be invoked uniformly. The map currently contains five entries: `gemini-cli` (default, runs `gemini -i "<prompt>"` in interactive mode), `claude-code`, `codex`, `copilot`, and `custom`.

#### Build Pipeline

```
TypeScript source (.ts, .tsx)
    │
    ▼
TypeScript compiler (tsc) — type checking only, no emit in dev
    │
    ▼
Vite + esbuild — transpile TS to JS, bundle modules
    │
    ├── Main process bundle → dist/main/index.js
    ├── Preload bundle → dist/preload/index.js
    └── Renderer bundle → dist/renderer/index.html + assets
    │
    ▼
electron-vite dev — launches:
    - Vite dev server for renderer (hot module replacement)
    - Electron pointing at http://localhost:5173 for renderer
    - Watches main/preload for changes, restarts on change

electron-vite build — produces optimised production bundles
    │
    ▼
electron-builder — packages into platform installer
    (.exe on Windows, .dmg on macOS, .AppImage on Linux)
```

---

### A Complete Task Lifecycle

Trace every step of the system for this scenario: user creates a task, agent runs and modifies code, governance check occurs, agent completes, PR is created, task is cleaned up.

#### Phase 1: Task Creation

1. User opens `TaskCreateModal` (find it in `src/renderer/components/`)
2. User fills in title, prompt, branch name, selects model, configures permissions
3. User clicks "Create Task"
4. `useTaskStore().createTask({...})` is called
5. `window.bigide.taskCreate(task)` → IPC `task:create`
6. Handler: `randomUUID()` generates task ID
7. `createWorktree(project.rootPath, task.branchName, project.defaultBranch)` runs
8. `git worktree add -b <branch> ../.bigide-worktrees/<branch> main` executes
9. `addTask(task)` persists to JSON store
10. Response: full `AgentTask` object returned to renderer
11. Store adds task to `tasks[projectId]` array
12. `TaskBoard` re-renders showing new card with `todo` status
13. "Start" button is visible

#### Phase 2: Agent Start

14. User clicks "Start" on the task card
15. `useTaskStore().startTask(taskId)` → IPC `task:start`
16. `launchAgent(task, project.rootPath)` in `agent-launcher.ts`:
    a. `createPty('agent-<taskId>', worktreePath)` creates a PTY shell
    b. Shell spawns in the worktree directory
    c. `activeAgents.set(task.id, ptyId)` records the mapping
    d. `updateTask(task.id, { ptyId, status: 'running' })` persists state
    e. `startOutputParsing(task.id, ptyId)` starts the parser
    f. After 1 second: `writeToPty(ptyId, 'claude "Write a test suite"\r')` sends the command
17. `updateTask(taskId, { status: 'running' })` in the IPC handler
18. `win.webContents.send('task:status-changed', taskId, 'running', false)` fires
19. Renderer task store updates: `_updateTaskStatus` sets status to `running`
20. `TaskCard` re-renders: blue pulsing dot, "Stop" button visible

#### Phase 3: Agent Runs

21. PTY output starts flowing as claude executes
22. Each data chunk from PTY goes to:
    a. `win.webContents.send('terminal:data', ptyId, data)` → rendered in xterm.js
    b. `processOutput(taskId, data)` in the parser
23. Parser extracts tool calls (`Edited src/auth.ts`) → `logToolCall()` → `task:tool-logged` event
24. Renderer `ToolLogPanel` updates showing tool activity
25. `updateTask(taskId, { lastOutputLine: '...' })` keeps the task card subtitle current

#### Phase 4: Governance Check

26. Claude outputs `$ git push origin feature-auth`
27. Parser GOVERNANCE_PATTERNS match: `git push`
28. `checkGovernanceAction(taskId, 'git push')` fires
29. `governance:approval-needed` event pushed to renderer
30. `governance-store` sets `pendingApproval`
31. `GovernanceModal` appears
32. User reads: "Agent wants to execute: git push"
33. User clicks "Approve"
34. `governance-store.respond(taskId, true)` → IPC `governance:respond`
35. `handleGovernanceResponse(taskId, true)` logs "Approved by user"
36. No `\x03` sent (approved)
37. Modal disappears, `pendingApproval` cleared

#### Phase 5: Completion

38. Claude outputs `"Successfully implemented the authentication module. Done."`
39. COMPLETION_PATTERN matches: `done[.!]?\s*$/im`
40. `emitStatusChange(taskId, 'needs-review', false)`
41. `updateTask(taskId, { status: 'needs-review' })` in store
42. `stopParsing(taskId)` clears the idle timer
43. Renderer receives `task:status-changed` → status becomes `needs-review`
44. `TaskCard` re-renders: yellow dot, "View Diff", "Merge", "Create PR" buttons visible
45. Notification generated: "Task X completed" → `notification:new` event
46. Bell icon shows unread count badge

#### Phase 6: Review and PR

47. User clicks "View Diff"
48. `DiffPanel` renders, calls `window.bigide.taskGetDiff(taskId)` → IPC `task:get-diff`
49. `getDiff(project.rootPath, task.branchName, project.defaultBranch)` runs `git diff main...feature-auth`
50. Unified diff string returned, `parseDiff()` called, diff rendered
51. User reviews changes, satisfied
52. User clicks "Create PR"
53. `useTaskStore().createPr(taskId)` → IPC `task:create-pr`
54. `createPullRequest(project, task)` in `git-service.ts`:
    a. `git push origin feature-auth`
    b. `execSync('gh auth token')` gets GitHub token
    c. `octokit.rest.pulls.create({...})` creates the PR
    d. Returns `data.html_url`
55. `updateTask(taskId, { prUrl })` persists the PR URL
56. Store updates `task.prUrl`
57. TaskCard can now show a link to the PR

#### Phase 7: Cleanup

58. User clicks "Cleanup" (or task transitions to `done` after merge)
59. `useTaskStore().cleanupTask(taskId)` → IPC `task:cleanup`
60. Handler:
    a. `killPty(task.ptyId)` terminates the shell process, frees PTY resources
    b. `removeWorktree(project.rootPath, task.worktreePath)` runs `git worktree remove --force`
    c. `updateTask(taskId, { status: 'done', ptyId: null })`
61. Store removes task from its tasks map
62. `TaskBoard` re-renders, card disappears

---

### Capstone Projects

Each project requires you to touch multiple layers of the stack. Pick one or more:

**Project A: Task Templates**
Save commonly used prompts as named templates. Requirements:
- New `TaskTemplate` type in `src/shared/types.ts`
- Storage in `store.ts` (new `templates` array in `StoreSchema`)
- IPC channels: `template:list`, `template:save`, `template:delete`
- UI: dropdown in `TaskCreateModal` to load a template

**Project B: Task Priority Levels**
Add `priority: 'low' | 'medium' | 'high' | 'critical'` to `AgentTask`. Requirements:
- Update `AgentTask` in `src/shared/types.ts`
- `TaskCreateModal` form input for priority
- `TaskCard` visual indicator (colour-coded border or badge)
- `TaskBoard` column sorting by priority

**Project C: Task History View**
Show completed tasks in an archive view. Requirements:
- New IPC channel `task:list-done` (tasks with status `done`)
- New `HistoryPanel` component with timeline layout
- Navigation button to open the history view
- Per-task summary card with PR link if available

**Project D: Keyboard Shortcuts**
Extend `src/renderer/hooks/useKeyboardShortcuts.ts` to add shortcuts. Current implementation handles basic global shortcuts. Add:
- `n` = new task in focused project
- `s` = start selected task
- `d` = view diff of selected task
- Visual shortcut hints in button tooltips

**Project E: Dark/Light Theme Toggle**
Add a theme toggle. Requirements:
- New `theme: 'dark' | 'light'` field in `workspace-store.ts`
- `ThemeProvider` component that sets a CSS class on `<html>`
- Tailwind `dark:` prefix classes are already used — add light mode colours
- Persist theme preference in Electron store

---

## Appendix A: Glossary

**ANSI escape codes**: Byte sequences embedded in terminal output to control colours, cursor movement, and formatting. Begin with `\x1b[`.

**async/await**: Syntactic sugar over Promises. `await` suspends a function until a Promise resolves, without blocking the event loop thread.

**BrowserWindow**: The Electron class that creates and manages a native OS window displaying a web page.

**Component (React)**: A function that returns JSX describing a piece of UI. Components compose into trees.

**Context isolation**: Electron security feature that prevents renderer JavaScript from accessing Node.js or Electron APIs directly, except through the preload bridge.

**contextBridge**: Electron API used in preload scripts to safely expose functions to the renderer's `window` object.

**DOM (Document Object Model)**: The browser's tree representation of an HTML document. JavaScript manipulates the DOM to change what the user sees.

**Electron**: A framework for building desktop applications using web technologies (Chromium + Node.js). Main process runs Node.js; renderer process runs Chromium.

**ESModules**: The native JavaScript module system using `import`/`export` syntax.

**Event loop**: The mechanism that makes JavaScript single-threaded but non-blocking. Processes one task at a time; tasks yield by awaiting Promises.

**Flexbox**: A CSS layout model for arranging elements in rows or columns with flexible sizing and alignment.

**Hook (React)**: A function whose name starts with `use` that gives functional components access to React features (state, effects, context, etc.).

**IPC (Inter-Process Communication)**: Mechanism for communication between Electron's main and renderer processes. Request/response via `invoke`/`handle`; push events via `send`/`on`.

**JSX**: A syntax extension for JavaScript that allows HTML-like markup in JS files. Compiled to `React.createElement()` calls.

**Node.js**: A JavaScript runtime built on Chrome's V8 engine. Adds file system, networking, child process, and other system APIs to JavaScript.

**npm**: Node Package Manager. Manages dependencies and runs project scripts.

**Octokit**: The official JavaScript client library for the GitHub REST and GraphQL APIs.

**Preload script**: A script that Electron runs before the renderer's JavaScript. Has limited Node.js access and can safely bridge APIs to the renderer via `contextBridge`.

**Promise**: A JavaScript object representing an asynchronous operation that will complete in the future, with either a resolved value or a rejected error.

**Props (React)**: Inputs to a React component. Passed from parent to child. Immutable from the component's perspective.

**PTY (Pseudo-Terminal)**: A virtual terminal device. The master side is controlled by the application; the slave side is seen by the child process as a real terminal.

**React**: A JavaScript library for building user interfaces via composable components and a Virtual DOM diffing algorithm.

**Renderer process**: The Chromium process in Electron that renders the application UI. Sandboxed; no direct Node.js access.

**ResizeObserver**: A browser API that fires a callback whenever a DOM element's size changes.

**Selector (Zustand)**: A function passed to a store hook that extracts specific state. Components only re-render when selected state changes.

**simple-git**: A Node.js library that wraps git command-line operations.

**State (React)**: Mutable data declared with `useState` (or stored in a Zustand store). Changing state triggers a re-render.

**TailwindCSS**: A utility-first CSS framework where you style elements by composing small, single-purpose CSS class names directly in HTML/JSX.

**TypeScript**: A typed superset of JavaScript. Adds static type checking at compile time; erased to plain JavaScript at runtime.

**Unified diff**: A text format for representing changes between two versions of a file. Produced by `git diff`. Lines prefixed `+` are additions, `-` are deletions.

**useEffect**: A React hook that runs side effects (subscriptions, timers, DOM mutations, data fetching) after renders. Returns a cleanup function.

**useRef**: A React hook that stores a mutable value that does not trigger re-renders. Often used to hold DOM element references.

**useState**: A React hook that declares reactive state. Returns a value and a setter function; calling the setter triggers a re-render.

**V8**: Google's high-performance JavaScript and WebAssembly engine. Powers Chrome and Node.js.

**Virtual DOM**: React's in-memory representation of the desired UI. React diffs it against the previous virtual DOM and applies only the necessary real DOM changes.

**Vite**: A fast build tool and dev server for web projects. Uses esbuild for bundling and provides hot module replacement.

**Worktree (git)**: A linked working directory checked out from the same repository, on its own branch. Allows multiple branches to be active simultaneously.

**xterm.js**: A browser-based terminal emulator library. Renders a fully functional terminal in a canvas element, parsing ANSI escape codes.

**Zustand**: A small, fast state management library for React. Uses a hook-based API with selectors for minimal re-renders.

---

## Appendix B: Recommended Resources

### JavaScript and TypeScript

- **JavaScript.info** (javascript.info) — the best free comprehensive guide to modern JavaScript. Start with "The JavaScript language" section.
- **TypeScript Handbook** (typescriptlang.org/docs) — the official docs. Read "The Basics", "Everyday Types", and "More on Functions".
- **You Don't Know JS** (Kyle Simpson, free on GitHub) — deep dive into JavaScript's core mechanics.

### React

- **React official documentation** (react.dev) — excellent interactive docs. Work through the full Tutorial then Quick Start.
- **React hooks reference** — read the reference for `useState`, `useEffect`, `useRef`, `useCallback`, `useMemo`.

### Electron

- **Electron official docs** (electronjs.org/docs) — read the "Getting started" guide and the "IPC tutorial". The security section is essential.
- **Electron Fiddle** — the official playground app for experimenting with Electron APIs.

### Node.js

- **Node.js official docs** (nodejs.org/docs) — reference for `fs`, `path`, `child_process`, `crypto` modules.
- **Node.js Design Patterns** (Mario Casciaro) — book covering patterns for async code, streams, and architectural patterns.

### CSS and TailwindCSS

- **CSS Tricks** (css-tricks.com) — best practical reference for flexbox, grid, and common CSS techniques.
- **TailwindCSS docs** (tailwindcss.com/docs) — use the search box to look up any class name. The "Core Concepts" section explains the philosophy.
- **Josh Comeau's CSS courses** (joshwcomeau.com) — interactive, visual explanations of CSS that work well for developers from other backgrounds.

### Git

- **Pro Git** (git-scm.com/book) — free comprehensive book. Read chapters 1–5 for the fundamentals. Chapter 7 covers worktrees.
- **git worktree documentation** — `man git-worktree` or `git help worktree`.

### Tooling

- **Vite docs** (vitejs.dev) — read the "Why Vite" guide and the configuration reference.
- **electron-vite docs** (electron-vite.org) — specific to the BigIDE toolchain.

---

## Appendix C: File-to-Concept Map

| File | Primary Concepts Demonstrated |
|---|---|
| `src/renderer/index.html` | HTML structure, SPA entry point, TailwindCSS dark class |
| `src/renderer/app.css` | CSS basics, TailwindCSS v4 import, box-sizing, scrollbar pseudo-elements |
| `src/renderer/styles.css` | CSS overrides for third-party libraries, WebKit scrollbar styling |
| `src/shared/types.ts` | TypeScript interfaces, union types, optional fields, utility types (Omit), const exports, IPC contract design |
| `tsconfig.json` | TypeScript compiler configuration, module resolution, path aliases, strict mode |
| `package.json` | npm ecosystem, dependency management, build scripts, semantic versioning |
| `src/main/index.ts` | Electron app lifecycle, BrowserWindow creation, context isolation, preload setup, macOS behaviour |
| `src/preload/index.ts` | contextBridge, ipcRenderer.invoke, ipcRenderer.on, event subscription with cleanup, TypeScript type export |
| `src/main/ipc-handlers.ts` | ipcMain.handle, service layer pattern, UUID generation, dialog API, IPC as thin orchestration layer |
| `src/main/store.ts` | electron-store (file persistence), Repository pattern, in-memory array manipulation |
| `src/main/git-service.ts` | simple-git library, Node.js child_process, git worktrees, unified diff format, Octokit GitHub API |
| `src/main/pty-manager.ts` | node-pty, PTY concepts, native Node.js modules, process lifecycle management, event forwarding to renderer |
| `src/main/agent-launcher.ts` | Command pattern, PTY creation orchestration, model abstraction, signal-based process control (Ctrl+C) |
| `src/main/output-parser.ts` | Regular expressions, streaming text parsing, finite state machine, setInterval idle detection, event-driven status transitions |
| `src/main/governance-service.ts` | Permission models, RBAC concepts, signal-based cancellation (\x03), synchronous vs asynchronous governance |
| `src/main/tool-log-service.ts` | Immutable array updates, Markdown generation, de-duplication with Set |
| `src/main/notification-service.ts` | Push notification pattern, event routing |
| `src/renderer/main.tsx` | React 18 root mounting, ReactDOM.createRoot, StrictMode, global error handlers |
| `src/renderer/App.tsx` | Root component pattern, conditional rendering, useEffect for data loading, component composition, keyboard shortcut hook |
| `src/renderer/components/TaskCard.tsx` | Props pattern, callback props, event.stopPropagation, status-driven conditional rendering, Tailwind utility classes |
| `src/renderer/components/ErrorBoundary.tsx` | Class component, getDerivedStateFromError, componentDidCatch, React error boundaries |
| `src/renderer/components/TerminalPanel.tsx` | xterm.js lifecycle, useRef for DOM elements, FitAddon, WebLinksAddon, ResizeObserver, IPC event subscription in component, effect cleanup |
| `src/renderer/components/DiffPanel.tsx` | Async data loading in useEffect, cancellation flag, react-diff-view library, inline style overrides, stats computation |
| `src/renderer/components/GovernanceModal.tsx` | Modal overlay pattern (fixed inset-0 z-50), conditional render (return null), loading state, Tailwind dark UI |
| `src/renderer/components/NotificationBar.tsx` | Dropdown pattern, useRef for click-outside detection, relative time formatting, Read badge indicator |
| `src/renderer/stores/workspace-store.ts` | Zustand create, store shape, async actions with IPC, functional set updates |
| `src/renderer/stores/task-store.ts` | IPC event subscription at store creation, nested state structure (Record<string, T[]>), _internal helpers, get() for non-reactive reads |
| `src/renderer/stores/notification-store.ts` | Event-driven state, derived unread count |
| `src/renderer/stores/governance-store.ts` | Single-item state, event subscription pattern, IPC action and state clear |
| `src/renderer/hooks/useTerminal.ts` | Custom hook pattern, useRef to stabilise callback, IPC subscription with cleanup |
| `src/renderer/hooks/useKeyboardShortcuts.ts` | Global event listener pattern, keyboard event handling |
| `src/renderer/lib/types.ts` | Renderer-local type augmentation, window.bigide type declaration |
| `electron.vite.config.ts` | Vite + Electron build configuration, TailwindCSS plugin, path resolution |
| `electron-builder.yml` | Distribution packaging configuration |

---

*This study plan was written for BigIDE version 0.1.0, March 2026. The codebase is the primary source of truth — when in doubt, read the code.*
