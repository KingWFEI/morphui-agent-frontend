import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { ContextUsage, Message, PromptContextSnapshot, ToolApprovalRequest } from '../types'
import { ArrowUpIcon, FolderIcon, PlusIcon, SparkIcon, StopIcon } from './icons'
import { ContextUsageModal } from './ContextUsageModal'
import { PromptContextModal } from './PromptContextModal'
import { ToolApprovalPanel } from './ToolApprovalPanel'

interface ChatPanelProps {
  messages: Message[]
  userName: string
  pending: boolean
  isRunning: boolean
  canStop: boolean
  isStopping: boolean
  onStop: () => void
  streamingMessageId: string | null
  contextUsage: ContextUsage | null
  promptContexts: PromptContextSnapshot[]
  canExportPromptContexts: boolean
  onExportPromptContexts: () => void
  projectLabel: string
  projectPath: string | null
  onChooseProject: () => void
  approvalRequests: ToolApprovalRequest[]
  onRespondToApproval: (request: ToolApprovalRequest, approved: boolean) => void
  onSend: (text: string) => void
}

interface AssistantMessageProps {
  content: string
  streaming: boolean
}

function AssistantMessage({ content, streaming }: AssistantMessageProps) {
  const characters = Array.from(content)
  const latestLength = useRef(characters.length)
  const [visibleLength, setVisibleLength] = useState(streaming ? 0 : characters.length)
  latestLength.current = characters.length

  useEffect(() => {
    if (!streaming) {
      setVisibleLength(latestLength.current)
      return
    }

    const timer = window.setInterval(() => {
      setVisibleLength((current) => Math.min(latestLength.current, current + 2))
    }, 30)
    return () => window.clearInterval(timer)
  }, [streaming])

  return (
    <div className="msg-content markdown-content">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {characters.slice(0, visibleLength).join('')}
      </ReactMarkdown>
    </div>
  )
}

function greeting(): string {
  const h = new Date().getHours()
  if (h < 5) return '夜深了'
  if (h < 11) return '早上好'
  if (h < 13) return '中午好'
  if (h < 18) return '下午好'
  return '晚上好'
}

