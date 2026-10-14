import { useEffect, useRef, useState } from 'react'
import { api } from './api'
import type { AgentLogEntry, BackendStatus, ContextUsage, Conversation, Message, PromptContextSnapshot, ToolApprovalRequest, ToolApprovalResponse, UserInfo } from './types'
import { Sidebar } from './components/Sidebar'
import { ChatPanel } from './components/ChatPanel'
import { PreviewPanel } from './components/PreviewPanel'
import { AgentLogPanel } from './components/AgentLogPanel'
import { ProjectPicker } from './components/ProjectPicker'
import {
  ActivityLogIcon,
  ChevronDownIcon,
  MonitorIcon,
  MoonIcon,
  PanelLeftIcon,
  SparkIcon,
  SunIcon,
} from './components/icons'

let msgSeq = 0
const nextMsgId = () => `m-${Date.now().toString(36)}-${msgSeq++}`

function projectName(path: string): string {
  const parts = path.split(/[\\/]/).filter(Boolean)
  return parts[parts.length - 1] ?? path
}

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [agentLogOpen, setAgentLogOpen] = useState(false)
  const [previewUrl, setPreviewUrl] = useState('')
  const [theme, setTheme] = useState<'dark' | 'light'>(() =>
    localStorage.getItem('morphui-theme') === 'light' ? 'light' : 'dark',
  )
  const [backend, setBackend] = useState<BackendStatus>('checking')
  const [deviceId] = useState(() => api.deviceId())
  const [user, setUser] = useState<UserInfo | null>(null)

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [conversationLoadError, setConversationLoadError] = useState<string | null>(null)
  const [activeId, setActiveId] = useState<string>('new')
  const [selectedProjectPath, setSelectedProjectPath] = useState<string | null>(null)
  const [projectPickerOpen, setProjectPickerOpen] = useState(false)
  const [threads, setThreads] = useState<Record<string, Message[]>>({})
  const [threadLogs, setThreadLogs] = useState<Record<string, AgentLogEntry[]>>({})
  const [contextUsages, setContextUsages] = useState<Record<string, ContextUsage>>({})
  const [promptContexts, setPromptContexts] = useState<Record<string, PromptContextSnapshot[]>>({})
  const [taskStates, setTaskStates] = useState<Record<string, { task_id: string; status: string; goal: string }>>({})
  const [approvalRequests, setApprovalRequests] = useState<Record<string, ToolApprovalRequest[]>>({})
  const approvalSenders = useRef<Record<string, (response: ToolApprovalResponse) => boolean>>({})
  const stopSenders = useRef<Record<string, () => boolean>>({})
  const agentLogManuallyHidden = useRef(false)
  const [pending, setPending] = useState(false)
  const [pendingConversationId, setPendingConversationId] = useState<string | null>(null)
  const [stopReadyConversationId, setStopReadyConversationId] = useState<string | null>(null)
  const [stoppingConversationId, setStoppingConversationId] = useState<string | null>(null)

  useEffect(() => {
    document.documentElement.classList.toggle('light', theme === 'light')
    localStorage.setItem('morphui-theme', theme)
  }, [theme])

  // 最基本的前后端连接：轮询后端健康检查接口
  useEffect(() => {
    let cancelled = false
    const check = () =>
      api
        .health()
        .then(() => {
          if (!cancelled) setBackend('online')
        })
        .catch(() => {
          if (!cancelled) setBackend('offline')
        })
    check()
    const timer = setInterval(check, 15000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [])

  // 读取当前浏览器对应的持久化用户和数据库会话。
  useEffect(() => {
    let cancelled = false
    api
      .currentUser(deviceId)
      .then((currentUser) => {
        if (!cancelled) setUser(currentUser)
        return api.listConversations(deviceId)
      })
      .then((items) => {
        if (!cancelled) {
          setConversations(items)
          const restoredUsages: Record<string, ContextUsage> = {}
          for (const item of items) {
            if (item.context_usage) restoredUsages[item.id] = item.context_usage
          }
          setContextUsages((prev) => ({ ...restoredUsages, ...prev }))
          setConversationLoadError(null)
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setConversations([])
          setConversationLoadError(error instanceof Error ? '会话加载失败，请检查数据库连接' : '会话加载失败')
        }
      })
    return () => {
      cancelled = true
    }
  }, [deviceId])

  // 首次打开历史会话时，从数据库读取消息记录。
  useEffect(() => {
    if (activeId === 'new' || Object.prototype.hasOwnProperty.call(threads, activeId)) return
    let cancelled = false
    api
      .getConversation(activeId, deviceId)
      .then((conversation) => {
        if (!cancelled) {
          setThreads((prev) => ({ ...prev, [activeId]: conversation.messages }))
          if (conversation.context_usage) {
            setContextUsages((prev) => ({
              ...prev,
              [activeId]: conversation.context_usage!,
            }))
          }
        }
      })
      .catch(() => {
        if (!cancelled) setConversationLoadError('会话内容加载失败')
      })
    return () => {
      cancelled = true
    }
  }, [activeId, deviceId, threads])

  const updateThread = (id: string, updater: (msgs: Message[]) => Message[]) =>
    setThreads((prev) => ({ ...prev, [id]: updater(prev[id] ?? []) }))

  const handleApprovalResponse = (request: ToolApprovalRequest, approved: boolean) => {
    const sendResponse = approvalSenders.current[request.session_id]
    if (!sendResponse) {
      setApprovalRequests((prev) => ({
        ...prev,
        [request.session_id]: (prev[request.session_id] ?? []).map((item) =>
          item.request_id === request.request_id
            ? { ...item, response_error: '审批连接已关闭，请重新发送请求。' }
            : item,
        ),
      }))
      return
    }
    const sent = sendResponse({
      request_id: request.request_id,
      session_id: request.session_id,
      tool_call_id: request.tool_call_id,
      arguments_hash: request.arguments_hash,
      approved,
    })
    setApprovalRequests((prev) => ({
      ...prev,
      [request.session_id]: (prev[request.session_id] ?? []).map((item) =>
        item.request_id === request.request_id
          ? {
              ...item,
              responding: sent,
              response_error: sent ? undefined : '无法通过当前 WebSocket 发送审批响应。',
            }
          : item,
      ),
    }))
  }

  const handleStop = () => {
    if (!pendingConversationId) return
    const stop = stopSenders.current[pendingConversationId]
    if (!stop) return
    if (stop()) setStoppingConversationId(pendingConversationId)
  }

  const handleSend = async (text: string) => {
    if (!text.trim() || pending) return
    agentLogManuallyHidden.current = false
    setPending(true)
    const time = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    let convId = activeId
    if (convId === 'new') {
      try {
        const conversation = await api.createConversation(
          deviceId,
          text.trim().slice(0, 24),
          selectedProjectPath,
        )
        convId = conversation.id
        setConversations((prev) => [conversation, ...prev])
        setConversationLoadError(null)
      } catch {
        setConversationLoadError('创建会话失败，请检查 PostgreSQL 数据库连接')
        setPending(false)
        return
      }
      setActiveId(convId)
    }
    const assistantId = nextMsgId()
    setPromptContexts((prev) => ({ ...prev, [convId]: [] }))
    updateThread(convId, (msgs) => [
      ...msgs,
      { id: nextMsgId(), role: 'user', content: text, time },
      { id: assistantId, role: 'assistant', content: '', time },
    ])
    setPendingConversationId(convId)
    try {
      const res = await api.sendMessage(
        text,
        convId,
        deviceId,
        taskStates[convId]?.task_id ?? null,
        (event, respondToApproval) => {
          if (event.type === 'tool_approval_required') {
            const rawArguments = event.tool_arguments
            const safeArguments =
              typeof rawArguments === 'object' && rawArguments !== null && !Array.isArray(rawArguments)
                ? rawArguments as Record<string, unknown>
                : {}
            const risk = String(event.risk_level ?? 'HIGH').toUpperCase()
            const request: ToolApprovalRequest = {
              request_id: String(event.request_id ?? ''),
              session_id: String(event.session_id ?? convId),
              tool_call_id: String(event.tool_call_id ?? ''),
              tool_name: String(event.tool_name ?? '未知工具'),
              tool_arguments: safeArguments,
              arguments_hash: String(event.arguments_hash ?? ''),
              reason: String(event.reason ?? '该工具调用需要确认。'),
              rule_id: String(event.rule_id ?? ''),
              risk_level: risk === 'LOW' || risk === 'MEDIUM' ? risk : 'HIGH',
              expires_at: String(event.expires_at ?? ''),
            }
            approvalSenders.current[request.session_id] = respondToApproval
            setApprovalRequests((prev) => ({
              ...prev,
              [request.session_id]: [
                ...(prev[request.session_id] ?? []).filter((item) => item.request_id !== request.request_id),
                request,
              ],
            }))
          }
          if (event.type === 'tool_approval_response_ack') {
            const requestId = String(event.request_id ?? '')
            const accepted = event.accepted === true
            const message = String(event.message ?? '')
            setApprovalRequests((prev) => ({
              ...prev,
              [convId]: (prev[convId] ?? [])
                .map((item) => item.request_id === requestId
                  ? { ...item, responding: false, response_error: accepted ? undefined : message }
                  : item)
                .filter((item) => !accepted || item.request_id !== requestId),
            }))
          }
          if (event.type === 'tool_approval_result') {
            const requestId = String(event.request_id ?? '')
            setApprovalRequests((prev) => ({
              ...prev,
              [convId]: (prev[convId] ?? []).filter((item) => item.request_id !== requestId),
            }))
          }
          if (event.type === 'stop_ack' && event.accepted !== true) {
            setStoppingConversationId(null)
            const entry: AgentLogEntry = {
              id: nextMsgId(),
              time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
              level: 'error',
              message: String(event.message ?? '停止请求未能发送。'),
            }
            setThreadLogs((prev) => ({ ...prev, [convId]: [...(prev[convId] ?? []), entry].slice(-300) }))
            if (!agentLogManuallyHidden.current) setAgentLogOpen(true)
          }
          if (event.type === 'stopped') {
            const entry: AgentLogEntry = {
              id: nextMsgId(),
              time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
              level: 'warning',
              message: '已停止智能体执行，保留当前已生成内容。',
            }
            setThreadLogs((prev) => ({ ...prev, [convId]: [...(prev[convId] ?? []), entry].slice(-300) }))
            if (!agentLogManuallyHidden.current) setAgentLogOpen(true)
          }
          if (event.type === 'task_state') {
            const taskId = String(event.task_id ?? '')
            if (taskId) {
              setTaskStates((prev) => ({
                ...prev,
                [convId]: {
                  task_id: taskId,
                  status: String(event.status ?? 'active'),
                  goal: String(event.goal ?? ''),
                },
              }))
            }
          }
          if (event.type === 'context_usage') {
            const tokenBreakdown: Record<string, number> = {}
            if (
              typeof event.token_breakdown === 'object' &&
              event.token_breakdown !== null &&
              !Array.isArray(event.token_breakdown)
            ) {
              for (const [key, value] of Object.entries(event.token_breakdown)) {
                if (typeof value === 'number') tokenBreakdown[key] = value
              }
            }
            setContextUsages((prev) => ({
              ...prev,
              [convId]: {
                used_tokens: Number(event.used_tokens ?? 0),
                window_tokens: Number(event.window_tokens ?? 200000),
                estimated: event.estimated !== false,
                input_budget_tokens: Number(event.input_budget_tokens ?? 0),
                total_context_tokens: Number(event.total_context_tokens ?? event.used_tokens ?? 0),
                system_tokens: Number(event.system_tokens ?? 0),
                fixed_system_tokens: Number(event.fixed_system_tokens ?? 0),
                tool_tokens: Number(event.tool_tokens ?? 0),
                message_tokens: Number(event.message_tokens ?? 0),
                checkpoint_tokens: Number(event.checkpoint_tokens ?? 0),
                history_tokens: Number(event.history_tokens ?? 0),
                history_budget_tokens: Number(event.history_budget_tokens ?? 0),
                history_usage_ratio: Number(event.history_usage_ratio ?? 0),
                output_reserve_tokens: Number(event.output_reserve_tokens ?? 0),
                safety_margin_tokens: Number(event.safety_margin_tokens ?? 0),
                compacted: event.compacted === true,
                token_breakdown: tokenBreakdown,
                updated_at: typeof event.updated_at === 'string' ? event.updated_at : null,
              },
            }))
          }
          if (event.type === 'prompt_context') {
            const requestMessages = Array.isArray(event.messages) ? event.messages : []
            const systemMessage = requestMessages.find(
              (item) =>
                typeof item === 'object' &&
                item !== null &&
                'role' in item &&
                item.role === 'system',
            ) as { content?: unknown } | undefined
            const visibleMessages = systemMessage
              ? requestMessages.filter(
                  (item) =>
                    !(
                      typeof item === 'object' &&
                      item !== null &&
                      'role' in item &&
                      item.role === 'system'
                    ),
                )
              : requestMessages
            const snapshot: PromptContextSnapshot = {
              provider: String(event.provider ?? ''),
              model: String(event.model ?? ''),
              iteration: Number(event.iteration ?? 0),
              request_format: typeof event.request_format === 'string' ? event.request_format : undefined,
              purpose: typeof event.purpose === 'string' ? event.purpose : undefined,
              reason: typeof event.reason === 'string' ? event.reason : undefined,
              duration_ms: typeof event.duration_ms === 'number' ? event.duration_ms : undefined,
              system:
                typeof event.system === 'string'
                  ? event.system
                  : typeof systemMessage?.content === 'string'
                    ? systemMessage.content
                    : undefined,
              messages: visibleMessages,
              tools: Array.isArray(event.tools) ? event.tools : [],
            }
            setPromptContexts((prev) => ({
              ...prev,
              [convId]: [...(prev[convId] ?? []), snapshot],
            }))
          }
          if (
            event.type === 'checkpoint_compaction_complete' ||
            event.type === 'checkpoint_compaction_error'
          ) {
            const iteration = Number(event.iteration ?? 0)
            const reason = String(event.reason ?? '')
            const duration = Number(event.duration_ms ?? 0)
            setPromptContexts((prev) => {
              const snapshots = [...(prev[convId] ?? [])]
              for (let index = snapshots.length - 1; index >= 0; index -= 1) {
                const snapshot = snapshots[index]
                if (
                  snapshot.purpose === 'checkpoint_compaction' &&
                  snapshot.iteration === iteration &&
                  snapshot.reason === reason &&
                  snapshot.duration_ms === undefined
                ) {
                  snapshots[index] = { ...snapshot, duration_ms: duration }
                  break
                }
              }
              return { ...prev, [convId]: snapshots }
            })
          }
          if (event.type === 'preview_url') {
            const url = String(event.url ?? '')
            if (/^https?:\/\//i.test(url)) {
              setPreviewUrl(url)
              setPreviewOpen(true)
            }
          }
          if (event.type === 'activity_log') {
            const level = String(event.level ?? 'info')
            const safeLevel: AgentLogEntry['level'] =
              level === 'success' || level === 'warning' || level === 'error' ? level : 'info'
            const entry: AgentLogEntry = {
              id: nextMsgId(),
              time: String(event.time ?? ''),
              level: safeLevel,
              message: String(event.message ?? ''),
            }
            setThreadLogs((prev) => ({
              ...prev,
              [convId]: [...(prev[convId] ?? []), entry].slice(-300),
            }))
            if (!agentLogManuallyHidden.current) setAgentLogOpen(true)
          }
          if (event.type === 'text_delta') {
            const delta = String(event.delta ?? '')
            updateThread(convId, (msgs) =>
              msgs.map((msg) =>
                msg.id === assistantId ? { ...msg, content: msg.content + delta } : msg,
              ),
            )
          }
        },
        (stopGeneration) => {
          stopSenders.current[convId] = stopGeneration
          setStopReadyConversationId(convId)
        },
      )
      updateThread(convId, (msgs) =>
        msgs.map((msg) =>
          msg.id === assistantId ? { ...msg, content: res.reply } : msg,
        ),
      )
    } catch (error) {
      const reason = error instanceof Error ? error.message : '聊天连接发生错误。'
      updateThread(convId, (msgs) =>
        msgs.map((msg) =>
          msg.id === assistantId
            ? {
                ...msg,
                content: msg.content
                  ? `${msg.content}\n\n⚠️ ${reason}`
                  : `⚠️ ${reason}`,
              }
            : msg,
        ),
      )
    } finally {
      delete approvalSenders.current[convId]
      delete stopSenders.current[convId]
      setApprovalRequests((prev) => ({ ...prev, [convId]: [] }))
      setPending(false)
      setPendingConversationId(null)
      setStopReadyConversationId(null)
      setStoppingConversationId(null)
    }
  }

  const selectConversation = (id: string) => {
    setActiveId(id)
    setSelectedProjectPath(conversations.find((conversation) => conversation.id === id)?.project_path ?? null)
  }

  const startNewConversation = () => {
    setActiveId('new')
    setSelectedProjectPath(null)
  }

  const exportPromptContexts = () => {
    const snapshots = promptContexts[activeId] ?? []
    if (snapshots.length === 0) return

    const content = snapshots.map((snapshot, index) => [
      `==================== 模型请求 ${index + 1} ====================`,
      `服务商：${snapshot.provider || '未知'}`,
      `模型：${snapshot.model || '未知'}`,
      `任务内轮次：${snapshot.iteration}`,
      `用途：${snapshot.purpose === 'checkpoint_compaction' ? '生成历史 Checkpoint' : '普通模型请求'}`,
      ...(snapshot.reason ? [`Checkpoint 原因：${snapshot.reason}`] : []),
      `接口格式：${snapshot.request_format || '未知'}`,
      ...(snapshot.duration_ms !== undefined ? [`耗时：${snapshot.duration_ms} 毫秒`] : []),
      '',
      '-------------------- System --------------------',
      snapshot.system ?? '',
      '',
      '-------------------- Messages --------------------',
      JSON.stringify(snapshot.messages, null, 2) ?? '[]',
      '',
      '-------------------- Tools --------------------',
      JSON.stringify(snapshot.tools, null, 2) ?? '[]',
      '',
    ].join('\r\n')).join('\r\n')

    const file = new Blob([`\uFEFF${content}`], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(file)
    const link = window.document.createElement('a')
    const safeConversationId = activeId.replace(/[^\w.-]+/g, '_')
    link.href = url
    link.download = `morphui-prompts-${safeConversationId}-current-task.txt`
    window.document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
  }

  const openProjectPicker = () => {
    if (pending) return
    setProjectPickerOpen(true)
  }

  const activeMessages = threads[activeId] ?? []
  const activeTask = taskStates[activeId]
  const lastActiveMessage = activeMessages[activeMessages.length - 1]
  const streamingMessageId =
    pending && pendingConversationId === activeId && lastActiveMessage?.role === 'assistant'
      ? lastActiveMessage.id
      : null

  return (
    <div className="app">
      <Sidebar
        open={sidebarOpen}
        conversations={conversations}
        user={user}
        loadError={conversationLoadError}
        activeId={activeId}
        onSelect={selectConversation}
        onNewChat={startNewConversation}
      />
      <div className="main">
        <header className="topbar">
          <button
            className="icon-btn"
            title={sidebarOpen ? '收起侧栏' : '展开侧栏'}
            onClick={() => setSidebarOpen((o) => !o)}
          >
            <PanelLeftIcon />
          </button>
          <button className="model-chip" title="模型选择（占位）">
            <SparkIcon size={15} />
            <span>MorphUI Agent</span>
            <ChevronDownIcon size={14} className="chev" />
          </button>
          <div className="topbar-spacer" />
          {activeTask && (
            <div
              className={`task-status-pill ${activeTask.status}`}
              title={activeTask.goal || '当前任务状态'}
            >
              任务：{activeTask.status === 'completed'
                ? '已完成'
                : activeTask.status === 'interrupted' ? '已中断' : '进行中'}
            </div>
          )}
          <div className={`status-pill ${backend}`} title="后端连接状态（GET /api/health）">
            <span className="dot" />
            {backend === 'online' ? '后端已连接' : backend === 'checking' ? '连接中…' : '后端未连接'}
          </div>
          <button
            className={`icon-btn${previewOpen ? ' on' : ''}`}
            title="实时预览面板"
            onClick={() => setPreviewOpen((o) => !o)}
          >
            <MonitorIcon />
          </button>
          <button
            className={`icon-btn${agentLogOpen ? ' on' : ''}`}
            title={agentLogOpen ? '隐藏执行日志' : '显示执行日志'}
            onClick={() => setAgentLogOpen((open) => {
              const nextOpen = !open
              agentLogManuallyHidden.current = !nextOpen
              return nextOpen
            })}
          >
            <ActivityLogIcon />
          </button>
          <button
            className="icon-btn"
            title="切换深浅主题"
            onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
          >
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>
        </header>
        <div className="workspace">
          <div className="chat-area">
            <ChatPanel
              messages={threads[activeId] ?? []}
              userName={user?.display_name ?? '本地用户'}
              pending={pending}
              isRunning={pending && pendingConversationId === activeId}
              canStop={stopReadyConversationId === activeId}
              isStopping={stoppingConversationId === activeId}
              onStop={handleStop}
              streamingMessageId={streamingMessageId}
              contextUsage={contextUsages[activeId] ?? null}
              promptContexts={promptContexts[activeId] ?? []}
              canExportPromptContexts={(promptContexts[activeId] ?? []).length > 0}
              onExportPromptContexts={exportPromptContexts}
              projectPath={selectedProjectPath}
              projectLabel={activeId !== 'new'
                ? selectedProjectPath ? `项目：${projectName(selectedProjectPath)}` : '隔离工作区'
                : selectedProjectPath ? projectName(selectedProjectPath) : '选择项目'}
              onChooseProject={openProjectPicker}
              approvalRequests={approvalRequests[activeId] ?? []}
              onRespondToApproval={handleApprovalResponse}
              onSend={handleSend}
            />
            {agentLogOpen && (
              <AgentLogPanel
                entries={threadLogs[activeId] ?? []}
                running={pending && pendingConversationId === activeId}
                onClear={() => setThreadLogs((prev) => ({ ...prev, [activeId]: [] }))}
                onClose={() => {
                  agentLogManuallyHidden.current = true
                  setAgentLogOpen(false)
                }}
              />
            )}
          </div>
          {previewOpen && (
            <aside className="preview-column">
              <PreviewPanel
                url={previewUrl}
                onUrlChange={setPreviewUrl}
                onClose={() => setPreviewOpen(false)}
              />
            </aside>
          )}
        </div>
      </div>
      <ProjectPicker
        open={projectPickerOpen}
        onClose={() => setProjectPickerOpen(false)}
        onSelect={(path) => {
          setSelectedProjectPath(path)
          setActiveId('new')
          setProjectPickerOpen(false)
        }}
      />
    </div>
  )
}
