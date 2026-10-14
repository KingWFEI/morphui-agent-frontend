import type { ContextUsage } from '../types'
import { XIcon } from './icons'

interface ContextUsageModalProps {
  usage: ContextUsage | null
  onClose: () => void
}

const CONTEXT_PARTS = [
  { key: 'base_system_prompt', label: '项目基础 System Prompt', isHistory: false },
  { key: 'task_checkpoint', label: 'Task Checkpoint', isHistory: true },
  { key: 'session_checkpoint', label: 'Session Checkpoint', isHistory: true },
  { key: 'runtime_state', label: 'Runtime State', isHistory: false },
  { key: 'messages', label: 'Messages（含工具调用与结果）', isHistory: true },
  { key: 'tools', label: 'Tool Definitions', isHistory: false },
] as const

function formatTokenCount(value: number): string {
  return new Intl.NumberFormat('zh-CN').format(value)
}

export function ContextUsageModal({ usage, onClose }: ContextUsageModalProps) {
  const breakdown = usage?.token_breakdown
  const total = Math.max(0, usage?.total_context_tokens ?? usage?.used_tokens ?? 0)
  const windowSize = Math.max(1, usage?.window_tokens ?? 1)
  const historyTokens = Math.max(0, usage?.history_tokens ?? 0)
  const historyBudget = Math.max(0, usage?.history_budget_tokens ?? 0)
  const historyPercent = usage?.history_usage_ratio == null
    ? null
    : usage.history_usage_ratio * 100
  const hasHistoryBudget = historyBudget > 0 && historyPercent !== null
  const hasBreakdown = breakdown && Object.values(breakdown).some((value) => value > 0)
  const updatedAt = usage?.updated_at
    ? new Date(usage.updated_at).toLocaleString('zh-CN')
    : null
  const systemTokens = Math.max(0, usage?.system_tokens ?? 0)
  const checkpointTokens = Math.max(0, usage?.checkpoint_tokens ?? 0)
  const fixedSystemTokens = Math.max(
    0,
    usage?.fixed_system_tokens ?? systemTokens - checkpointTokens,
  )

  return (
    <div
      className="prompt-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        className="prompt-modal context-usage-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="context-usage-title"
      >
        <header className="prompt-modal-head">
          <div className="prompt-modal-heading">
            <h2 id="context-usage-title">上下文预算用量</h2>
            {usage ? (
              <p>
                最近一次请求完整上下文约 {formatTokenCount(total)} / {formatTokenCount(windowSize)} tokens
                {usage.estimated ? '（估算）' : ''}
              </p>
            ) : (
              <p>当前会话还没有可显示的上下文用量。</p>
            )}
            {updatedAt && <p>更新时间：{updatedAt}</p>}
          </div>
          <button className="icon-btn" title="关闭" aria-label="关闭上下文用量窗口" onClick={onClose}>
            <XIcon />
          </button>
        </header>

        {usage && (
          <div className="context-usage-summary">
            <div>
              <strong>{hasHistoryBudget ? `${historyPercent!.toFixed(1)}%` : '—'}</strong>
              <span>Messages + Checkpoint / 历史可用预算</span>
            </div>
            <div>
              <strong>
                {formatTokenCount(historyTokens)} / {historyBudget > 0 ? formatTokenCount(historyBudget) : '—'}
              </strong>
              <span>当前历史用量 / 可用预算 tokens</span>
            </div>
            <div>
              <strong>
                {formatTokenCount(total)} / {formatTokenCount(usage.input_budget_tokens ?? 0)}
              </strong>
              <span>完整请求 / 扣除输出与安全余量后的输入上限</span>
            </div>
            {usage.compacted && <span className="context-compacted-badge">本次请求触发过压缩</span>}
          </div>
        )}

        {usage && (
          <div className="context-usage-summary">
            <div>
              <strong>{formatTokenCount(fixedSystemTokens)}</strong>
              <span>固定 System 开销 tokens</span>
            </div>
            <div>
              <strong>{formatTokenCount(usage.tool_tokens ?? 0)}</strong>
              <span>Tools tokens</span>
            </div>
            <div>
              <strong>{formatTokenCount(usage.output_reserve_tokens ?? 0)}</strong>
              <span>输出预留 tokens</span>
            </div>
            <div>
              <strong>{formatTokenCount(usage.safety_margin_tokens ?? 0)}</strong>
              <span>安全余量 tokens</span>
            </div>
          </div>
        )}

        {hasBreakdown ? (
          <div className="context-breakdown-list">
            {CONTEXT_PARTS.map((part) => {
              const tokens = Math.max(0, breakdown?.[part.key] ?? 0)
              const shareOfRequest = total > 0 ? (tokens / total) * 100 : 0
              const shareOfHistory = historyTokens > 0 && part.isHistory
                ? (tokens / historyTokens) * 100
                : null
              return (
                <div className="context-breakdown-row" key={part.key}>
                  <div className="context-breakdown-label">
                    <span>{part.label}</span>
                    <span>
                      {formatTokenCount(tokens)} tokens · {shareOfRequest.toFixed(1)}% 完整请求
                      {shareOfHistory !== null ? ` · ${shareOfHistory.toFixed(1)}% 历史用量` : ''}
                    </span>
                  </div>
                  <div className="context-breakdown-track">
                    <div
                      className="context-breakdown-value"
                      style={{ width: Math.min(100, shareOfRequest) + '%' }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="context-usage-empty">
            {usage
              ? '这个会话还没有保存分项用量。发送一条消息后，系统会记录该会话最近一次模型请求的分项数据。'
              : '发送一条消息并完成上下文构建后，这里会显示历史预算和完整请求用量。'}
          </div>
        )}
        {usage && (
          <footer className="context-usage-foot">
            历史用量由 Messages（包括工具调用与工具结果）和 Checkpoint 组成。Checkpoint 虽注入 System Prompt，预算统计时仍归入历史；固定 System、Tools、输出预留及安全余量从历史可用预算中扣除。各 Token 数为估算值。
          </footer>
        )}
      </section>
    </div>
  )
}
