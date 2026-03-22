import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels'
import type { RightPanelTab } from '../lib/types'

interface PanelLayoutProps {
  left: React.ReactNode
  right: React.ReactNode
  activeTab: RightPanelTab
  onTabChange: (tab: RightPanelTab) => void
}

const TABS: { id: RightPanelTab; label: string }[] = [
  { id: 'terminal', label: 'Terminal' },
  { id: 'browser', label: 'Browser' },
  { id: 'diff', label: 'Diff' },
  { id: 'log', label: 'Log' },
  { id: 'summary', label: 'Summary' }
]

export function PanelLayout({ left, right, activeTab, onTabChange }: PanelLayoutProps) {
  return (
    <PanelGroup direction="horizontal" className="h-full">
      <Panel defaultSize={25} minSize={15} maxSize={40}>
        <div className="h-full overflow-hidden">{left}</div>
      </Panel>
      <PanelResizeHandle className="w-2 bg-gray-700 hover:bg-blue-500 active:bg-blue-400 transition-colors cursor-col-resize flex items-center justify-center">
        <div className="w-0.5 h-8 bg-gray-500 rounded-full" />
      </PanelResizeHandle>
      <Panel defaultSize={75} minSize={50}>
        <div className="h-full flex flex-col">
          {/* Tab bar */}
          <div className="flex border-b border-gray-800 bg-gray-900/50">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`px-4 py-2 text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'text-blue-400 border-b-2 border-blue-400 bg-gray-800/50'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/30'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {/* Content */}
          <div className="flex-1 overflow-hidden">{right}</div>
        </div>
      </Panel>
    </PanelGroup>
  )
}
