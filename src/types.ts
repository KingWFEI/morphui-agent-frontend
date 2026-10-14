/**
 * 前端数据类型定义（与后端接口的返回结构一一对应）
 */

/** 历史会话（左侧侧栏列表项），对应 GET /api/conversations 的数组元素 */
export interface Conversation {
  id: string // 会话唯一标识
  title: string // 会话标题（通常取首条消息截断）
  updated_at: string // 最后更新时间（ISO 8601 字符串），侧栏按它做时间分组
  project_path?: string | null // 与会话绑定的项目目录；为空时使用隔离工作区
  context_usage?: ContextUsage | null // 最近一次模型请求的上下文用量
}

/** 当前浏览器对应的本地用户信息。 */
export interface UserInfo {
  id: string
  display_name: string
}

/** 聊天消息（聊天区的一行，用户或助手） */
export interface Message {
  id: string // 消息唯一标识（前端本地生成，用于 React key）
  role: 'user' | 'assistant' // 发送方：用户消息（右侧气泡）/ 助手消息（左侧带头像）
  content: string // 消息文本内容（支持换行，渲染时 pre-wrap）
  time: string // 显示用时间（HH:mm）
}

/** 智能体执行日志，由后端通过 WebSocket 实时推送 */
export interface AgentLogEntry {
  id: string
  time: string
  level: 'info' | 'success' | 'warning' | 'error'
  message: string
}

/** 等待当前用户对一次高风险工具调用作出的审批请求。 */
export interface ToolApprovalRequest {
  request_id: string
  session_id: string
  tool_call_id: string
  tool_name: string
  tool_arguments: Record<string, unknown>
  arguments_hash: string
  reason: string
  rule_id: string
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH'
  expires_at: string
  responding?: boolean
  response_error?: string
}

/** 回传给后端的一次性审批决定。 */
export interface ToolApprovalResponse {
  request_id: string
  session_id: string
  tool_call_id: string
  arguments_hash: string
  approved: boolean
}

/** 智能体本轮上下文窗口占用估算。 */
export interface ContextUsage {
  used_tokens: number
  window_tokens: number
  estimated: boolean
  input_budget_tokens?: number
  total_context_tokens?: number
  system_tokens?: number
  fixed_system_tokens?: number
  tool_tokens?: number
  message_tokens?: number
  checkpoint_tokens?: number
  history_tokens?: number
  history_budget_tokens?: number
  history_usage_ratio?: number
  output_reserve_tokens?: number
  safety_margin_tokens?: number
  compacted?: boolean
  token_breakdown?: Record<string, number>
  updated_at?: string | null
}

/** 单轮模型调用前实际提交的上下文快照。 */
export interface PromptContextSnapshot {
  provider: string
  model: string
  iteration: number
  request_format?: string
  purpose?: string
  reason?: string
  duration_ms?: number
  system?: string
  messages: unknown[]
  tools: unknown[]
}

/** 后端连接状态：checking 检测中 / online 已连接 / offline 未连接 */
export type BackendStatus = 'checking' | 'online' | 'offline'
