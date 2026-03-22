import simpleGit from 'simple-git'
import { join, basename } from 'path'
import type { Project, AgentTask } from '../shared/types'

export async function createWorktree(
  repoPath: string,
  branchName: string,
  baseBranch: string
): Promise<string> {
  const git = simpleGit(repoPath)
  const worktreePath = join(repoPath, '..', `.bigide-worktrees`, branchName)
  await git.raw(['worktree', 'add', '-b', branchName, worktreePath, baseBranch])
  return worktreePath
}

export async function removeWorktree(repoPath: string, worktreePath: string): Promise<void> {
  const git = simpleGit(repoPath)
  try {
    await git.raw(['worktree', 'remove', worktreePath, '--force'])
  } catch (err: any) {
    console.error('Failed to remove worktree:', err.message)
  }
}

export async function listWorktrees(repoPath: string): Promise<string[]> {
  const git = simpleGit(repoPath)
  const result = await git.raw(['worktree', 'list', '--porcelain'])
  return result
    .split('\n')
    .filter(line => line.startsWith('worktree '))
    .map(line => line.replace('worktree ', ''))
}

export async function getDiff(
  repoPath: string,
  branchName: string,
  baseBranch: string
): Promise<string> {
  const git = simpleGit(repoPath)
  try {
    return await git.raw(['diff', `${baseBranch}...${branchName}`])
  } catch {
    return ''
  }
}

export async function getDiffStats(
  repoPath: string,
  branchName: string,
  baseBranch: string
): Promise<{ filesChanged: number; insertions: number; deletions: number }> {
  const git = simpleGit(repoPath)
  try {
    const result = await git.raw(['diff', '--stat', `${baseBranch}...${branchName}`])
    const lastLine = result.trim().split('\n').pop() || ''
    const filesMatch = lastLine.match(/(\d+) files? changed/)
    const insMatch = lastLine.match(/(\d+) insertions?/)
    const delMatch = lastLine.match(/(\d+) deletions?/)
    return {
      filesChanged: filesMatch ? parseInt(filesMatch[1]) : 0,
      insertions: insMatch ? parseInt(insMatch[1]) : 0,
      deletions: delMatch ? parseInt(delMatch[1]) : 0
    }
  } catch {
    return { filesChanged: 0, insertions: 0, deletions: 0 }
  }
}

export async function mergeBranch(repoPath: string, branchName: string): Promise<void> {
  const git = simpleGit(repoPath)
  await git.merge([branchName])
}

export async function createGitHubRepo(
  repoPath: string,
  repoName: string,
  isPublic: boolean = true
): Promise<string> {
  const { execSync } = await import('child_process')
  const git = simpleGit(repoPath)

  // Check if remote 'origin' already exists
  const remotes = await git.getRemotes(true)
  const origin = remotes.find(r => r.name === 'origin')

  if (origin) {
    // Remote exists — verify the repo actually exists on GitHub
    const url = origin.refs.push || origin.refs.fetch
    const match = url.match(/github\.com[:/]([^/]+\/[^/.]+)/)
    if (match) {
      const repoSlug = match[1].replace(/\.git$/, '')
      try {
        execSync(`gh repo view "${repoSlug}" --json name`, { encoding: 'utf8', stdio: 'pipe' })
        return repoSlug // Repo exists on GitHub
      } catch {
        // Remote is set but repo doesn't exist — remove stale remote and create fresh
        await git.removeRemote('origin')
      }
    } else {
      throw new Error(`Remote 'origin' exists but is not a GitHub URL: ${url}`)
    }
  }

  // Create repo via gh CLI
  const visibility = isPublic ? '--public' : '--private'
  try {
    execSync(`gh repo create "${repoName}" ${visibility} --source=. --push`, {
      cwd: repoPath,
      encoding: 'utf8',
      stdio: 'pipe'
    })
  } catch (err: any) {
    throw new Error(`Failed to create GitHub repo: ${err.stderr || err.message}`)
  }

  // Read back the remote to get owner/repo
  const updatedRemotes = await git.getRemotes(true)
  const newOrigin = updatedRemotes.find(r => r.name === 'origin')
  if (newOrigin) {
    const url = newOrigin.refs.push || newOrigin.refs.fetch
    const match = url.match(/github\.com[:/]([^/]+\/[^/.]+)/)
    if (match) return match[1].replace(/\.git$/, '')
  }

  return repoName
}

export async function createPullRequest(project: Project, task: AgentTask): Promise<string> {
  if (!project.githubRepo) throw new Error('No GitHub repo configured')

  const git = simpleGit(project.rootPath)

  // Push the base branch first (GitHub needs it to exist for the PR target)
  try {
    await git.push('origin', project.defaultBranch)
  } catch {
    // May already exist — that's fine
  }

  // Push the task branch
  await git.push(['-u', 'origin', task.branchName])

  // Use octokit to create PR
  const { Octokit } = await import('octokit')

  // Try to get token from gh CLI or env
  let token = process.env.GITHUB_TOKEN
  if (!token) {
    try {
      const { execSync } = await import('child_process')
      token = execSync('gh auth token', { encoding: 'utf8' }).trim()
    } catch {
      throw new Error('No GitHub token found. Set GITHUB_TOKEN or install gh CLI.')
    }
  }

  const octokit = new Octokit({ auth: token })
  const [owner, repo] = project.githubRepo.split('/')

  const body = task.agentSummary
    ? `## Agent Summary\n\n${task.agentSummary}\n\n---\n*Created by BigIDE*`
    : `*Created by BigIDE*\n\nPrompt: ${task.prompt}`

  const { data } = await octokit.rest.pulls.create({
    owner,
    repo,
    title: task.title,
    body,
    head: task.branchName,
    base: project.defaultBranch
  })

  return data.html_url
}