function formatTokenCount(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`
  return String(value)
}

export function ChatPanel({
  messages,
  userName,
  pending,
  isRunning,
  canStop,
  isStopping,
  onStop,
  streamingMessageId,
  contextUsage,
  promptContexts,
  canExportPromptContexts,
  onExportPromptContexts,
  projectLabel,
  projectPath,
  onChooseProject,
  approvalRequests,
  onRespondToApproval,
  onSend,
}: ChatPanelProps) {
  const [text, setText] = useState('')
  const [promptModalOpen, setPromptModalOpen] = useState(false)
  const [contextUsageModalOpen, setContextUsageModalOpen] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages, pending])

  const submit = () => {
    const t = text.trim()
    if (!t || pending) return
    onSend(t)
    setText('')
    if (taRef.current) taRef.current.style.height = 'auto'
  }

  const autoGrow = () => {
    const el = taRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }

  const hasHistoryBudget = Boolean(
    contextUsage &&
    typeof contextUsage.history_usage_ratio === 'number' &&
    contextUsage.history_budget_tokens,
  )
  const contextPercent = hasHistoryBudget
    ? Math.min(100, Math.round((contextUsage!.history_usage_ratio ?? 0) * 100))
    : 0
  const contextTitle = hasHistoryBudget
    ? `历史上下文 ${formatTokenCount(contextUsage!.history_tokens ?? 0)} / ${formatTokenCount(contextUsage!.history_budget_tokens ?? 0)} tokens${contextUsage!.estimated ? '（估算）' : ''}`
    : '尚无历史预算统计，发送消息后显示；点击查看完整请求用量'
  const contextRingClass = contextPercent >= 90
    ? 'context-ring critical'
    : contextPercent >= 75
      ? 'context-ring warning'
      : 'context-ring'

  const composer = (
    <div className="composer-wrap">
      <div className="composer">
        <textarea
          ref={taRef}
          rows={1}
          value={text}
          placeholder="给 MorphUI 发送消息…"
          onChange={(e) => {
            setText(e.target.value)
            autoGrow()
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              submit()
            }
          }}
        />
        <div className="composer-foot">
          <button className="icon-btn" title="附件（即将推出）" disabled>
            <PlusIcon size={17} />
          </button>
          <button
            className={`project-picker-trigger${projectPath ? ' selected' : ''}`}
            title={projectPath ?? '选择要交给智能体操作的项目文件夹'}
            onClick={onChooseProject}
            disabled={pending}
          >
            <FolderIcon size={15} />
            <span>{projectLabel}</span>
          </button>
          <div className="composer-actions">
            <button
              className={promptContexts.length > 0 ? 'icon-btn prompt-inspect-btn active' : 'icon-btn prompt-inspect-btn'}
              title="查看当前任务每轮发送给模型的上下文"
              aria-label="打开提示词可视化"
              aria-haspopup="dialog"
              aria-expanded={promptModalOpen}
              onClick={() => setPromptModalOpen(true)}
            >
              <SparkIcon size={15} />
            </button>
            {isRunning ? (
              <button
                className="send-btn stop-btn"
                title={isStopping ? '正在停止智能体…' : '停止智能体执行'}
                aria-label={isStopping ? '正在停止智能体' : '停止智能体执行'}
                onClick={onStop}
                disabled={!canStop || isStopping}
              >
                <StopIcon size={15} />
              </button>
            ) : (
              <button
                className="send-btn"
                title="发送（Enter）"
                aria-label="发送消息"
                onClick={submit}
                disabled={!text.trim() || pending}
              >
                <ArrowUpIcon size={16} />
              </button>
            )}
            <button
              className={contextRingClass}
              title={contextTitle}
              aria-label={contextTitle}
              onClick={() => setContextUsageModalOpen(true)}
            >
              <svg viewBox="0 0 32 32" aria-hidden="true">
                <circle className="context-ring-track" cx="16" cy="16" r="13" />
                <circle
                  className="context-ring-value"
                  cx="16"
                  cy="16"
                  r="13"
                  strokeDasharray={`${2 * Math.PI * 13}`}
                  strokeDashoffset={`${2 * Math.PI * 13 * (1 - contextPercent / 100)}`}
                />
              </svg>
              <span>{hasHistoryBudget ? `${contextPercent}%` : '—'}</span>
            </button>
          </div>
        </div>
      </div>
      <p className="disclaimer">MorphUI 处于早期阶段，可能会出错，请核查重要信息。</p>
    </div>
  )

  if (messages.length === 0 && !pending) {
    return (
      <section className="chat-panel">
        <div className="chat-empty">
          <SparkIcon size={44} className="empty-spark" />
          <h1>{greeting()}，{userName}</h1>
          <p>快速创建软件应用，并实时可视化展示</p>
        </div>
        {composer}
        <PromptContextModal
          open={promptModalOpen}
          snapshots={promptContexts}
          canExport={canExportPromptContexts}
          onClose={() => setPromptModalOpen(false)}
          onExport={onExportPromptContexts}
        />
        {contextUsageModalOpen && (
          <ContextUsageModal
            usage={contextUsage}
            onClose={() => setContextUsageModalOpen(false)}
          />
        )}
      </section>
    )
  }

  return (
    <section className="chat-panel">
      <div className="chat-scroll" ref={scrollRef}>
        <div className="chat-inner">
          {messages.filter((m) => m.content.length > 0).map((m) =>
            m.role === 'user' ? (
              <div className="msg-row user" key={m.id}>
                <div className="msg-user">{m.content}</div>
              </div>
            ) : (
              <div className="msg-row assistant" key={m.id}>
                <div className="spark-avatar">
                  <SparkIcon size={15} />
                </div>
                <AssistantMessage content={m.content} streaming={m.id === streamingMessageId} />
              </div>
            ),
          )}
          <ToolApprovalPanel requests={approvalRequests} onRespond={onRespondToApproval} />
          {pending && (
            <div className="msg-row assistant">
              <div className="spark-avatar">
                <SparkIcon size={15} />
              </div>
              <div className="dots">
                <span />
                <span />
                <span />
              </div>
            </div>
          )}
        </div>
      </div>
      {composer}
      <PromptContextModal
        open={promptModalOpen}
        snapshots={promptContexts}
        canExport={canExportPromptContexts}
        onClose={() => setPromptModalOpen(false)}
        onExport={onExportPromptContexts}
      />
      {contextUsageModalOpen && (
        <ContextUsageModal
          usage={contextUsage}
          onClose={() => setContextUsageModalOpen(false)}
        />
      )}
    </section>
  )
}
