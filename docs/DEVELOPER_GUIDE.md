# BigIDE Developer Guide

**Audience:** Developers with C/C++/Java experience who are new to web and Electron development.

This guide will walk you through every step needed to understand, run, and extend BigIDE. Nothing is assumed except that you know how to write code in a compiled, statically-typed language. Every web/JavaScript concept is explained from first principles using analogies you already know.

---

## Table of Contents

1. [Understanding the Tech Stack](#part-1-prerequisites--environment-setup)
2. [Installing Prerequisites](#2-installing-prerequisites-windows)
3. [Clone and Run](#3-clone-and-run)
4. [Directory Structure](#4-directory-structure)
5. [How Electron Works](#5-how-electron-works)
6. [How React Works](#6-how-react-works)
7. [How Zustand Works](#7-how-zustand-works)
8. [How TypeScript Works](#8-how-typescript-works)
9. [Making Changes](#9-making-changes)
10. [Adding a New Feature End-to-End](#10-adding-a-new-feature-end-to-end)
11. [Adding a New IPC Channel](#11-adding-a-new-ipc-channel)
12. [Adding a New React Component](#12-adding-a-new-react-component)
13. [Debugging](#13-debugging)
14. [Building for Production](#14-building-for-production)
15. [Common Errors and Solutions](#15-common-errors-and-solutions)
16. [Naming Conventions](#16-naming-conventions)
17. [Patterns Used in the Codebase](#17-patterns-used-in-the-codebase)

---

# Part 1: Prerequisites & Environment Setup

## 1. Understanding the Tech Stack

Before you install anything, it helps to know what each technology does and why it exists. Every item below has an analogy to something you already know.

### Node.js — The JavaScript Runtime

**What it is:** Node.js is a program that runs JavaScript outside of a web browser. It is built on the V8 JavaScript engine (the same engine inside Chrome).

**Analogy:** Think of it as the JVM for JavaScript. Just as `java MyProgram` executes Java bytecode, `node myScript.js` executes JavaScript. Node.js also gives JavaScript access to the operating system — file I/O, network sockets, spawning child processes — things that browser JavaScript cannot do for security reasons.

**Why we use it:** BigIDE's backend (the part that reads files, runs terminal sessions, and calls Git) is written in TypeScript that runs on Node.js.

**Version used:** 18 or higher (LTS recommended).

---

### npm — The Package Manager

**What it is:** npm (Node Package Manager) is Node.js's built-in package manager. It reads a file called `package.json` (the equivalent of `pom.xml` in Maven or `build.gradle` in Gradle) and downloads all listed dependencies into a folder called `node_modules/`.

**Analogy:** Maven for Java, or pip for Python. `npm install` is the equivalent of `mvn dependency:resolve`.

**Key commands:**
- `npm install` — download all dependencies listed in `package.json`
- `npm run <script>` — run a named script from `package.json`
- `npm install some-library` — add a new dependency and save it to `package.json`

---

### Electron — The Desktop App Framework

**What it is:** Electron is a framework that packages a Chromium browser engine and a Node.js runtime into a single desktop application. Your application is essentially a web page running inside a bundled browser, with full access to native OS APIs through Node.js.

**Analogy:** Think of Qt or wxWidgets, but instead of native widgets, the UI is rendered by a full web browser engine. The backend logic runs in Node.js rather than C++.

**Architecture:** Electron has two types of processes:
- **Main process** — a Node.js process (your "backend server")
- **Renderer process** — a Chromium browser window (your "frontend")

These two processes communicate via IPC (Inter-Process Communication), similar to how a client and server communicate, except everything is local.

---

### React — The UI Library

**What it is:** React is a JavaScript library for building user interfaces. You describe your UI as a tree of components, and React efficiently updates the real browser DOM when data changes.

**Analogy:** Think of it like building a GUI from composable widgets. Each React component is like a class that knows how to render itself and respond to data changes. Unlike Qt or Swing where you write imperative code to update individual widgets, React is declarative — you describe what the UI *should* look like given some data, and React figures out what changed.

**Version used:** React 19.

---

### TypeScript — Typed JavaScript

**What it is:** TypeScript is a superset of JavaScript that adds a static type system. TypeScript files (`.ts`, `.tsx`) are compiled to plain JavaScript before being run or bundled. The compiler checks types at compile time but produces no runtime overhead.

**Analogy:** TypeScript is to JavaScript what Java is to dynamically typed scripting. You get interfaces, generics, union types, and compile-time errors instead of mysterious runtime crashes.

**Key difference from Java:** TypeScript types are *erased* at compile time. There is no reflection over types at runtime. Types exist purely to help you and the compiler catch mistakes early.

---

### Vite — The Build Tool

**What it is:** Vite is a modern build tool that compiles TypeScript, bundles modules, and serves a development server with hot module replacement (HMR) — meaning changes to your source files are reflected in the running app almost instantly without a full restart.

**Analogy:** Think of it as a combination of Make/Gradle (build system) + a development server with live reload. It replaces older tools like Webpack.

**electron-vite** is a wrapper around Vite that handles the three parts of an Electron app (main, preload, renderer) with a single config file.

---

### TailwindCSS — Utility-First Styling

**What it is:** Tailwind is a CSS framework that provides small, single-purpose utility classes like `text-sm`, `bg-gray-900`, `flex`, `p-4`. Instead of writing separate CSS files with custom class names, you apply styles directly in your JSX markup.

**Analogy:** Instead of writing `button.setBackground(Color.DARK_GRAY)` and `button.setFont(Font.SMALL)` in separate files, you write `className="bg-gray-800 text-sm"` inline.

**Why it works:** The build tool scans your source files, finds every Tailwind class you actually use, and generates a minimal CSS file containing only those rules. You never write a CSS file by hand.

---

### Zustand — State Management

**What it is:** Zustand is a small, fast state management library for React. You define global stores (objects with data and methods), and any React component that reads from a store will automatically re-render when that store's data changes.

**Analogy:** A thread-safe singleton registry. Imagine a global `HashMap<String, Object>` that any class in your application can read from, but with the special property that any object "watching" a key is automatically notified and re-rendered when the value changes.

**Version used:** Zustand 5.

---

## 2. Installing Prerequisites (Windows)

Follow every step in this exact order. Do not skip steps.

### Step 1: Install Node.js

1. Open your browser and go to `https://nodejs.org`
2. Click the **LTS** (Long Term Support) download button. As of 2026, this will be Node.js 22.x or similar. Any version 18 or higher works.
3. Run the downloaded installer (`node-v*.msi`).
4. Accept all defaults. On the "Tools for Native Modules" page, **check the box** that says "Automatically install the necessary tools." This will also install Chocolatey and some build tools. Let it run in the PowerShell window that opens — it takes several minutes.
5. When complete, open a new Command Prompt (search "cmd" in Start Menu) and verify:

```
node --version
```
You should see something like `v22.0.0`.

```
npm --version
```
You should see something like `10.0.0`.

If you get "command not found", close and reopen your Command Prompt (the PATH variable update requires a new session).

---

### Step 2: Install Git

1. Go to `https://git-scm.com/download/win`
2. Download the 64-bit installer.
3. Run the installer. On the "Adjusting your PATH environment" page, select **"Git from the command line and also from 3rd-party software"** (the middle option).
4. Accept all other defaults.
5. Open a new Command Prompt and verify:

```
git --version
```
You should see something like `git version 2.44.0.windows.1`.

---

### Step 3: Install Python 3

Python is required to compile `node-pty`, which is a native Node.js addon that provides real terminal (PTY) functionality. It uses Python as part of its build process.

1. Go to `https://www.python.org/downloads/`
2. Download the latest Python 3.x installer (3.11 or 3.12 is fine).
3. Run the installer. **On the first screen, check "Add Python to PATH"** before clicking Install. This is critical.
4. Open a new Command Prompt and verify:

```
python --version
```
You should see something like `Python 3.12.0`.

---

### Step 4: Install Visual Studio Build Tools (C++ Workload)

`node-pty` is a native addon written in C++. To compile it on Windows, Node.js needs the Microsoft C++ compiler. The easiest way to get this is through Visual Studio Build Tools.

**Option A: If the Node.js installer offered to install tools (Step 1)**

The PowerShell window that opened during Node.js installation may have already done this. Check by opening a Command Prompt and running:

```
where cl.exe
```

If you see a path to `cl.exe`, you already have the compiler. Skip to Step 5.

**Option B: Manual installation**

1. Go to `https://visualstudio.microsoft.com/downloads/`
2. Scroll down to "Tools for Visual Studio" and download **"Build Tools for Visual Studio 2022"**.
3. Run the installer.
4. In the workload selector, check **"Desktop development with C++"**.
5. On the right panel, make sure the following are checked:
   - MSVC v143 - VS 2022 C++ x64/x86 build tools
   - Windows 11 SDK (or Windows 10 SDK)
6. Click "Install". This downloads several gigabytes and takes time.
7. When complete, verify in a new Command Prompt:

```
where cl.exe
```

You should see a path like `C:\Program Files (x86)\Microsoft Visual Studio\...`.

---

### Step 5: Install an AI Agent CLI

BigIDE launches AI agents (like Claude Code) in terminal sessions. You need at least one agent CLI installed globally.

For Gemini CLI (default model):
```
npm install -g @google/gemini-cli
```

Verify:
```
gemini --version
```

For Claude Code:
```
npm install -g @anthropic-ai/claude-code
```

Verify:
```
claude --version
```

For other agents, refer to their documentation and install them globally via npm or another installer. BigIDE supports any agent that can be invoked from the command line.

---

### Step 6: Verify Everything

Open a fresh Command Prompt and run all of these:

```
node --version
npm --version
git --version
python --version
gemini --version
```

All five should print version numbers without errors. If any fail, revisit the corresponding installation step and ensure you opened a new Command Prompt after installation (so PATH changes take effect).

If you installed a different agent (e.g., Claude Code) as your primary agent, substitute `claude --version` for `gemini --version` in the check above. Gemini CLI is the default model in BigIDE but is not strictly required if you select a different model when creating tasks.

---

## 3. Clone and Run

### Step 1: Clone the Repository

Open a Command Prompt, navigate to where you want the project to live, and run:

```
git clone <repository-url> bigide
cd bigide
```

Replace `<repository-url>` with the actual URL. If you already have the files locally, just `cd` into the `bigide` directory.

---

### Step 2: Install Dependencies

```
npm install
```

**What this does:** npm reads `package.json` and downloads every listed library into the `node_modules/` folder. This folder can be hundreds of megabytes. It is gitignored and should never be committed. If you delete it, just run `npm install` again to restore it.

The `postinstall` script in `package.json` runs automatically after installation:
```
"postinstall": "electron-builder install-app-deps || echo postinstall rebuild failed"
```

This recompiles native addons (like `node-pty`) specifically for the Electron version being used, rather than the system Node.js version. If you see "postinstall rebuild failed" printed, that is usually acceptable — it means no native addons needed rebuilding. If `node-pty` fails later, see the troubleshooting section.

---

### Step 3: Start the Development Server

```
npm run dev
```

**What this does:** This runs `electron-vite dev`, which:
1. Compiles the TypeScript in `src/main/` and `src/preload/` using Vite
2. Starts a Vite development server for the renderer (`src/renderer/`)
3. Launches Electron, pointing it at the dev server

**What you should see:**

In the terminal:
```
  ➜  Local:   http://localhost:5173/
  ➜  Network: http://localhost:5173/

  electron-vite v3.x.x
  build started...
  build finished.
```

Then an Electron window opens. It will be a dark-themed application showing a canvas view. Chrome DevTools will open automatically at the bottom of the window (only in development mode).

**Hot reload:** If you edit a file in `src/renderer/`, the browser portion of the window updates automatically within a second or two. If you edit files in `src/main/`, you must stop (`Ctrl+C`) and run `npm run dev` again.

---

# Part 2: Understanding the Codebase

## 4. Directory Structure

Here is every file and folder, with an explanation of what it does:

```
bigide/
├── src/
│   ├── main/              # Node.js backend process
│   ├── preload/           # Security bridge between processes
│   ├── renderer/          # React frontend (runs in browser)
│   └── shared/            # Types shared between all three
├── docs/                  # Documentation
├── package.json           # Dependencies and build scripts
├── tsconfig.json          # TypeScript compiler configuration
├── electron.vite.config.ts # Build configuration for all three processes
└── electron-builder.yml   # Packaging configuration for production builds
```

### src/main/ — The Backend

This is Node.js code. It has full access to the filesystem, can spawn processes, open sockets, and do everything a native application can do. It runs in a hidden process — you never see its window.

| File | Purpose |
|------|---------|
| `index.ts` | Application entry point. Creates the Electron `BrowserWindow`, registers IPC handlers, and wires up app lifecycle events (ready, window-close, etc.). |
| `ipc-handlers.ts` | Defines all the "API endpoints" the frontend can call. Each handler is registered with `ipcMain.handle('channel:name', fn)`. Think of this as your REST controller layer. |
| `pty-manager.ts` | Creates and manages pseudo-terminals (PTYs) — real terminal sessions (bash/cmd/powershell) that agents run in. Uses the `node-pty` native addon. |
| `agent-launcher.ts` | Spawns AI agent processes inside PTYs. Knows how to invoke `gemini` (default), `claude`, `codex`, etc. with the right command-line arguments. `MODEL_COMMANDS` maps model keys to command templates; `gemini-cli` is listed first and is the default. |
| `git-service.ts` | All Git operations: creating worktrees, reading diffs, merging branches, creating GitHub pull requests. Uses the `simple-git` library. |
| `output-parser.ts` | Watches terminal output and detects patterns like "task complete", "needs input", "error occurred". Updates task status accordingly. |
| `governance-service.ts` | The permission system. Checks whether an agent's action (e.g., `git push`) requires human approval. Sends approval requests to the renderer and waits for the user's response. |
| `tool-log-service.ts` | Appends entries to a task's activity log (which files were read/written, which tools were used). |
| `store.ts` | Persistent data storage using `electron-store`, which writes a JSON file to the user's app data directory. Contains `projects` and `tasks` arrays. Think of this as a minimal embedded database. |
| `notification-service.ts` | Creates and pushes notification objects to the renderer when tasks complete, error, or need attention. |

### src/preload/ — The Security Bridge

| File | Purpose |
|------|---------|
| `index.ts` | Runs in a special privileged context that has access to both the Node.js IPC API and the renderer's JavaScript environment. It defines the `window.bigide` API object that the renderer uses to call the main process. This is a security boundary — only the functions explicitly exposed here are callable from the renderer. |

### src/renderer/ — The Frontend

This React code runs inside the Chromium browser engine. It has no direct access to the filesystem or Node.js — only what the preload bridge exposes.

| File/Folder | Purpose |
|-------------|---------|
| `main.tsx` | Entry point. Mounts the root React component into the HTML page. |
| `App.tsx` | Root component. Decides which top-level view to show: canvas view, project view, or sidebar list. |
| `index.html` | The HTML skeleton that Vite uses as the entry point. |
| `app.css` / `styles.css` | Global CSS, primarily Tailwind imports and font setup. |
| `components/` | All React UI components (see below). |
| `stores/` | Zustand state stores (the global state layer). |
| `hooks/` | Custom React hooks that encapsulate reusable logic. |
| `lib/types.ts` | Re-exports from `@shared/types` for convenient importing within the renderer. |

**Key components:**

| Component | What it renders |
|-----------|----------------|
| `App.tsx` | Top-level layout: notification bar + main content area + governance modal |
| `canvas/CanvasView.tsx` | The interactive canvas with project nodes (uses ReactFlow / `@xyflow/react`) |
| `canvas/ProjectNode.tsx` | A single project card on the canvas |
| `canvas/TaskNode.tsx` | A single task card on the canvas |
| `ProjectView.tsx` | The main editing view when a project is focused: sidebar + panels |
| `Sidebar.tsx` | Left sidebar showing project list |
| `TaskBoard.tsx` | Kanban-style board with columns: Todo, Running, Review, Done |
| `TaskCard.tsx` | A single task card in the board |
| `TaskCreateModal.tsx` | Modal dialog for creating a new task |
| `TerminalPanel.tsx` | Embeds the xterm.js terminal for a task's PTY |
| `TerminalTabs.tsx` | Tab bar for switching between task terminals |
| `DiffPanel.tsx` | Shows git diff output using `react-diff-view` |
| `AgentSummaryPanel.tsx` | Shows the AI agent's self-reported summary |
| `ToolLogPanel.tsx` | Shows the log of tools the agent used |
| `BrowserPanel.tsx` | Embedded `<iframe>` backed by a local HTTP file server (`file-server.ts`) for live task preview |
| `NotificationBar.tsx` | Top bar showing pending notifications |
| `GovernanceModal.tsx` | Modal that appears when an agent requests human approval |
| `ErrorBoundary.tsx` | Catches React render errors and shows a fallback UI |
| `PanelLayout.tsx` | Manages the resizable panel layout using `react-resizable-panels` |

**Stores:**

| Store | Contents |
|-------|---------|
| `workspace-store.ts` | List of projects, which project is currently focused |
| `task-store.ts` | All tasks keyed by project ID, task operations |
| `governance-store.ts` | Current pending governance approval request |
| `notification-store.ts` | List of notifications |

**Hooks:**

| Hook | Purpose |
|------|---------|
| `useIpc.ts` | Wraps `window.bigide` calls with error handling |
| `useTerminal.ts` | Sets up an xterm.js terminal instance for a PTY |
| `useKeyboardShortcuts.ts` | Global keyboard shortcut bindings |
| `useNotifications.ts` | Subscribes to `notification:new` events from main process |

### src/shared/ — Shared Types

| File | Purpose |
|------|---------|
| `types.ts` | TypeScript interfaces shared between main, preload, and renderer. `Project`, `AgentTask`, `TaskStatus`, `ToolLogEntry`, `TaskPermissions`, `Notification`, and the typed IPC channel maps. |

---

## 5. How Electron Works

### The Two-Process Model

An Electron application is always two processes running on your machine simultaneously:

```
┌─────────────────────────────┐     IPC      ┌──────────────────────────────┐
│        MAIN PROCESS          │ ←─────────→ │      RENDERER PROCESS         │
│   (Node.js, hidden window)  │             │  (Chromium browser window)    │
│                              │             │                               │
│  - Read/write files         │             │  - Draw UI with React         │
│  - Spawn processes (PTYs)   │             │  - Handle user input          │
│  - Call Git / GitHub API    │             │  - Display terminal output    │
│  - Persist data to disk     │             │  - No direct OS access        │
│                              │             │                               │
│  src/main/index.ts          │             │  src/renderer/main.tsx        │
└─────────────────────────────┘             └──────────────────────────────┘
                                   ↑
                            PRELOAD SCRIPT
                         (runs in renderer but
                          has access to IPC)
                         src/preload/index.ts
```

**Analogy for C++/Win32 developers:** The main process is like a Win32 backend thread that owns system handles. The renderer is like the message-pump thread that owns the window. They communicate via a message queue — but in Electron that queue is Chromium's IPC mechanism.

**Analogy for Java/Swing developers:** The main process is like your service layer (data access, business logic). The renderer is like your EDT (Event Dispatch Thread) that owns the GUI. IPC is like invoking service methods from the EDT via `SwingWorker`, except the call crosses a process boundary.

### Why Two Processes?

Security. Browser JavaScript is sandboxed. If an attacker exploits your renderer (e.g., via malicious content in a webview), they cannot directly access the filesystem or spawn processes because the renderer has no Node.js access. The main process controls what operations the renderer can request through the preload bridge.

### The Preload Script

The preload script runs in the renderer process but *before* the renderer's JavaScript executes. It has access to both `ipcRenderer` (to talk to main) and the renderer's `window` object. It uses `contextBridge.exposeInMainWorld('bigide', api)` to attach a carefully controlled API to `window.bigide`.

This is like a restricted API gateway. The renderer can only call the functions that the preload explicitly lists. Nothing more.

### IPC — How the Processes Communicate

IPC (Inter-Process Communication) in Electron has two patterns:

**Request/Response (invoke/handle) — like an RPC call:**
```
Renderer calls:   window.bigide.taskCreate(data)
  → preload:      ipcRenderer.invoke('task:create', data)
  → main process: ipcMain.handle('task:create', (event, data) => { ... })
  → response travels back through the same path
```

**Push events (send/on) — like an event or signal:**
```
Main process calls:  mainWindow.webContents.send('task:status-changed', taskId, status)
  → preload:         ipcRenderer.on('task:status-changed', listener)
  → renderer:        window.bigide.onTaskStatusChanged(callback)
```

**Analogies:**
- Request/Response IPC = Java RMI, Qt slot invocation across threads, Win32 SendMessage
- Push events = Qt signals, Java event listeners, Win32 PostMessage

### Context Isolation

In `src/main/index.ts`, the window is created with:
```typescript
webPreferences: {
  contextIsolation: true,
  nodeIntegration: false,
}
```

`nodeIntegration: false` means the renderer cannot use `require()` to load Node.js modules directly. `contextIsolation: true` means the preload and renderer JavaScript run in separate V8 contexts — the renderer cannot access or tamper with preload variables. The `contextBridge` is the only controlled channel between them.

---

## 6. How React Works

### Components

A React component is a JavaScript function that returns a description of what to render. In TypeScript/JSX, it looks like this:

```tsx
function Greeting({ name }: { name: string }) {
  return <div>Hello, {name}</div>
}
```

**Analogy:** This is like a `paint()` method in Java Swing or a `paintEvent()` in Qt. The function is called by React whenever it needs to (re-)render the component. You do not call it yourself.

The HTML-like syntax (`<div>`, `<span>`) is called **JSX**. It compiles to function calls:
```javascript
// JSX:
<div className="text-sm">Hello</div>

// Compiles to:
React.createElement('div', { className: 'text-sm' }, 'Hello')
```

You write JSX in `.tsx` files. The TypeScript compiler handles the transformation.

### Props — Immutable Inputs

Props are the parameters passed to a component from its parent. They are read-only.

```tsx
interface TaskCardProps {
  task: AgentTask
  isSelected: boolean
  onSelect: (taskId: string) => void
}

function TaskCard({ task, isSelected, onSelect }: TaskCardProps) {
  return (
    <div
      className={isSelected ? 'bg-blue-800' : 'bg-gray-800'}
      onClick={() => onSelect(task.id)}
    >
      {task.title}
    </div>
  )
}
```

**Analogy:** Props are like constructor parameters or method arguments. The child component cannot mutate them. If the parent changes a prop value, React re-renders the child with the new value.

### State — Mutable Variables That Trigger Re-Render

State is data that belongs to a component and can change over time. When state changes, React re-renders the component.

```tsx
import { useState } from 'react'

function Counter() {
  const [count, setCount] = useState(0)  // initial value = 0

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>Increment</button>
    </div>
  )
}
```

**Analogy:** `useState` is like a mutable instance variable in a class, but with the special property that calling its setter (here `setCount`) schedules a re-render of the component. You cannot mutate state directly (like `count = count + 1`). You must always use the setter. This is React's way of knowing that something changed.

**Rule of thumb:** If a value only ever changes by user action or async events, and you want the UI to update when it changes, it should be state.

### Hooks

Hooks are special functions that can only be called inside React components (or other hooks). Their names always start with `use`. The most important ones:

**`useState(initialValue)`** — Declares a mutable state variable (as shown above).

**`useEffect(fn, [deps])`** — Runs side effects. Called after render, and again whenever the dependencies change. Like a lifecycle method.

```tsx
useEffect(() => {
  loadProjects()           // Run once on mount
}, [loadProjects])         // [] means "only on first mount"
```

**Analogy:** `useEffect` with `[]` is like a constructor body or `componentDidMount()`. `useEffect` with dependencies is like an `@Observed` pattern — re-runs when those values change.

**`useRef(initialValue)`** — Holds a mutable reference that does NOT trigger re-render when changed.

```tsx
const terminalRef = useRef<HTMLDivElement>(null)
// terminalRef.current is the actual DOM element
```

**Analogy:** Like a raw pointer or a `WeakReference` — useful for holding references to DOM elements or values that need to persist across renders without causing re-renders.

**`useCallback(fn, [deps])`** — Memoizes a function so it doesn't change identity between renders unless dependencies change. Important for performance and stable references.

### JSX Rules

A few things that trip up newcomers:

1. **Class is `className`** — In HTML you write `class="foo"`. In JSX it's `className="foo"` because `class` is a reserved word in JavaScript.

2. **Self-closing tags** — Every HTML element must be properly closed. `<br>` becomes `<br />`. `<input>` becomes `<input />`.

3. **Expressions in curly braces** — Any JavaScript expression goes inside `{}`. `<div>{task.title}</div>` renders the task's title. `<div>{2 + 2}</div>` renders `4`.

4. **Conditional rendering** — Use `&&` or ternary:
   ```tsx
   {isVisible && <MyComponent />}
   {isSelected ? <Selected /> : <NotSelected />}
   ```

5. **Lists** — Always add a `key` prop when rendering arrays:
   ```tsx
   {tasks.map(task => <TaskCard key={task.id} task={task} />)}
   ```

### The Virtual DOM

When React re-renders a component, it doesn't immediately touch the real browser DOM. Instead, it builds a new "virtual DOM" tree (plain JavaScript objects) and compares it to the previous virtual DOM tree. This comparison is called "diffing." React then computes the minimal set of real DOM mutations needed to bring the actual DOM in sync. This is efficient because real DOM mutations are slow; JavaScript object comparison is fast.

**Analogy:** Imagine you're diffing two versions of a large data structure and only flushing the changed fields to disk. React does the same thing with DOM nodes.

---

## 7. How Zustand Works

### The Problem Zustand Solves

In a large React app, many unrelated components often need to share the same data. Passing data down through props from a common ancestor (called "prop drilling") becomes unwieldy. Zustand provides global stores that any component can read directly.

### Defining a Store

A Zustand store is a TypeScript object with state fields and methods (called "actions"). Here is the workspace store:

```typescript
import { create } from 'zustand'

interface WorkspaceState {
  projects: Project[]
  focusedProjectId: string | null
  loadProjects: () => Promise<void>
  setFocusedProject: (id: string | null) => void
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  projects: [],
  focusedProjectId: null,

  loadProjects: async () => {
    const projects = await window.bigide.projectList()
    set({ projects })         // This is how you update state
  },

  setFocusedProject: (id) => {
    set({ focusedProjectId: id })
  },
}))
```

**Analogy:** This is a singleton class with mutable state. `create()` returns a React hook (`useWorkspaceStore`) that any component can call to subscribe to this data.

### Using a Store in a Component

```tsx
function Sidebar() {
  // Subscribe to only the 'projects' field
  const projects = useWorkspaceStore(s => s.projects)
  const setFocused = useWorkspaceStore(s => s.setFocusedProject)

  return (
    <ul>
      {projects.map(p => (
        <li key={p.id} onClick={() => setFocused(p.id)}>{p.name}</li>
      ))}
    </ul>
  )
}
```

The selector function (`s => s.projects`) is important. When the store updates, React only re-renders components whose selected slice of data actually changed. If `projects` doesn't change but `focusedProjectId` does, `Sidebar` does not re-render.

**Analogy:** This is like the Observer pattern. The component subscribes to the exact fields it cares about. The store notifies only interested subscribers when those fields change.

### Updating Store State

You never mutate state directly. You always call `set()` with the new values (or a function that takes the old state and returns new values):

```typescript
// Simple update:
set({ focusedProjectId: 'some-id' })

// Update based on previous state (functional update):
set((state) => ({
  projects: [...state.projects, newProject]
}))
```

Zustand merges the object you pass into `set()` with the existing state — you don't need to spread everything manually at the top level. But for nested objects (like `tasks` in `task-store.ts` which is `Record<string, AgentTask[]>`), you need to be careful to spread and replace correctly, as seen in the task store.

---

## 8. How TypeScript Works

### Basic Type Annotations

TypeScript annotations use a colon syntax:

```typescript
// Java:     String name = "Alice";
// TypeScript:
const name: string = "Alice"

// Java:     int count = 0;
// TypeScript:
let count: number = 0

// Java:     boolean isValid = true;
// TypeScript:
let isValid: boolean = true
```

Usually TypeScript can infer the type from the value, so you don't need to write it:
```typescript
const name = "Alice"      // TypeScript infers: string
let count = 0             // TypeScript infers: number
```

### Interfaces

TypeScript interfaces define the shape of an object, just like Java interfaces define a contract — except TypeScript interfaces describe data shapes, not just method signatures:

```typescript
// Java has interfaces primarily for methods.
// TypeScript interfaces describe object shapes:

interface Project {
  id: string
  name: string
  rootPath: string
  canvasPosition: { x: number; y: number }
}

// Use it as a type:
function displayProject(project: Project) {
  console.log(project.name)
}
```

### Types vs Interfaces

Both `type` and `interface` define shapes. The practical differences are minor:

```typescript
// interface — can be extended with 'extends', can be merged in multiple declarations
interface Animal {
  name: string
}
interface Dog extends Animal {
  breed: string
}

// type — more flexible, can define unions, intersections, primitives
type TaskStatus = 'todo' | 'running' | 'needs-review' | 'done' | 'error'
type StringOrNumber = string | number
```

`type` is commonly used for union types (like `TaskStatus`) where the value can be one of several specific strings. `interface` is commonly used for object shapes.

### Union Types

A value of a union type can be one of several types:

```typescript
type TaskStatus = 'todo' | 'running' | 'needs-review' | 'done' | 'error'

function getStatusColor(status: TaskStatus): string {
  switch (status) {
    case 'running': return 'blue'
    case 'done': return 'green'
    case 'error': return 'red'
    default: return 'gray'
  }
}
```

**Analogy:** Like a Java `enum`, but the values are strings rather than named constants.

### Generics

TypeScript generics use the same `<T>` syntax as Java:

```typescript
// Like Java's List<T>:
const tasks: Array<AgentTask> = []

// Generic function:
async function invoke<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn()
  } catch {
    return fallback
  }
}
```

### Optional and Nullable

```typescript
interface AgentTask {
  ptyId: string | null      // Can be string or null (like Java's Optional)
  agentSummary: string | null
  prUrl: string | null
}

// Optional property (may not exist at all):
interface Project {
  browserUrl?: string       // The '?' means this field may be undefined
}
```

### The `Omit<T, Keys>` Utility Type

You will see this frequently in the codebase:

```typescript
type TaskCreateInput = Omit<AgentTask, 'id' | 'worktreePath' | 'ptyId'>
```

This creates a new type that is `AgentTask` with the listed fields removed. It's used when creating a new task — you don't have an `id` yet (the server assigns one), so you use `Omit` to describe the input without those fields.

**Analogy:** Like creating a data transfer object (DTO) that is a subset of your domain object.

### `async`/`await`

JavaScript is single-threaded and uses an event loop. Long-running operations (file I/O, network calls) are asynchronous — they return a `Promise` instead of blocking.

```typescript
// A Promise<string> is like a Java Future<String>
async function fetchData(): Promise<string> {
  const result = await someAsyncOperation()  // 'await' pauses here until the promise resolves
  return result
}
```

`async`/`await` is syntactic sugar over Promises. An `async` function always returns a `Promise`. `await` pauses the function (without blocking the thread) until the awaited promise resolves.

**Analogy:** Like Java's `CompletableFuture.get()` without actually blocking the thread — more like continuation-passing style, but written in a linear, readable style.

---

# Part 3: Development Workflow

## 9. Making Changes

### Renderer Changes (hot reload)

Any change to a file in `src/renderer/` is picked up by Vite's hot module replacement system. Within one or two seconds of saving, the Electron window will update without a full restart. You will see a brief flash as the page reloads or the changed component re-renders.

### Main Process Changes (requires restart)

Any change to a file in `src/main/` or `src/preload/` requires you to:
1. Press `Ctrl+C` in the terminal where `npm run dev` is running
2. Run `npm run dev` again

This is because the main process is compiled once at startup, unlike the renderer which uses a live dev server.

### TypeScript Errors

TypeScript errors appear in two places:
- **Terminal:** The `electron-vite` output will print type errors when they occur
- **Browser DevTools console:** Errors during runtime appear in the DevTools console (open with `Ctrl+Shift+I` inside the Electron window)

Fix type errors before running — they indicate real bugs.

---

## 10. Adding a New Feature End-to-End

To make this concrete, we'll walk through adding a `notes` field to tasks — a freeform text field where users can write notes about a task.

This is the canonical data flow in BigIDE: shared types → main store → IPC handler → preload → renderer store → UI component.

### Step 1: Add to Shared Types

Open `src/shared/types.ts` and add `notes` to the `AgentTask` interface:

```typescript
export interface AgentTask {
  id: string
  projectId: string
  title: string
  prompt: string
  status: TaskStatus
  branchName: string
  worktreePath: string | null
  ptyId: string | null
  needsInput: boolean
  lastOutputLine: string
  model: string
  agentSummary: string | null
  toolLog: ToolLogEntry[]
  diffStats: { filesChanged: number; insertions: number; deletions: number } | null
  permissions: TaskPermissions
  prUrl: string | null
  notes: string             // <-- add this line
}
```

Also add an IPC channel to the `IpcChannels` type:

```typescript
'task:update-notes': (taskId: string, notes: string) => void
```

### Step 2: Update the Main Store

Open `src/main/store.ts`. No schema changes are needed because `electron-store` stores plain JSON — adding a field just means new tasks will have it, and old ones will be missing it (TypeScript will warn you to handle `undefined`). If you want a default value for existing tasks, you can add migration logic, but for a simple string default of `''` you can handle it at read time.

### Step 3: Add an IPC Handler

Open `src/main/ipc-handlers.ts`. In the "Task Lifecycle" section, add:

```typescript
ipcMain.handle('task:update-notes', (_, taskId: string, notes: string) => {
  updateTask(taskId, { notes })
})
```

### Step 4: Expose in Preload

Open `src/preload/index.ts`. Add to the `api` object:

```typescript
taskUpdateNotes: (taskId: string, notes: string) =>
  ipcRenderer.invoke('task:update-notes', taskId, notes),
```

### Step 5: Update the Renderer Store

Open `src/renderer/stores/task-store.ts`. Add a method to the `TaskState` interface:

```typescript
updateNotes: (taskId: string, notes: string) => Promise<void>
```

And implement it in the `create()` call:

```typescript
updateNotes: async (taskId: string, notes: string) => {
  try {
    await window.bigide.taskUpdateNotes(taskId, notes)
    set((state) => {
      const updated = { ...state.tasks }
      for (const projectId in updated) {
        updated[projectId] = updated[projectId].map((t) =>
          t.id === taskId ? { ...t, notes } : t
        )
      }
      return { tasks: updated }
    })
  } catch (err) {
    console.error('Failed to update notes:', err)
  }
},
```

### Step 6: Add the UI Component

Create a new file `src/renderer/components/TaskNotesPanel.tsx`:

```tsx
import { useState } from 'react'
import { useTaskStore } from '../stores/task-store'
import type { AgentTask } from '../lib/types'

interface TaskNotesPanelProps {
  task: AgentTask
}

export function TaskNotesPanel({ task }: TaskNotesPanelProps) {
  const [notes, setNotes] = useState(task.notes ?? '')
  const updateNotes = useTaskStore(s => s.updateNotes)

  function handleBlur() {
    // Save when the user clicks away from the textarea
    updateNotes(task.id, notes)
  }

  return (
    <div className="p-3 h-full flex flex-col">
      <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
        Notes
      </label>
      <textarea
        className="flex-1 bg-gray-900 text-gray-200 text-sm p-2 rounded resize-none
                   border border-gray-700 focus:border-blue-500 focus:outline-none"
        value={notes}
        onChange={e => setNotes(e.target.value)}
        onBlur={handleBlur}
        placeholder="Add notes about this task..."
      />
    </div>
  )
}
```

Now import and use `TaskNotesPanel` wherever you want it to appear — for example in `ProjectView.tsx` within the panel layout.

### Step 7: Test

1. Restart `npm run dev` (main process changed)
2. Open BigIDE
3. Create a task and open it
4. The Notes panel should appear
5. Type in it, click away, then reopen the app — the notes should persist

---

## 11. Adding a New IPC Channel

The IPC channel is the "wire" between frontend and backend. Follow this checklist every time:

### 1. Register the handler in `src/main/ipc-handlers.ts`

```typescript
ipcMain.handle('myfeature:do-something', async (_, param1: string, param2: number) => {
  // Your implementation
  const result = await doSomething(param1, param2)
  return result
})
```

The first argument to the handler is always the Electron `IpcMainInvokeEvent` (named `_` by convention when unused). Subsequent arguments are the values passed from the renderer.

### 2. Expose it in `src/preload/index.ts`

```typescript
const api = {
  // ... existing entries ...
  myfeatureDoSomething: (param1: string, param2: number) =>
    ipcRenderer.invoke('myfeature:do-something', param1, param2),
}
```

**Naming convention:** Channel names use `namespace:action` (e.g., `task:create`, `git:merge-branch`). The preload method uses camelCase of the same (e.g., `taskCreate`, `gitMergeBranch`).

### 3. Add the type to `src/shared/types.ts` (optional but recommended)

```typescript
export type IpcChannels = {
  // ... existing ...
  'myfeature:do-something': (param1: string, param2: number) => ResultType
}
```

### 4. Call it from the renderer

```typescript
const result = await window.bigide.myfeatureDoSomething('hello', 42)
```

Or through the Zustand store if multiple components need access to the result.

### For Push Events (Main → Renderer)

To push data from the main process to the renderer (e.g., status updates, notifications):

**Main process sends:**
```typescript
import { getMainWindow } from './index'

const win = getMainWindow()
if (win && !win.isDestroyed()) {
  win.webContents.send('myfeature:event-name', payload1, payload2)
}
```

**Preload registers a listener:**
```typescript
onMyFeatureEvent: (cb: (payload1: string, payload2: number) => void) => {
  const listener = (_: any, payload1: string, payload2: number) =>
    cb(payload1, payload2)
  ipcRenderer.on('myfeature:event-name', listener)
  return () => ipcRenderer.removeListener('myfeature:event-name', listener)
},
```

Note that the listener registration returns an *unsubscribe function* (a closure that removes the listener). This is important — callers must save this return value and call it when they no longer want the events, to prevent memory leaks. In React components, you call the unsubscribe in a `useEffect` cleanup function:

```tsx
useEffect(() => {
  const unsubscribe = window.bigide.onMyFeatureEvent((p1, p2) => {
    // handle event
  })
  return unsubscribe  // Called when component unmounts
}, [])
```

---

## 12. Adding a New React Component

### File Setup

Create a `.tsx` file in `src/renderer/components/`. Use PascalCase for the filename matching the component name:

```
src/renderer/components/MyNewPanel.tsx
```

### Component Template

```tsx
import { useState } from 'react'
import { useTaskStore } from '../stores/task-store'
import type { AgentTask } from '../lib/types'

// Define the props your component accepts
interface MyNewPanelProps {
  task: AgentTask
  onAction?: () => void   // The '?' makes this prop optional
}

// The component itself — always a function, always PascalCase name
export function MyNewPanel({ task, onAction }: MyNewPanelProps) {
  // Local state
  const [isExpanded, setIsExpanded] = useState(false)

  // Access Zustand store (only subscribe to what you need)
  const updateStatus = useTaskStore(s => s.updateStatus)

  // Event handler
  function handleClick() {
    updateStatus(task.id, 'done')
    onAction?.()   // '?.' is "optional chaining" — safe if onAction is undefined
  }

  // JSX return — describes what to render
  return (
    <div className="p-4 bg-gray-900 rounded">
      <h2 className="text-sm font-bold text-gray-300">{task.title}</h2>

      {/* Conditional rendering */}
      {isExpanded && (
        <p className="text-xs text-gray-500 mt-2">{task.prompt}</p>
      )}

      <button
        className="mt-2 text-xs px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {isExpanded ? 'Collapse' : 'Expand'}
      </button>

      <button
        className="mt-2 ml-2 text-xs px-3 py-1 bg-green-700 hover:bg-green-600 text-white rounded"
        onClick={handleClick}
      >
        Mark Done
      </button>
    </div>
  )
}

// Default export is also fine — either works, but be consistent with the file
export default MyNewPanel
```

### TailwindCSS Quick Reference

Common utility classes used in this codebase:

| Class | Equivalent |
|-------|-----------|
| `flex`, `flex-col`, `flex-1` | `display: flex`, column direction, grow to fill |
| `h-full`, `w-full` | 100% height/width |
| `p-2`, `p-4` | padding: 8px / 16px |
| `px-3 py-1` | padding-left/right: 12px, padding-top/bottom: 4px |
| `mt-2`, `mb-4` | margin-top: 8px, margin-bottom: 16px |
| `gap-2` | gap between flex/grid children: 8px |
| `text-sm`, `text-xs` | font-size: 14px / 12px |
| `text-gray-300`, `text-blue-400` | color from Tailwind palette |
| `bg-gray-900`, `bg-blue-600` | background color |
| `rounded` | border-radius: 4px |
| `border`, `border-gray-700` | 1px border with gray color |
| `hover:bg-blue-700` | background changes on mouse hover |
| `uppercase tracking-wider` | uppercase text with extra letter spacing |
| `font-semibold`, `font-bold` | font-weight: 600 / 700 |
| `overflow-hidden`, `overflow-y-auto` | overflow behavior |
| `items-center`, `justify-between` | flexbox alignment |
| `space-y-2` | margin-top: 8px between children |
| `transition-colors` | smooth color change on hover |

Colors follow the pattern `{color}-{shade}` where shade is 100 (lightest) to 900 (darkest):
- Gray: `gray-100` through `gray-900`
- Blue: `blue-400` (accent), `blue-600` (button), `blue-700` (hover)
- Green: `green-400` (success text), `green-700` (success button)
- Red: `red-400` (error text)
- Yellow: `yellow-400` (warning text)

---

# Part 4: Common Tasks

## 13. Debugging

### Main Process Debugging

The main process (Node.js) has no visible window. Its `console.log()` output appears in the terminal where you ran `npm run dev`.

```typescript
// In any src/main/ file:
console.log('Task created:', task.id)
console.error('Failed to create worktree:', err.message)
```

To inspect main process state more deeply, you can use Chrome's remote debugger. The `--inspect` flag is not enabled by default, but you can add it to the electron command in `package.json` scripts if needed.

### Renderer Process Debugging

Because the renderer runs inside a Chromium window, you get the full Chrome DevTools:

1. In development mode, DevTools opens automatically at the bottom of the Electron window.
2. In any mode, press `Ctrl+Shift+I` (or `Cmd+Option+I` on macOS) inside the Electron window to toggle DevTools.

Use:
- **Console tab** — See renderer `console.log()` output and JavaScript errors
- **Sources tab** — Set breakpoints in your TypeScript source (source maps are generated automatically)
- **Network tab** — Not useful for IPC, but helpful for webview requests
- **React DevTools** — Install the React DevTools browser extension, then it appears as an extra "Components" tab in DevTools. Lets you inspect the React component tree, see props/state in real time.

### Common Debugging Patterns

**To debug an IPC call not working:**

1. Add a `console.log` at the start of the IPC handler in `ipc-handlers.ts`:
   ```typescript
   ipcMain.handle('task:create', async (_, taskData) => {
     console.log('[IPC task:create] received:', taskData)
     // ...
   })
   ```
2. Check the terminal for the log

3. Add a `console.log` in the preload call to verify it's being invoked:
   ```typescript
   taskCreate: (task: any) => {
     console.log('[preload] taskCreate called with:', task)
     return ipcRenderer.invoke('task:create', task)
   },
   ```
4. This log appears in the DevTools console (because preload runs in the renderer's context)

**To inspect Zustand store state:**

In the DevTools console, you can access the raw store state. The exact API depends on the store, but Zustand provides a `getState()` method. For example, add this temporarily to a component:

```typescript
import { useTaskStore } from '../stores/task-store'
console.log('task store state:', useTaskStore.getState())
```

---

## 14. Building for Production

### Step 1: Compile

```
npm run build
```

This runs `electron-vite build`, which:
- Compiles all TypeScript to JavaScript
- Bundles and minifies the renderer with Vite
- Outputs to `dist/main/`, `dist/preload/`, and `dist/renderer/`

### Step 2: Package into an Installer

```
npx electron-builder
```

This reads `electron-builder.yml` and packages the app into a native installer. On Windows, this creates an NSIS installer in the `release/` folder (e.g., `BigIDE Setup 0.1.0.exe`).

The first time you run this, it downloads the Electron binary for packaging, which can take a few minutes.

### Production vs Development Differences

| Behavior | Development | Production |
|----------|-------------|-----------|
| DevTools | Auto-opens | Does not open |
| Source maps | Generated | Minified, no source maps |
| Hot reload | Active | Not present |
| Renderer loads from | Dev server (localhost:5173) | Bundled HTML file |
| Main process | Compiled on-the-fly | Pre-compiled in dist/ |

In `src/main/index.ts`, the distinction is handled by:
```typescript
if (process.env.ELECTRON_RENDERER_URL) {
  // Development: load from Vite dev server
  mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
} else {
  // Production: load bundled file
  mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
}
```

---

## 15. Common Errors and Solutions

### `node-pty` Build Failure During `npm install`

**Symptom:**
```
gyp ERR! build error
gyp ERR! stack Error: `make` failed with exit code: 2
```
or on Windows:
```
error MSB3428: Could not load the Visual C++ component "VCBuild.exe"
```

**Cause:** `node-pty` is a native C++ addon that must be compiled for your exact Node.js and Electron version. The compiler toolchain is missing or not on PATH.

**Solution:**
1. Install Visual Studio Build Tools with the C++ workload (see Step 4 in the prerequisites)
2. Open a new Command Prompt (so the new PATH is loaded)
3. Run `npm install` again
4. If it still fails, run: `npx electron-rebuild -f -w node-pty`

---

### `Module not found` or `Cannot find module`

**Symptom:**
```
Error: Cannot find module 'some-library'
```

**Cause:** The `node_modules/` folder is missing or incomplete.

**Solution:**
```
npm install
```

If `node_modules/` exists but is corrupted:
```
rmdir /s /q node_modules
npm install
```

---

### White Screen After Launch

**Symptom:** The Electron window opens but shows a blank white or grey screen.

**Cause:** A JavaScript error in the renderer crashed the React app before it could render.

**Solution:**
1. Open DevTools with `Ctrl+Shift+I`
2. Look at the Console tab for red error messages
3. The error message will tell you exactly what went wrong (missing import, undefined variable, etc.)

---

### IPC Call Not Working (no error, but nothing happens)

**Symptom:** You call `window.bigide.someMethod()` and the handler in `ipc-handlers.ts` is never reached.

**Cause:** Most likely the preload bridge does not expose the channel.

**Checklist:**
1. Is the handler registered in `ipc-handlers.ts` with `ipcMain.handle('channel:name', ...)`?
2. Is the channel exposed in `src/preload/index.ts` inside the `api` object?
3. Does the name in the preload match the name in the handler exactly (including case)?
4. Did you restart the app after changing main process or preload code?

---

### TypeScript Error: `Property 'X' does not exist on type 'Window'`

**Symptom:**
```
Property 'bigide' does not exist on type 'Window & typeof globalThis'
```

**Cause:** TypeScript doesn't know about the `window.bigide` API added by the preload script.

**Solution:** Add a type declaration. Create or update `src/renderer/env.d.ts`:

```typescript
import type { BigIdeApi } from '../preload/index'

declare global {
  interface Window {
    bigide: BigIdeApi
  }
}
```

---

### Git Errors When Creating Tasks

**Symptom:**
```
Failed to create worktree: spawn git ENOENT
```

**Cause:** Git is not on the system PATH.

**Solution:**
1. Verify `git --version` works in a Command Prompt
2. If not, reinstall Git and select "Git from the command line and also from 3rd-party software" during installation
3. Restart the terminal and the app

---

### Electron Window Doesn't Open / Crashes Immediately

**Symptom:** The terminal shows the Vite build succeeded but no window appears.

**Cause:** A crash in the main process (before the window is created).

**Solution:**
1. Look at the terminal output immediately after the crash — Node.js prints a stack trace
2. Common causes:
   - TypeScript compilation error not caught (run `npx tsc --noEmit` to find type errors)
   - Missing environment variable
   - Native addon (node-pty) failed to load

---

# Part 5: Code Conventions

## 16. Naming Conventions

### File Names

| Type | Convention | Example |
|------|-----------|---------|
| React components | PascalCase `.tsx` | `TaskBoard.tsx`, `GovernanceModal.tsx` |
| Non-component TypeScript | kebab-case `.ts` | `git-service.ts`, `pty-manager.ts` |
| Stores | camelCase with `-store` suffix | `task-store.ts`, `workspace-store.ts` |
| Hooks | camelCase with `use` prefix | `useIpc.ts`, `useTerminal.ts` |

### IPC Channel Names

Format: `namespace:action`

Namespaces used in the codebase:
- `project:` — project CRUD operations
- `task:` — task lifecycle and data operations
- `terminal:` — PTY/terminal operations
- `git:` — Git operations
- `governance:` — permission/approval operations

Examples: `task:create`, `task:start`, `git:worktree-list`, `governance:respond`

The preload method name is the camelCase version without the colon: `taskCreate`, `taskStart`, `gitWorktreeList`, `governanceRespond`.

### TypeScript Identifiers

| Category | Convention | Example |
|----------|-----------|---------|
| Interfaces and types | PascalCase | `AgentTask`, `TaskStatus`, `IpcChannels` |
| Variables and functions | camelCase | `loadProjects`, `activeTaskId` |
| Constants | UPPER_SNAKE_CASE | `DEFAULT_PERMISSIONS`, `MODEL_COMMANDS` |
| React component functions | PascalCase | `TaskBoard`, `ProjectView` |
| Store hooks | `use` prefix, PascalCase store name | `useTaskStore`, `useWorkspaceStore` |

### CSS/Tailwind

- Use TailwindCSS utility classes inline in JSX. Do not write custom CSS files for component-level styling.
- Global styles (font imports, base resets, Tailwind directives) go in `src/renderer/styles.css` or `app.css`.
- For dynamic class names, use a ternary: `className={isSelected ? 'bg-blue-800' : 'bg-gray-800'}`.
- For complex conditional classes, consider joining an array: `className={['base-class', isActive && 'active-class'].filter(Boolean).join(' ')}`.

---

## 17. Patterns Used in the Codebase

Understanding the design patterns in use helps you place new code in the right location and follow the existing style.

### Observer Pattern — IPC Event Subscriptions

The push events (main → renderer) follow the Observer pattern. The main process is the subject; the renderer subscribes via the preload bridge.

Example from `src/preload/index.ts`:
```typescript
onTaskStatusChanged: (cb) => {
  const listener = (_, taskId, status, needsInput) => cb(taskId, status, needsInput)
  ipcRenderer.on('task:status-changed', listener)
  return () => ipcRenderer.removeListener('task:status-changed', listener)  // unsubscribe
}
```

The `useTaskStore` in `task-store.ts` subscribes at initialization:
```typescript
window.bigide.onTaskStatusChanged((taskId, status, needsInput) => {
  get()._updateTaskStatus(taskId, status, needsInput)
})
```

**Analogy:** Java's `EventListener` pattern, Qt's signals/slots, or C#'s events. The key difference: unsubscription is handled by the returned function (not by removing a named listener object).

---

### Repository Pattern — `store.ts`

The main process persists data through `store.ts`, which provides a clean API hiding the underlying storage mechanism (currently `electron-store` / JSON file):

```typescript
export function getTask(taskId: string): AgentTask | null { ... }
export function updateTask(taskId: string, updates: Partial<AgentTask>): AgentTask | null { ... }
export function addTask(task: AgentTask): void { ... }
```

Callers (`ipc-handlers.ts`, `agent-launcher.ts`, `governance-service.ts`) never touch the storage library directly — they always go through these functions.

**Why this matters:** If you ever swap `electron-store` for SQLite or a different database, you only change `store.ts`. All callers remain unchanged.

---

### Service Pattern — `git-service.ts`, `governance-service.ts`

Domain operations are grouped into service modules. Each service owns a specific responsibility:

- `git-service.ts` — all Git operations (worktrees, diffs, merges, PRs)
- `governance-service.ts` — permission checks and approval flows
- `notification-service.ts` — notification creation and delivery
- `tool-log-service.ts` — activity logging

Services are used by `ipc-handlers.ts`, which acts as the thin controller layer that wires together services in response to renderer requests.

**Analogy:** The service layer in a Java Spring application, or business logic objects in a layered C++ architecture.

---

### Bridge Pattern — `preload/index.ts`

The preload script is an implementation of the Bridge pattern. It decouples the renderer's interface (`window.bigide`) from the underlying IPC mechanism (`ipcRenderer`).

```
Renderer calls:        window.bigide.taskCreate(data)
Preload abstracts:     ipcRenderer.invoke('task:create', data)
```

If Electron ever changes its IPC API, only the preload script needs updating. The renderer code never changes.

**Analogy:** An adapter/facade layer in C++ that hides a platform-specific API behind a stable interface.

---

### State Machine — Task Status Transitions

`TaskStatus` is a string union type that defines the states a task can be in:

```typescript
type TaskStatus = 'todo' | 'running' | 'needs-review' | 'done' | 'error'
```

The valid transitions are:
```
todo ──► running ──► needs-review ──► done
                 └──► error
                 └──► (user stopped) error
```

The `output-parser.ts` module watches terminal output to detect transitions. The `ipc-handlers.ts` module exposes `task:update-status` for manual transitions from the UI.

When adding new task-related behavior, ensure you handle all relevant states. The `TaskBoard.tsx` component renders separate columns for each status, so a new status value would require a new column definition there.

---

### The Data Flow: A Complete Picture

Here is how data flows through the system for a typical operation (creating a task):

```
User clicks "+ New Task" in TaskCreateModal.tsx
  │
  ▼
TaskCreateModal calls: useTaskStore.createTask(taskData)
  │
  ▼  (in src/renderer/stores/task-store.ts)
createTask calls: window.bigide.taskCreate(taskData)
  │
  ▼  (crosses process boundary via IPC)
  │
  ▼  (in src/preload/index.ts)
taskCreate: ipcRenderer.invoke('task:create', taskData)
  │
  ▼  (crosses process boundary via IPC)
  │
  ▼  (in src/main/ipc-handlers.ts)
ipcMain.handle('task:create', ...) {
  Creates AgentTask with UUID
  Calls createWorktree() from git-service.ts
  Calls addTask() from store.ts
  Returns the new task
}
  │
  ▼  (return value travels back through IPC to renderer)
  │
  ▼  (back in task-store.ts)
Task received, added to local Zustand state
  │
  ▼  (React re-renders)
TaskBoard re-renders with new task in "todo" column
```

This flow applies to every feature. Understanding it will let you trace any bug or add any feature by following the path from UI to backend and back.

---

*This guide covers BigIDE as of version 0.1.0. The codebase is under active development — if you find something that has changed, update this document to match.*
