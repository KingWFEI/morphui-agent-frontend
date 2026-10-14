import type { ToolApprovalRequest } from '../types'

interface ToolApprovalPanelProps {
  requests: ToolApprovalRequest[]
  onRespond: (request: ToolApprovalRequest, approved: boolean) => void
}

function formatExpiry(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? '即将超时'
    : `截止 ${date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
}

export function ToolApprovalPanel({ requests, onRespond }: ToolApprovalPanelProps) {
  if (requests.length === 0) return null

  return (
    <div className="tool-approval-list" aria-live="polite">
      {requests.map((request) => (
        <section className="tool-approval-card" key={request.request_id}>
          <header className="tool-approval-head">
            <div>
              <p className="tool-approval-eyebrow">需要你的确认</p>
              <h3>{request.tool_name}</h3>
            </div>
            <span className={`tool-approval-risk risk-${request.risk_level.toLowerCase()}`}>
              {request.risk_level === 'HIGH' ? '高风险' : request.risk_level === 'MEDIUM' ? '中风险' : '低风险'}
            </span>
          </header>
          <p className="tool-approval-reason">{request.reason}</p>
          <details className="tool-approval-arguments" open>
            <summary>本次调用参数</summary>
            <pre>{JSON.stringify(request.tool_arguments, null, 2)}</pre>
          </details>
          <div className="tool-approval-foot">
            <span>{formatExpiry(request.expires_at)} · 仅对本次调用生效</span>
            <div className="tool-approval-actions">
              <button
                type="button"
                className="tool-approval-deny"
                disabled={request.responding}
                onClick={() => onRespond(request, false)}
              >
                拒绝
              </button>
              <button
                type="button"
                className="tool-approval-allow"
                disabled={request.responding}
                onClick={() => onRespond(request, true)}
              >
                {request.responding ? '正在提交…' : '批准本次调用'}
              </button>
            </div>
          </div>
          {request.response_error && <p className="tool-approval-error">{request.response_error}</p>}
        </section>
      ))}
    </div>
  )
}
