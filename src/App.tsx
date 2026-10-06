import { useEffect, useState } from 'react'
import { api } from './api'
import type { BackendStatus, Conversation, Message } from './types'
import { Sidebar } from './components/Sidebar'
import { ChatPanel } from './components/ChatPanel'
import { PreviewPanel } from './components/PreviewPanel'
import {
  ChevronDownIcon,
  MonitorIcon,
  MoonIcon,
  PanelLeftIcon,
  SparkIcon,
  SunIcon,
} from './components/icons'

const DEFAULT_PREVIEW_URL = 'http://127.0.0.1:8000/preview'

let msgSeq = 0
const nextMsgId = () => `m-${Date.now().toString(36)}-${msgSeq++}`

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [previewOpen, setPreviewOpen] = useState(true)
  const [previewUrl, setPreviewUrl] = useState(DEFAULT_PREVIEW_URL)
  const [theme, setTheme] = useState<'dark' | 'light'>(() =>
    localStorage.getItem('morphui-theme') === 'light' ? 'light' : 'dark',
  )
  const [backend, setBackend] = useState<BackendStatus>('checking')

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeId, setActiveId] = useState<string>('new')
  const [threads, setThreads] = useState<Record<string, Message[]>>({})
  const [pending, setPending] = useState(false)

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

  // 拉取历史会话（后端不可用时回退到本地示例，保证页面可用）
  useEffect(() => {
    api
      .listConversations()
      .then(setConversations)
      .catch(() =>
        setConversations([
          {
            id: 'local-1',
            title: '本地示例：MorphUI 界面布局',
            updated_at: new Date().toISOString(),
          },
        ]),
      )
  }, [])

  const updateThread = (id: string, updater: (msgs: Message[]) => Message[]) =>
    setThreads((prev) => ({ ...prev, [id]: updater(prev[id] ?? []) }))

  const handleSend = async (text: string) => {
    if (!text.trim() || pending) return
    const time = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    let convId = activeId
    if (convId === 'new') {
      convId = `conv-${Date.now().toString(36)}`
      const title = text.slice(0, 24)
      setConversations((prev) => [{ id: convId, title, updated_at: new Date().toISOString() }, ...prev])
      setActiveId(convId)
    }
    updateThread(convId, (msgs) => [
      ...msgs,
      { id: nextMsgId(), role: 'user', content: text, time },
    ])
    setPending(true)
    try {
      const res = await api.sendMessage(text, convId)
      updateThread(convId, (msgs) => [
        ...msgs,
        { id: nextMsgId(), role: 'assistant', content: res.reply, time },
      ])
    } catch {
      updateThread(convId, (msgs) => [
        ...msgs,
        {
          id: nextMsgId(),
          role: 'assistant',
          content:
            '⚠️ 无法连接后端服务。请确认 FastAPI 已启动：uvicorn app.main:app --host 127.0.0.1 --port 8000',
          time,
        },
      ])
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="app">
      <Sidebar
        open={sidebarOpen}
        conversations={conversations}
        activeId={activeId}
        onSelect={setActiveId}
        onNewChat={() => setActiveId('new')}
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
            className="icon-btn"
            title="切换深浅主题"
            onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
          >
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>
        </header>
        <div className="workspace">
          <ChatPanel messages={threads[activeId] ?? []} pending={pending} onSend={handleSend} />
          {previewOpen && (
            <PreviewPanel
              url={previewUrl}
              onUrlChange={setPreviewUrl}
              onClose={() => setPreviewOpen(false)}
            />
          )}
        </div>
      </div>
    </div>
  )
}
