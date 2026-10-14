import { useEffect, useState } from 'react'
import type { PromptContextSnapshot } from '../types'
import { XIcon } from './icons'

interface PromptContextModalProps {
  open: boolean
  snapshots: PromptContextSnapshot[]
  canExport: boolean
  onClose: () => void
  onExport: () => void
}

type ContextSection = 'system' | 'messages' | 'tools'

function formatJson(value: unknown): string {
  const serialized = JSON.stringify(value, null, 2)
  return serialized ?? String(value)
}

function checkpointReasonLabel(reason?: string): string {
  if (reason === 'history_restore') return '恢复历史'
  if (reason === 'handoff') return '工作交接'
  return '窗口接近上限'
}

export function PromptContextModal({
  open,
  snapshots,
  canExport,
  onClose,
  onExport,
}: PromptContextModalProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [section, setSection] = useState<ContextSection>('system')

  useEffect(() => {
    setSelectedIndex(Math.max(0, snapshots.length - 1))
  }, [snapshots.length])

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  if (!open) return null

  const selected = snapshots[selectedIndex]
  const sectionContent = selected
    ? section === 'system'
      ? selected.system ?? '当前供应商的请求没有单独的 system 字段。'
      : section === 'messages'
        ? formatJson(selected.messages)
        : formatJson(selected.tools)
    : ''

  return (
    <div
      className="prompt-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        className="prompt-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="prompt-modal-title"
      >
        <header className="prompt-modal-head">
          <div className="prompt-modal-heading">
            <h2 id="prompt-modal-title">当前任务模型请求上下文</h2>
            <p>这里只保留当前任务的模型请求；提交下一个问题后会重新记录。</p>
          </div>
          <div className="prompt-modal-actions">
            <button
              className="prompt-export-btn"
              onClick={onExport}
              disabled={!canExport}
              title={canExport ? '导出当前任务全部模型请求为 TXT 文件' : '当前任务还没有可导出的请求'}
            >
              导出当前任务 TXT
            </button>
            <button className="icon-btn" title="关闭" aria-label="关闭提示词窗口" onClick={onClose}>
              <XIcon />
            </button>
          </div>
        </header>

        {snapshots.length > 0 ? (
          <>
            <nav className="prompt-round-tabs" aria-label="模型调用轮次">
              {snapshots.map((snapshot, index) => (
                <button
                  key={index}
                  className={index === selectedIndex ? 'selected' : ''}
                  onClick={() => setSelectedIndex(index)}
                >
                  第 {index + 1} 次调用
                </button>
              ))}
            </nav>
            {selected && (
              <div className="prompt-request-meta">
                <span>{selected.provider || '未知服务商'}</span>
                <span>{selected.model || '未知模型'}</span>
                <span>
                  {selected.purpose === 'checkpoint_compaction'
                    ? `第 ${selected.iteration} 轮前生成 Checkpoint（${checkpointReasonLabel(selected.reason)}）`
                    : `当前任务第 ${selected.iteration} 轮`}
                </span>
              </div>
            )}
            <nav className="prompt-section-tabs" aria-label="上下文内容">
              <button
                className={section === 'system' ? 'selected' : ''}
                onClick={() => setSection('system')}
              >
                System
              </button>
              <button
                className={section === 'messages' ? 'selected' : ''}
                onClick={() => setSection('messages')}
              >
                Messages
              </button>
              <button
                className={section === 'tools' ? 'selected' : ''}
                onClick={() => setSection('tools')}
              >
                Tools
              </button>
            </nav>
            <pre className="prompt-context-content">{sectionContent}</pre>
          </>
        ) : (
          <div className="prompt-context-empty">
            {canExport
              ? '当前任务还没有模型请求记录。'
              : '发送一条消息后，这里会实时显示当前任务的模型请求。'}
          </div>
        )}
      </section>
    </div>
  )
}
