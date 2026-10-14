import { useEffect, useRef } from 'react'
import type { AgentLogEntry } from '../types'
import { XIcon } from './icons'

interface AgentLogPanelProps {
  entries: AgentLogEntry[]
  running: boolean
  onClear: () => void
  onClose: () => void
}

export function AgentLogPanel({ entries, running, onClear, onClose }: AgentLogPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = scrollRef.current
    if (element) element.scrollTop = element.scrollHeight
  }, [entries])

  return (
    <section className="agent-log-panel">
      <header className="agent-log-head">
        <span className={`agent-log-status${running ? ' running' : ''}`} />
        <span className="agent-log-title">智能体执行日志</span>
        <span className="agent-log-state">{running ? '运行中' : '当前会话'}</span>
        <button className="agent-log-clear" onClick={onClear} disabled={entries.length === 0}>
          清空
        </button>
        <button className="agent-log-close" onClick={onClose} title="隐藏执行日志" aria-label="隐藏执行日志">
          <XIcon size={14} />
        </button>
      </header>
      <div className="agent-log-terminal" ref={scrollRef} role="log" aria-live="polite">
        {entries.length === 0 ? (
          <div className="agent-log-empty">智能体开始工作后，执行过程会显示在这里。</div>
        ) : (
          entries.map((entry) => (
            <div className={`agent-log-entry ${entry.level}`} key={entry.id}>
              <time>{entry.time}</time>
              <span>{entry.message}</span>
            </div>
          ))
        )}
        {running && <div className="agent-log-cursor">正在处理<span>▌</span></div>}
      </div>
    </section>
  )
}
