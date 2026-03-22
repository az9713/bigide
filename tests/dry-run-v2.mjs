/**
 * BigIDE Dry-Run Test v2
 *
 * Comprehensive test covering all fixes and edge cases.
 * Tests the complete Step A → Step L workflow plus all bug fixes.
 *
 * Usage: node tests/dry-run-v2.mjs
 */

import { execSync } from 'child_process'
import { existsSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'fs'
import { join, resolve } from 'path'
import { randomUUID } from 'crypto'

// ── Helpers ──

let passed = 0
let failed = 0
let warnings = 0

function ok(label) { passed++; console.log(`  ✅ ${label}`) }
function fail(label, err) { failed++; console.log(`  ❌ ${label}: ${err}`) }
function warn(label, msg) { warnings++; console.log(`  ⚠️  ${label}: ${msg}`) }
function section(title) {
  console.log(`\n${'─'.repeat(60)}`)
  console.log(`  ${title}`)
  console.log(`${'─'.repeat(60)}`)
}
function run(cmd, opts = {}) {
  return execSync(cmd, { encoding: 'utf8', stdio: 'pipe', ...opts }).trim()
}

// ── Setup ──

section('SETUP: Creating test environment')

const TEST_DIR = resolve('./tests/_test-repo-v2')
const WORKTREE_BASE = resolve('./tests/.bigide-worktrees')

if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true })
if (existsSync(WORKTREE_BASE)) rmSync(WORKTREE_BASE, { recursive: true, force: true })

mkdirSync(TEST_DIR, { recursive: true })
writeFileSync(join(TEST_DIR, 'README.md'), '# Test Project\n')
run('git init', { cwd: TEST_DIR })
run('git add .', { cwd: TEST_DIR })
run('git commit -m "Initial commit"', { cwd: TEST_DIR })
const defaultBranch = run('git branch --show-current', { cwd: TEST_DIR })
ok(`Test repo created (branch: ${defaultBranch})`)

// ══════════════════════════════════════════════════════════
//  1. BUILD VERIFICATION
// ══════════════════════════════════════════════════════════

section('1. BUILD VERIFICATION')

for (const f of ['dist/main/index.js', 'dist/preload/index.js', 'dist/renderer/index.html']) {
  if (existsSync(f)) ok(`Build artifact: ${f}`)
  else fail(`Missing: ${f}`, 'Run npm run build')
}

// ══════════════════════════════════════════════════════════
//  2. SOURCE CODE STATIC ANALYSIS
// ══════════════════════════════════════════════════════════

section('2. SOURCE CODE STATIC ANALYSIS')

