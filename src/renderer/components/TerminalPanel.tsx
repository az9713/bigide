import React, { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'

interface TerminalPanelProps {
  ptyId: string | null
  taskId: string
}

export default function TerminalPanel({ ptyId, taskId }: TerminalPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const terminal = new Terminal({
      theme: {
        background: '#0d1117',
        foreground: '#c9d1d9',
        cursor: '#58a6ff',
        cursorAccent: '#0d1117',
        selectionBackground: '#3b5070',
        black: '#484f58',
        red: '#ff7b72',
        green: '#3fb950',
        yellow: '#d29922',
        blue: '#58a6ff',
        magenta: '#bc8cff',
        cyan: '#39c5cf',
        white: '#b1bac4',
        brightBlack: '#6e7681',
        brightRed: '#ffa198',
        brightGreen: '#56d364',
        brightYellow: '#e3b341',
        brightBlue: '#79c0ff',
        brightMagenta: '#d2a8ff',
        brightCyan: '#56d4dd',
        brightWhite: '#f0f6fc',
      },
      fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
      fontSize: 13,
      lineHeight: 1.4,
      cursorBlink: true,
      scrollback: 5000,
      allowProposedApi: true,
      rightClickSelectsWord: true,
    })

    // Clipboard shortcuts — only intercept on keydown, let everything else through
    terminal.attachCustomKeyEventHandler((e) => {
      if (e.type !== 'keydown') return true
      if (e.ctrlKey && e.key === 'c' && terminal.hasSelection()) {
        navigator.clipboard.writeText(terminal.getSelection())
        terminal.clearSelection()
        return false
      }
      if (e.ctrlKey && e.key === 'v') {
        navigator.clipboard.readText().then(text => {
          if (ptyId) window.bigide.terminalWrite(ptyId, text)
        })
        return false
      }
      if (e.ctrlKey && e.key === 'a') {
        terminal.selectAll()
        return false
      }
      return true
    })

    const fitAddon = new FitAddon()
    const webLinksAddon = new WebLinksAddon()

    terminal.loadAddon(fitAddon)
    terminal.loadAddon(webLinksAddon)
    terminal.open(containerRef.current)

    // Initial fit and focus
    requestAnimationFrame(() => {
      fitAddon.fit()
      terminal.focus()
    })

    terminalRef.current = terminal
    fitAddonRef.current = fitAddon

    // Handle user input — write directly to PTY for reliability
    const inputDisposable = terminal.onData((data) => {
      if (ptyId) {
        window.bigide.terminalWrite(ptyId, data)
      }
    })

    // Subscribe to terminal data from main process
    let unsubscribeTerminalData: (() => void) | null = null
    if (ptyId) {
      unsubscribeTerminalData = window.bigide.onTerminalData((incomingPtyId, data) => {
        if (incomingPtyId === ptyId) {
          terminal.write(data)
        }
      })
    }

    // ResizeObserver to auto-fit
    const resizeObserver = new ResizeObserver(() => {
      if (fitAddonRef.current && terminalRef.current) {
        try {
          fitAddonRef.current.fit()
          const { cols, rows } = terminalRef.current
          if (ptyId) {
            window.bigide.terminalResize(ptyId, cols, rows)
          }
        } catch {
          // ignore fit errors during rapid resize
        }
      }
    })

    resizeObserver.observe(containerRef.current)

    return () => {
      inputDisposable.dispose()
      unsubscribeTerminalData?.()
      resizeObserver.disconnect()
      terminal.dispose()
      terminalRef.current = null
      fitAddonRef.current = null
    }
  }, [ptyId, taskId])

  if (!ptyId) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[#0d1117]">
        <p className="text-sm text-gray-500">No terminal attached to this task</p>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="h-full w-full overflow-hidden bg-[#0d1117]"
      style={{ padding: '4px' }}
      onClick={() => terminalRef.current?.focus()}
    />
  )
}
