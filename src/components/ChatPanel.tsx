import { useEffect, useRef, useState } from 'react'
import type { Message } from '../types'
import { ArrowUpIcon, PlusIcon, SparkIcon } from './icons'

interface ChatPanelProps {
  messages: Message[]
  pending: boolean
  onSend: (text: string) => void
}

function greeting(): string {
  const h = new Date().getHours()
  if (h < 5) return '夜深了'
  if (h < 11) return '早上好'
  if (h < 13) return '中午好'
  if (h < 18) return '下午好'
  return '晚上好'
}

export function ChatPanel({ messages, pending, onSend }: ChatPanelProps) {
  const [text, setText] = useState('')
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
            className="send-btn"
            title="发送（Enter）"
            onClick={submit}
            disabled={!text.trim() || pending}
          >
            <ArrowUpIcon size={16} />
          </button>
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
          <h1>{greeting()}，wang</h1>
          <p>项目构建助手 · 生成结果将在右侧「实时预览」区域呈现</p>
        </div>
        {composer}
      </section>
    )
  }

  return (
    <section className="chat-panel">
      <div className="chat-scroll" ref={scrollRef}>
        <div className="chat-inner">
          {messages.map((m) =>
            m.role === 'user' ? (
              <div className="msg-row user" key={m.id}>
                <div className="msg-user">{m.content}</div>
              </div>
            ) : (
              <div className="msg-row assistant" key={m.id}>
                <div className="spark-avatar">
                  <SparkIcon size={15} />
                </div>
                <div className="msg-content">{m.content}</div>
              </div>
            ),
          )}
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
    </section>
  )
}