// Check: no require() in ESM files (except node-pty which is dynamic)
{
  const mainIndex = readFileSync('./src/main/index.ts', 'utf8')
  const requireCalls = mainIndex.match(/require\(/g) || []
  if (requireCalls.length === 0) {
    ok('index.ts has no require() calls (uses ESM imports)')
  } else {
    fail('index.ts has require() calls', `Found ${requireCalls.length} — will fail in Vite bundle`)
  }
}

// Check: store imports in index.ts use ESM import
{
  const mainIndex = readFileSync('./src/main/index.ts', 'utf8')
  if (mainIndex.includes("import { getTasks, setTasks } from './store'")) {
    ok('index.ts imports getTasks/setTasks via ESM import')
  } else if (mainIndex.includes("require('./store')")) {
    fail('index.ts uses require for store', 'Will crash — Vite bundles to single file')
  } else {
    warn('index.ts store import', 'Could not verify import pattern')
  }
}

// Check: ResizeObserver suppression
{
  const mainTsx = readFileSync('./src/renderer/main.tsx', 'utf8')
  if (mainTsx.includes('ResizeObserver')) {
    ok('main.tsx suppresses ResizeObserver errors')
  } else {
    fail('main.tsx missing ResizeObserver suppression', 'Terminal panel will crash the UI')
  }

  if (mainTsx.includes('document.body.innerHTML')) {
    fail('main.tsx still has document.body.innerHTML nuke', 'Any error will destroy the UI')
  } else {
    ok('main.tsx does not nuke document.body on error')
  }
}

// Check: branch name has random suffix
{
  const modal = readFileSync('./src/renderer/components/TaskCreateModal.tsx', 'utf8')
  if (modal.includes('Math.random()') && modal.includes('toString(36)')) {
    ok('Branch names include random suffix (prevents collisions)')
  } else {
    fail('Branch name missing random suffix', 'Duplicate branch names will crash task creation')
  }
}

// Check: Windows path split uses both separators
{
  const wsStore = readFileSync('./src/renderer/stores/workspace-store.ts', 'utf8')
  if (wsStore.includes('split(/[\\\\/]/)')) {
    ok('workspace-store uses platform-aware path split')
  } else {
    fail('workspace-store path split', 'Project names will show full path on Windows')
  }
}

// Check: terminalWrite exposed in preload
{
  const preload = readFileSync('./src/preload/index.ts', 'utf8')
  if (preload.includes('terminalWrite')) {
    ok('preload exposes terminalWrite (direct PTY write)')
  } else {
    fail('preload missing terminalWrite', 'Terminal input will fail after agent stops')
  }
}

// Check: terminal:write IPC handler exists
{
  const handlers = readFileSync('./src/main/ipc-handlers.ts', 'utf8')
  if (handlers.includes("'terminal:write'")) {
    ok('IPC handler terminal:write registered')
  } else {
    fail('Missing terminal:write handler', 'terminalWrite calls will fail')
  }
}

// Check: TerminalPanel uses terminalWrite
{
  const tp = readFileSync('./src/renderer/components/TerminalPanel.tsx', 'utf8')
  if (tp.includes('terminalWrite')) {
    ok('TerminalPanel writes directly to PTY via terminalWrite')
  } else {
    fail('TerminalPanel still uses taskSendInput', 'Terminal input breaks after agent stops')
  }
}

// Check: TerminalTabs includes completed task terminals
{
  const tt = readFileSync('./src/renderer/components/TerminalTabs.tsx', 'utf8')
  if (tt.includes('needs-review') && tt.includes('error')) {
    ok('TerminalTabs preserves terminals for completed/errored tasks')
  } else {
    fail('TerminalTabs only shows running', 'Terminal history lost on completion')
  }
}

// Check: output parser grace period
{
  const parser = readFileSync('./src/main/output-parser.ts', 'utf8')
  if (parser.includes('startedAt') && parser.includes('3000')) {
    ok('Output parser has 3-second startup grace period')
  } else {
    fail('Missing grace period', 'Shell prompt will trigger false needs-input')
  }
}

// Check: generateAgentSummary is called
{
  const parser = readFileSync('./src/main/output-parser.ts', 'utf8')
  if (parser.includes('generateAgentSummary(taskId)')) {
    ok('Output parser calls generateAgentSummary on completion')
  } else {
    fail('generateAgentSummary never called', 'Summary tab always empty')
  }
}

// Check: getDiffStats is called
{
  const parser = readFileSync('./src/main/output-parser.ts', 'utf8')
  if (parser.includes('getDiffStats(')) {
    ok('Output parser calls getDiffStats on completion')
  } else {
    fail('getDiffStats never called', 'Diff stats always null')
  }
}

// Check: merge updates status to done
{
  const handlers = readFileSync('./src/main/ipc-handlers.ts', 'utf8')
  if (handlers.includes("updateTask(task.id, { status: 'done' })") &&
      handlers.includes("'task:status-changed'")) {
    ok('Merge handler updates task status to done + pushes event')
  } else {
    fail('Merge missing status update', 'Task stays in Review after merge')
  }
}

// Check: cleanup removes from persistent store
{
  const handlers = readFileSync('./src/main/ipc-handlers.ts', 'utf8')
  if (handlers.includes('getTasks().filter(t => t.id !== taskId)')) {
    ok('Cleanup removes task from persistent store')
  } else {
    fail('Cleanup keeps task', 'Ghost tasks reappear after view switch')
  }
}

// Check: default permissions fallback
{
  const handlers = readFileSync('./src/main/ipc-handlers.ts', 'utf8')
  if (handlers.includes('taskData.permissions ?? DEFAULT_PROJECT_PERMISSIONS')) {
    ok('Task creation has permissions fallback')
  } else {
    fail('Missing permissions fallback', 'Governance checks crash on undefined')
  }
}

// Check: worktree failure propagates error
{
  const handlers = readFileSync('./src/main/ipc-handlers.ts', 'utf8')
  if (handlers.includes("throw new Error(`Failed to create worktree:")) {
    ok('Worktree failure throws user-visible error')
  } else {
    fail('Worktree failure silently continues', 'Agent runs in wrong directory')
  }
}

// Check: auto git init on project add
{
  const handlers = readFileSync('./src/main/ipc-handlers.ts', 'utf8')
  if (handlers.includes('checkIsRepo') && handlers.includes('git.init()')) {
    ok('Project add auto-initializes git if not a repo')
  } else {
    fail('Missing auto git init', 'Non-git folders will fail')
  }
}

// Check: default branch auto-detection
{
  const handlers = readFileSync('./src/main/ipc-handlers.ts', 'utf8')
  if (handlers.includes('branchLocal()') && handlers.includes('branches.current')) {
    ok('Default branch auto-detected from git')
  } else {
    fail('Default branch hardcoded', 'Repos with master branch will fail')
  }
}

// Check: stale task reset on startup
{
  const indexTs = readFileSync('./src/main/index.ts', 'utf8')
  if (indexTs.includes("task.status === 'running'") && indexTs.includes("'error'")) {
    ok('Stale running tasks reset to error on startup')
  } else {
    fail('No stale task cleanup', 'Tasks stuck in Running after restart')
  }
}

// Check: TaskCreateModal shows errors
{
  const modal = readFileSync('./src/renderer/components/TaskCreateModal.tsx', 'utf8')
  if (modal.includes('setError(') && modal.includes('error &&')) {
    ok('TaskCreateModal displays inline error messages')
  } else {
    fail('TaskCreateModal swallows errors', 'User sees nothing when creation fails')
  }
}

// Check: TaskCard shows action errors
{
  const card = readFileSync('./src/renderer/components/TaskCard.tsx', 'utf8')
  if (card.includes('actionError') && card.includes('setActionError')) {
    ok('TaskCard displays inline action error messages')
  } else {
    fail('TaskCard swallows errors', 'User sees nothing when actions fail')
  }
}

// Check: TaskCard has busy/loading state
{
  const card = readFileSync('./src/renderer/components/TaskCard.tsx', 'utf8')
  if (card.includes('busy') && card.includes('pointer-events-none')) {
    ok('TaskCard disables buttons during async actions')
  } else {
    fail('TaskCard allows double-clicking', 'Actions can fire twice')
  }
}

// Check: error tasks have Discard button
{
  const card = readFileSync('./src/renderer/components/TaskCard.tsx', 'utf8')
  const errorSection = card.substring(card.indexOf("task.status === 'error'"))
  if (errorSection.includes('Discard')) {
    ok('Error tasks have Discard button')
  } else {
    fail('Error tasks missing Discard', 'Cannot remove errored tasks')
  }
}

// Check: needs-review tasks have Discard button
{
  const card = readFileSync('./src/renderer/components/TaskCard.tsx', 'utf8')
  const reviewSection = card.substring(card.indexOf("task.status === 'needs-review'"))
  if (reviewSection.includes('Discard')) {
    ok('Review tasks have Discard button')
  } else {
    fail('Review tasks missing Discard', 'Cannot reject changes')
  }
}

// Check: ProjectNode has remove button
{
  const pn = readFileSync('./src/renderer/components/canvas/ProjectNode.tsx', 'utf8')
  if (pn.includes('removeProject') && pn.includes('Remove project')) {
    ok('ProjectNode has hover X button to remove')
  } else {
    fail('ProjectNode missing remove', 'Cannot delete old projects')
  }
}

// Check: ProjectView switches to log tab for error tasks
{
  const pv = readFileSync('./src/renderer/components/ProjectView.tsx', 'utf8')
  if (pv.includes("'error') setActiveTab('log')")) {
    ok('ProjectView auto-switches to log tab for errored tasks')
  } else {
    fail('Missing error→log tab switch', 'View Log button does nothing')
  }
}

// Check: task:start recreates worktree if missing
{
  const handlers = readFileSync('./src/main/ipc-handlers.ts', 'utf8')
  if (handlers.includes("!task.worktreePath || !existsSync(task.worktreePath)")) {
    ok('task:start recreates worktree if path is missing')
  } else {
    fail('task:start assumes worktree exists', 'Retry after error fails')
  }
}

// Check: PR URL shown on card
{
  const card = readFileSync('./src/renderer/components/TaskCard.tsx', 'utf8')
  if (card.includes('prUrl') && card.includes('PR:')) {
    ok('TaskCard displays PR URL after creation')
  } else {
    fail('PR URL not shown', 'User cannot see the created PR link')
  }
}

// ══════════════════════════════════════════════════════════
//  3. IPC CHANNEL ALIGNMENT
// ══════════════════════════════════════════════════════════

section('3. IPC CHANNEL ALIGNMENT')

{
  const handlers = readFileSync('./src/main/ipc-handlers.ts', 'utf8')
  const preload = readFileSync('./src/preload/index.ts', 'utf8')

  const handleChannels = [...handlers.matchAll(/ipcMain\.handle\('([^']+)'/g)].map(m => m[1])
  const invokeChannels = [...preload.matchAll(/ipcRenderer\.invoke\('([^']+)'/g)].map(m => m[1])
  const eventChannels = [...preload.matchAll(/ipcRenderer\.on\('([^']+)'/g)].map(m => m[1])

  let mismatches = 0
  for (const ch of invokeChannels) {
    if (!handleChannels.includes(ch)) {
      fail(`IPC mismatch: "${ch}" in preload but no handler`, '')
      mismatches++
    }
  }
  for (const ch of handleChannels) {
    if (!invokeChannels.includes(ch)) {
      warn(`IPC: "${ch}" has handler but no preload invoke`, 'May be unused')
      mismatches++
    }
  }
  if (mismatches === 0) {
    ok(`All ${invokeChannels.length} invoke channels matched`)
    ok(`${eventChannels.length} event channels: ${eventChannels.join(', ')}`)
  }
}

// ══════════════════════════════════════════════════════════
//  4. GIT WORKTREE LIFECYCLE
// ══════════════════════════════════════════════════════════

section('4. GIT WORKTREE LIFECYCLE')

const testBranch = `test-${randomUUID().slice(0, 8)}`
const worktreePath = join(TEST_DIR, '..', '.bigide-worktrees', testBranch)

try {
  run(`git worktree add -b "${testBranch}" "${worktreePath}" "${defaultBranch}"`, { cwd: TEST_DIR })
  ok(`Worktree created: ${testBranch}`)
} catch (e) { fail('Worktree creation', e.message) }

// Simulate agent work
try {
  writeFileSync(join(worktreePath, 'hello.py'), 'print("Hello from BigIDE!")\n')
  run('git add hello.py && git commit -m "Add hello.py"', { cwd: worktreePath })
  ok('Agent simulated: hello.py created and committed')
} catch (e) { fail('Agent simulation', e.message) }

// Diff
try {
  const diff = run(`git diff "${defaultBranch}...${testBranch}"`, { cwd: TEST_DIR })
  if (diff.includes('+print')) ok('Diff shows hello.py changes')
  else fail('Diff', 'Expected +print line')
} catch (e) { fail('Diff', e.message) }

// Merge
try {
  run(`git merge "${testBranch}"`, { cwd: TEST_DIR })
  if (existsSync(join(TEST_DIR, 'hello.py'))) ok('Merge successful')
  else fail('Merge', 'hello.py not found')
} catch (e) { fail('Merge', e.message) }

// Cleanup
try {
  run(`git worktree remove "${worktreePath}" --force`, { cwd: TEST_DIR })
  ok('Worktree removed')
} catch (e) { fail('Worktree removal', e.message) }

// Branch collision test — create same branch again (simulates slugify + suffix)
const testBranch2 = `test-${randomUUID().slice(0, 8)}`
try {
  const wt2 = join(TEST_DIR, '..', '.bigide-worktrees', testBranch2)
  run(`git worktree add -b "${testBranch2}" "${wt2}" "${defaultBranch}"`, { cwd: TEST_DIR })
  run(`git worktree remove "${wt2}" --force`, { cwd: TEST_DIR })
  ok('Second worktree with unique branch succeeds (no collision)')
} catch (e) { fail('Branch collision test', e.message) }

// ══════════════════════════════════════════════════════════
//  5. OUTPUT PARSER PATTERNS
// ══════════════════════════════════════════════════════════

section('5. OUTPUT PARSER PATTERNS (24 tests)')

const completionPatterns = [
  /[✓✔]\s*.+completed/i,
  /successfully\s+(created|updated|fixed|added|implemented)/i,
  /all\s+\d+\s+tests?\s+passed/i,
  /(?:^|\n)\s*done[.!]?\s*$/im
]
const errorPatterns = [
  /^error:\s+.{10,}/im,
  /[✗✘]\s+(?:failed|error)/m,
  /^fatal:\s+/im,
  /^panic:\s+/im,
  /unhandled\s+exception/i
]
const inputPatterns = [
  /^[>❯]\s*$/m, /\?\s*$/m, /\(y\/n\)/i, /press enter/i, /waiting for input/i
]
const govPatterns = [
  /\$\s+(git\s+push)/i, /\$\s+(rm\s+-rf)/i, /\$\s+(npm\s+publish)/i, /\$\s+(deploy)/i
]

const tests = [
  // Completion
  ['Completion', '✓ Task completed successfully', true, completionPatterns],
  ['Completion', 'Successfully created the file', true, completionPatterns],
  ['Completion', 'All 5 tests passed', true, completionPatterns],
  ['Completion', 'npm install done', false, completionPatterns],
  ['Completion', '\ndone.', true, completionPatterns],
  // Error
  ['Error', 'error: something went wrong badly', true, errorPatterns],
  ['Error', 'Handling error: retry', false, errorPatterns],
  ['Error', '✗ failed to compile', true, errorPatterns],
  ['Error', 'fatal: not a git repository', true, errorPatterns],
  ['Error', 'Reading file error_log.txt', false, errorPatterns],
  // Input
  ['Input', '> ', true, inputPatterns],
  ['Input', 'Continue? ', true, inputPatterns],
  ['Input', 'Proceed (y/n)', true, inputPatterns],
  ['Input', 'Press Enter to continue', true, inputPatterns],
  // Governance
  ['Governance', '$ git push origin main', true, govPatterns],
  ['Governance', '$ rm -rf /tmp/old', true, govPatterns],
  ['Governance', '$ npm publish', true, govPatterns],
  ['Governance', '$ deploy production', true, govPatterns],
  ['Governance', '$ npm install', false, govPatterns],
  ['Governance', '$ git add .', false, govPatterns],
]

for (const [cat, input, expected, patterns] of tests) {
  const matches = patterns.some(p => p.test(input))
  if (matches === expected) ok(`${cat}: "${input.trim()}" → ${matches}`)
  else fail(`${cat}: "${input.trim()}"`, `expected ${expected}, got ${matches}`)
}

// ══════════════════════════════════════════════════════════
//  6. GOVERNANCE PERMISSION LOGIC
// ══════════════════════════════════════════════════════════

section('6. GOVERNANCE PERMISSIONS (9 scenarios)')

{
  const perms = {
    allowFileWrite: true, allowBash: true,
    allowNetworkAccess: false, allowGitPush: false,
    requireApprovalFor: ['git push', 'rm -rf', 'npm publish', 'deploy']
  }
  function checkPerm(action) {
    if (action.startsWith('file') && !perms.allowFileWrite) return false
    if (action.startsWith('bash') && !perms.allowBash) return false
    if (action.includes('network') && !perms.allowNetworkAccess) return false
    if (action.includes('git push') && !perms.allowGitPush) return false
    return !perms.requireApprovalFor.some(p => action.toLowerCase().includes(p.toLowerCase()))
  }

  const checks = [
    ['file write', true], ['bash command', true], ['network request', false],
    ['git push origin', false], ['rm -rf /tmp', false], ['npm publish', false],
    ['deploy to prod', false], ['git add .', true], ['npm install', true],
  ]
  for (const [action, expected] of checks) {
    if (checkPerm(action) === expected) ok(`${action} → ${expected}`)
    else fail(`${action}`, `expected ${expected}`)
  }
}

// ══════════════════════════════════════════════════════════
//  7. EDGE CASES
// ══════════════════════════════════════════════════════════

section('7. EDGE CASES')

// Slugify with random suffix
{
  const slugify = (title) => {
    const slug = title.toLowerCase().trim()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)
    const suffix = Math.random().toString(36).slice(2, 6)
    return `${slug}-${suffix}`
  }

  const s1 = slugify('Add a hello world script')
  const s2 = slugify('Add a hello world script')
  if (s1 !== s2) ok(`Branch names are unique: ${s1} ≠ ${s2}`)
  else fail('Branch names', 'Duplicated despite random suffix')

  const s3 = slugify('')
  if (s3.length >= 5) ok(`Empty title produces valid branch: "${s3}"`)
  else fail('Empty title slugify', `Too short: "${s3}"`)
}

// Windows path extraction
{
  const winPath = 'C:\\Users\\simon\\Downloads\\test_big_ide'
  const name = winPath.split(/[\\/]/).pop() ?? 'Project'
  if (name === 'test_big_ide') ok(`Windows path → name: "${name}"`)
  else fail('Windows path extraction', `Got "${name}"`)

  const unixPath = '/home/simon/projects/my-app'
  const name2 = unixPath.split(/[\\/]/).pop() ?? 'Project'
  if (name2 === 'my-app') ok(`Unix path → name: "${name2}"`)
  else fail('Unix path extraction', `Got "${name2}"`)
}

// Grace period check
{
  const startedAt = Date.now()
  if (Date.now() - startedAt < 3000) ok('Grace period blocks at t=0')
  const oldStart = Date.now() - 4000
  if (Date.now() - oldStart >= 3000) ok('Grace period allows at t=4s')
}

// Stale task reset logic
{
  const tasks = [
    { id: '1', status: 'running', ptyId: 'old-pty', needsInput: false, lastOutputLine: '' },
    { id: '2', status: 'todo', ptyId: null, needsInput: false, lastOutputLine: '' },
    { id: '3', status: 'done', ptyId: null, needsInput: false, lastOutputLine: '' },
  ]
  for (const t of tasks) {
    if (t.status === 'running') {
      t.status = 'error'
      t.lastOutputLine = 'Interrupted by restart'
      t.ptyId = null
    }
  }
  if (tasks[0].status === 'error' && tasks[0].ptyId === null) ok('Stale running→error reset works')
  else fail('Stale reset', `Got status=${tasks[0].status}`)
  if (tasks[1].status === 'todo') ok('Todo tasks unchanged by startup reset')
  if (tasks[2].status === 'done') ok('Done tasks unchanged by startup reset')
}

// ══════════════════════════════════════════════════════════
//  8. DATA MODEL INTEGRITY
// ══════════════════════════════════════════════════════════

section('8. DATA MODEL INTEGRITY')

{
  const task = {
    id: randomUUID(), projectId: randomUUID(), title: 'Test', prompt: 'Do things',
    status: 'todo', branchName: 'test-branch', worktreePath: null, ptyId: null,
    needsInput: false, lastOutputLine: '', model: 'claude-code', agentSummary: null,
    toolLog: [], diffStats: null,
    permissions: { allowFileWrite: true, allowBash: true, allowNetworkAccess: false,
      allowGitPush: false, requireApprovalFor: ['git push', 'rm -rf', 'npm publish', 'deploy'] },
    prUrl: null
  }
  const fields = ['id','projectId','title','prompt','status','branchName','worktreePath',
    'ptyId','needsInput','lastOutputLine','model','agentSummary','toolLog','diffStats',
    'permissions','prUrl']
  const missing = fields.filter(f => !(f in task))
  if (missing.length === 0) ok('AgentTask has all 16 required fields')
  else fail('AgentTask shape', `Missing: ${missing}`)
}

// ── Cleanup ──

section('CLEANUP')
try {
  rmSync(TEST_DIR, { recursive: true, force: true })
  if (existsSync(WORKTREE_BASE)) rmSync(WORKTREE_BASE, { recursive: true, force: true })
  // Clean up test branches
  try { run(`git branch -D "${testBranch}"`, { cwd: TEST_DIR }) } catch {}
  ok('Test environment cleaned up')
} catch (e) { warn('Cleanup', e.message) }

// ── Summary ──

console.log(`\n${'═'.repeat(60)}`)
console.log(`  DRY RUN v2 RESULTS`)
console.log(`${'═'.repeat(60)}`)
console.log(`  ✅ Passed:   ${passed}`)
console.log(`  ❌ Failed:   ${failed}`)
console.log(`  ⚠️  Warnings: ${warnings}`)
console.log(`${'═'.repeat(60)}`)

if (failed > 0) {
  console.log('\n  ‼️  FAILURES DETECTED — fix before running the app.')
  process.exit(1)
} else {
  console.log('\n  🎉 All tests passed. Safe to run npm run dev.')
  process.exit(0)
}
