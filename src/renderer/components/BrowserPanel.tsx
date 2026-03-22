import React, { useState, useRef, useEffect } from 'react'

declare global {
  namespace JSX {
    interface IntrinsicElements {
      webview: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        src?: string
        allowpopups?: string
        partition?: string
      }
    }
  }
}

interface BrowserPanelProps {
  url?: string
  taskId?: string | null
}

export function BrowserPanel({ url, taskId }: BrowserPanelProps) {
  const [currentUrl, setCurrentUrl] = useState(url || 'about:blank')
  const [inputUrl, setInputUrl] = useState(url || '')
  const [loading, setLoading] = useState(false)
  const [failedLoad, setFailedLoad] = useState(false)
  const [serving, setServing] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const webviewRef = useRef<HTMLElement & {
    goBack: () => void
    goForward: () => void
    reload: () => void
    loadURL: (url: string) => void
  }>(null)

  // Sync external url prop changes
  useEffect(() => {
    if (url && url !== currentUrl) {
      setCurrentUrl(url)
      setInputUrl(url)
      setFailedLoad(false)
    }
  }, [url])

  // Auto-serve when taskId changes and no URL is loaded
  useEffect(() => {
    if (taskId && currentUrl === 'about:blank') {
      serveTask()
    }
  }, [taskId])

  // Attach webview event listeners
  useEffect(() => {
    const wv = webviewRef.current
    if (!wv) return

    const onStartLoad = () => {
      setLoading(true)
      setFailedLoad(false)
    }
    const onStopLoad = () => setLoading(false)
    const onNavigate = (e: Event & { url?: string }) => {
      const navigatedUrl = (e as unknown as { url: string }).url
      setCurrentUrl(navigatedUrl)
      setInputUrl(navigatedUrl)
      setLoading(false)
    }
    const onFailLoad = () => {
      setLoading(false)
      setFailedLoad(true)
    }

    wv.addEventListener('did-start-loading', onStartLoad)
    wv.addEventListener('did-stop-loading', onStopLoad)
    wv.addEventListener('did-navigate', onNavigate)
    wv.addEventListener('did-navigate-in-page', onNavigate)
    wv.addEventListener('did-fail-load', onFailLoad)

    return () => {
      wv.removeEventListener('did-start-loading', onStartLoad)
      wv.removeEventListener('did-stop-loading', onStopLoad)
      wv.removeEventListener('did-navigate', onNavigate)
      wv.removeEventListener('did-navigate-in-page', onNavigate)
      wv.removeEventListener('did-fail-load', onFailLoad)
    }
  }, [])

  const navigate = (targetUrl: string) => {
    let finalUrl = targetUrl.trim()
    if (!finalUrl) return
    if (!finalUrl.includes('://') && !finalUrl.startsWith('about:')) {
      if (/^[\w-]+(\.[\w-]+)+/.test(finalUrl)) {
        finalUrl = 'https://' + finalUrl
      } else {
        finalUrl = 'https://www.google.com/search?q=' + encodeURIComponent(finalUrl)
      }
    }
    setCurrentUrl(finalUrl)
    setInputUrl(finalUrl)
    setFailedLoad(false)
  }

  const goBack = () => webviewRef.current?.goBack()
  const goForward = () => webviewRef.current?.goForward()
  const reload = () => webviewRef.current?.reload()

  const serveTask = async () => {
    if (!taskId) {
      setServerError('Select a task first')
      return
    }
    setServing(true)
    setServerError(null)
    try {
      const previewUrl = await window.bigide.previewServe(taskId)
      if (previewUrl) {
        const fullUrl = previewUrl as string
        setCurrentUrl(fullUrl)
        setInputUrl(fullUrl)
        setFailedLoad(false)
        // Force webview navigation
        const wv = webviewRef.current
        if (wv && wv.loadURL) {
          wv.loadURL(fullUrl)
        }
      } else {
        setServerError('No worktree path found for this task. Start the task first.')
      }
    } catch (err: any) {
      setServerError(err?.message || 'Failed to start preview server')
    } finally {
      setServing(false)
    }
  }

  return (
    <div className="flex h-full flex-col bg-[#0d1117]">
      {/* Toolbar */}
      <div className="flex shrink-0 items-center gap-1.5 border-b border-gray-800 bg-[#161b22] px-2 py-1.5">
        <button onClick={goBack} title="Back"
          className="flex h-6 w-6 items-center justify-center rounded text-gray-500 transition-colors hover:bg-gray-800 hover:text-gray-200">
          &#9664;
        </button>
        <button onClick={goForward} title="Forward"
          className="flex h-6 w-6 items-center justify-center rounded text-gray-500 transition-colors hover:bg-gray-800 hover:text-gray-200">
          &#9654;
        </button>
        <button onClick={reload} title="Reload"
          className="flex h-6 w-6 items-center justify-center rounded text-gray-500 transition-colors hover:bg-gray-800 hover:text-gray-200">
          &#8635;
        </button>

        {taskId && (
          <button
            onClick={serveTask}
            disabled={serving}
            title="Preview task files (serves worktree on localhost)"
            className="rounded bg-green-700 px-2 py-1 text-xs font-medium text-white hover:bg-green-600 disabled:opacity-50"
          >
            {serving ? 'Starting...' : 'Preview'}
          </button>
        )}

        <form onSubmit={(e) => { e.preventDefault(); navigate(inputUrl) }} className="flex flex-1">
          <input
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            placeholder="Enter URL or click Preview to serve task files…"
            className="flex-1 rounded-l border border-gray-700 bg-gray-800 px-3 py-1 text-xs text-gray-200 outline-none focus:border-blue-500"
          />
          <button type="submit"
            className="rounded-r border border-l-0 border-gray-600 bg-gray-700 px-3 py-1 text-xs text-gray-300 transition-colors hover:bg-gray-600">
            Go
          </button>
        </form>

        {loading && (
          <div className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-gray-600 border-t-blue-400" />
        )}
      </div>

      {/* Content area */}
      <div className="relative flex-1">
        {currentUrl === 'about:blank' || !currentUrl.startsWith('http') ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#0d1117]">
            <div className="text-center">
              {serverError && (
                <p className="mb-2 text-xs text-red-400">{serverError}</p>
              )}
              <p className="text-sm text-gray-400 mb-3">
                {taskId ? 'Preview the files created by the agent' : 'Select a task first, then click Preview'}
              </p>
              {taskId && (
                <button
                  onClick={serveTask}
                  disabled={serving}
                  className="rounded bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-600 disabled:opacity-50"
                >
                  {serving ? 'Starting server...' : 'Preview Task Files'}
                </button>
              )}
            </div>
          </div>
        ) : (
          <iframe
            ref={webviewRef as any}
            src={currentUrl}
            className="h-full w-full border-0 bg-white"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            title="Preview"
          />
        )}
      </div>
    </div>
  )
}
