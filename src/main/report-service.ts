import { getTask, getProjects, updateTask } from './store'
import { getDiff, getDiffStats } from './git-service'
import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'
import type { AgentTask, ToolLogEntry } from '../shared/types'

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatDuration(startMs: number | null, endMs: number | null): string {
  if (!startMs || !endMs) return 'N/A'
  const seconds = Math.floor((endMs - startMs) / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const secs = seconds % 60
  if (minutes < 60) return `${minutes}m ${secs}s`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ${minutes % 60}m`
}

function formatTimestamp(ms: number | null): string {
  if (!ms) return 'N/A'
  return new Date(ms).toLocaleString()
}

function toolIcon(tool: string): string {
  switch (tool) {
    case 'file_edit': return '&#9998;'
    case 'bash': return '&#36;'
    case 'file_read': return '&#128196;'
    case 'search': return '&#128269;'
    case 'governance': return '&#9888;'
    default: return '&#9670;'
  }
}

function statusBadge(status: string): string {
  const colors: Record<string, string> = {
    'todo': '#6b7280',
    'running': '#3b82f6',
    'needs-review': '#eab308',
    'done': '#22c55e',
    'error': '#ef4444',
  }
  const color = colors[status] || '#6b7280'
  return `<span style="background:${color};color:white;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:600;">${escapeHtml(status)}</span>`
}

export async function generateReport(taskId: string): Promise<string | null> {
  const task = getTask(taskId)
  if (!task) return null

  const project = getProjects().find(p => p.id === task.projectId)
  const projectName = project?.name || 'Unknown Project'
  const projectPath = project?.rootPath || ''

  // Get diff if available
  let diffText = ''
  let diffStats = task.diffStats
  if (project && task.branchName) {
    try {
      diffText = await getDiff(project.rootPath, task.branchName, project.defaultBranch)
      if (!diffStats) {
        diffStats = await getDiffStats(project.rootPath, task.branchName, project.defaultBranch)
      }
    } catch {}
  }

  // Build terminal transcript section
  const terminalLines = (task.terminalLog || []).join('\n')

  // Build tool log timeline
  const toolLogHtml = (task.toolLog || []).map((entry: ToolLogEntry) => {
    const time = new Date(entry.timestamp).toLocaleTimeString()
    const icon = toolIcon(entry.tool)
    const resultClass = entry.result === 'error' ? 'color:#ef4444;' : 'color:#22c55e;'
    const files = entry.filesAffected.length > 0
      ? entry.filesAffected.map(f => `<code>${escapeHtml(f)}</code>`).join(', ')
      : ''
    return `<div style="padding:6px 0;border-bottom:1px solid #21262d;font-size:13px;">
      <span style="color:#8b949e;">${time}</span>
      <span style="margin:0 6px;">${icon}</span>
      <strong style="color:#c9d1d9;">${escapeHtml(entry.tool)}</strong>
      <span style="${resultClass}margin-left:6px;">[${entry.result}]</span>
      ${entry.args ? `<div style="color:#8b949e;font-size:12px;margin-top:2px;padding-left:20px;">${escapeHtml(entry.args.slice(0, 200))}</div>` : ''}
      ${files ? `<div style="padding-left:20px;margin-top:2px;">${files}</div>` : ''}
    </div>`
  }).join('')

  // Build diff section with syntax highlighting
  const diffHtml = diffText ? diffText.split('\n').map(line => {
    let style = 'color:#c9d1d9;'
    if (line.startsWith('+') && !line.startsWith('+++')) style = 'color:#3fb950;background:#0d1f0d;'
    else if (line.startsWith('-') && !line.startsWith('---')) style = 'color:#ff7b72;background:#1f0d0d;'
    else if (line.startsWith('@@')) style = 'color:#79c0ff;'
    else if (line.startsWith('diff ') || line.startsWith('index ')) style = 'color:#8b949e;font-weight:bold;'
    return `<div style="${style}padding:1px 8px;font-size:12px;font-family:monospace;white-space:pre;">${escapeHtml(line)}</div>`
  }).join('') : '<p style="color:#8b949e;">No diff available</p>'

  // Governance decisions
  const govEntries = (task.toolLog || []).filter(e => e.tool === 'governance')
  const govHtml = govEntries.length > 0 ? govEntries.map(e => {
    const time = new Date(e.timestamp).toLocaleTimeString()
    const color = e.result === 'success' ? '#3fb950' : '#ef4444'
    return `<div style="padding:4px 0;font-size:13px;">
      <span style="color:#8b949e;">${time}</span>
      <span style="color:${color};margin-left:8px;font-weight:600;">${escapeHtml(e.args)}</span>
    </div>`
  }).join('') : '<p style="color:#8b949e;">No governance actions triggered</p>'

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>BigIDE Session Report — ${escapeHtml(task.title)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; background: #0d1117; color: #c9d1d9; line-height: 1.6; }
    .container { max-width: 960px; margin: 0 auto; padding: 32px 24px; }
    h1 { font-size: 24px; color: #f0f6fc; margin-bottom: 4px; }
    h2 { font-size: 18px; color: #f0f6fc; margin: 32px 0 12px; padding-bottom: 8px; border-bottom: 1px solid #21262d; }
    h3 { font-size: 14px; color: #8b949e; margin-bottom: 16px; }
    .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 20px 0; }
    .meta-card { background: #161b22; border: 1px solid #21262d; border-radius: 8px; padding: 12px 16px; }
    .meta-label { font-size: 11px; color: #8b949e; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
    .meta-value { font-size: 14px; color: #c9d1d9; font-weight: 500; }
    .prompt-box { background: #161b22; border: 1px solid #21262d; border-radius: 8px; padding: 16px; margin: 12px 0; font-size: 14px; white-space: pre-wrap; }
    .terminal-box { background: #0d1117; border: 1px solid #21262d; border-radius: 8px; padding: 16px; margin: 12px 0; max-height: 500px; overflow-y: auto; font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace; font-size: 12px; white-space: pre-wrap; word-break: break-all; color: #c9d1d9; }
    .diff-box { background: #0d1117; border: 1px solid #21262d; border-radius: 8px; overflow: hidden; margin: 12px 0; max-height: 600px; overflow-y: auto; }
    .stats { display: flex; gap: 16px; margin: 12px 0; }
    .stat { background: #161b22; border: 1px solid #21262d; border-radius: 6px; padding: 8px 14px; font-size: 13px; }
    .stat-green { color: #3fb950; }
    .stat-red { color: #ff7b72; }
    .timeline { background: #161b22; border: 1px solid #21262d; border-radius: 8px; padding: 12px 16px; margin: 12px 0; max-height: 400px; overflow-y: auto; }
    .summary-box { background: #161b22; border: 1px solid #21262d; border-radius: 8px; padding: 16px; margin: 12px 0; font-size: 14px; white-space: pre-wrap; }
    .pr-link { display: inline-block; background: #238636; color: white; padding: 6px 16px; border-radius: 6px; text-decoration: none; font-size: 13px; font-weight: 600; margin: 8px 0; }
    .pr-link:hover { background: #2ea043; }
    .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #21262d; color: #484f58; font-size: 12px; text-align: center; }
    code { background: #21262d; padding: 1px 6px; border-radius: 3px; font-size: 12px; }
    .section-toggle { cursor: pointer; user-select: none; }
    .section-toggle:hover { color: #58a6ff; }
  </style>
</head>
<body>
  <div class="container">
    <h1>&#128221; Session Report</h1>
    <h3>${escapeHtml(projectName)} &mdash; ${escapeHtml(task.title)}</h3>

    <!-- Meta Info -->
    <div class="meta">
      <div class="meta-card">
        <div class="meta-label">Status</div>
        <div class="meta-value">${statusBadge(task.status)}</div>
      </div>
      <div class="meta-card">
        <div class="meta-label">Model</div>
        <div class="meta-value">${escapeHtml(task.model)}</div>
      </div>
      <div class="meta-card">
        <div class="meta-label">Started</div>
        <div class="meta-value">${formatTimestamp(task.startedAt)}</div>
      </div>
      <div class="meta-card">
        <div class="meta-label">Completed</div>
        <div class="meta-value">${formatTimestamp(task.completedAt)}</div>
      </div>
      <div class="meta-card">
        <div class="meta-label">Duration</div>
        <div class="meta-value">${formatDuration(task.startedAt, task.completedAt)}</div>
      </div>
      <div class="meta-card">
        <div class="meta-label">Branch</div>
        <div class="meta-value"><code>${escapeHtml(task.branchName)}</code></div>
      </div>
    </div>

    <!-- Prompt -->
    <h2>&#128172; Prompt</h2>
    <div class="prompt-box">${escapeHtml(task.prompt)}</div>

    ${task.prUrl ? `
    <!-- PR Link -->
    <h2>&#128279; Pull Request</h2>
    <a href="${escapeHtml(task.prUrl)}" class="pr-link" target="_blank">${escapeHtml(task.prUrl)}</a>
    ` : ''}

    <!-- Diff Stats -->
    <h2>&#128200; Changes</h2>
    ${diffStats ? `
    <div class="stats">
      <div class="stat">${diffStats.filesChanged} file${diffStats.filesChanged !== 1 ? 's' : ''} changed</div>
      <div class="stat stat-green">+${diffStats.insertions} insertions</div>
      <div class="stat stat-red">-${diffStats.deletions} deletions</div>
    </div>
    ` : ''}

    <!-- Diff -->
    <div class="diff-box">${diffHtml}</div>

    <!-- Agent Summary -->
    ${task.agentSummary ? `
    <h2>&#128203; Agent Summary</h2>
    <div class="summary-box">${escapeHtml(task.agentSummary)}</div>
    ` : ''}

    <!-- Tool Log Timeline -->
    <h2>&#128295; Tool Log (${task.toolLog?.length || 0} actions)</h2>
    <div class="timeline">${toolLogHtml || '<p style="color:#8b949e;">No tool calls recorded</p>'}</div>

    <!-- Governance -->
    <h2>&#9888; Governance Decisions</h2>
    <div class="timeline">${govHtml}</div>

    <!-- Terminal Transcript -->
    <h2>&#128187; Terminal Transcript (${task.terminalLog?.length || 0} lines)</h2>
    <div class="terminal-box">${terminalLines ? escapeHtml(terminalLines) : 'No terminal output captured'}</div>

    <!-- Footer -->
    <div class="footer">
      Generated by BigIDE &mdash; ${new Date().toLocaleString()}
      ${project ? ` &mdash; ${escapeHtml(project.rootPath)}` : ''}
    </div>
  </div>
</body>
</html>`

  // Save report to .bigide-reports/ in project directory
  const reportsDir = project
    ? join(project.rootPath, '.bigide-reports')
    : join(process.cwd(), '.bigide-reports')

  if (!existsSync(reportsDir)) {
    mkdirSync(reportsDir, { recursive: true })
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const slug = task.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)
  const filename = `${slug}-${timestamp}.html`
  const reportPath = join(reportsDir, filename)

  writeFileSync(reportPath, html, 'utf8')
  updateTask(taskId, { reportPath })

  return reportPath
}
