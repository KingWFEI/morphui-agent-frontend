import { useMemo, useState } from 'react'
import type { Conversation } from '../types'
import { PlusIcon, SearchIcon, SparkIcon } from './icons'

interface SidebarProps {
  open: boolean
  conversations: Conversation[]
  activeId: string
  onSelect: (id: string) => void
  onNewChat: () => void
}

const GROUP_ORDER = ['今天', '昨天', '过去 7 天', '过去 30 天', '更早']

function groupOf(iso: string): string {
  const t = new Date(iso).getTime()
  const startOfToday = new Date(new Date().setHours(0, 0, 0, 0)).getTime()
  const day = 86_400_000
  if (t >= startOfToday) return '今天'
  if (t >= startOfToday - day) return '昨天'
  if (t >= startOfToday - 7 * day) return '过去 7 天'
  if (t >= startOfToday - 30 * day) return '过去 30 天'
  return '更早'
}

export function Sidebar({ open, conversations, activeId, onSelect, onNewChat }: SidebarProps) {
  const [query, setQuery] = useState('')

  const groups = useMemo(() => {
    const kw = query.trim().toLowerCase()
    const filtered = conversations.filter((c) => c.title.toLowerCase().includes(kw))
    const map = new Map<string, Conversation[]>()
    for (const c of filtered) {
      const g = groupOf(c.updated_at)
      const arr = map.get(g) ?? []
      arr.push(c)
      map.set(g, arr)
    }
    return GROUP_ORDER.filter((g) => map.has(g)).map((g) => ({ label: g, items: map.get(g)! }))
  }, [conversations, query])

  return (
    <aside className={`sidebar${open ? '' : ' closed'}`}>
      <div className="sidebar-head">
        <div className="brand">
          <SparkIcon size={17} />
          <span>MorphUI</span>
        </div>
      </div>
      <button className="new-chat-btn" onClick={onNewChat}>
        <PlusIcon size={15} />
        新对话
      </button>
      <label className="search-box">
        <SearchIcon size={14} />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索对话…" />
      </label>
      <nav className="chat-list">
        {groups.length === 0 && <div className="group-label">没有匹配的对话</div>}
        {groups.map(({ label, items }) => (
          <div key={label}>
            <div className="group-label">{label}</div>
            {items.map((c) => (
              <button
                key={c.id}
                className={`chat-item${c.id === activeId ? ' active' : ''}`}
                onClick={() => onSelect(c.id)}
                title={c.title}
              >
                {c.title}
              </button>
            ))}
          </div>
        ))}
      </nav>
      <div className="sidebar-foot">
        <div className="user-chip">
          <div className="avatar">W</div>
          <div>
            <div className="name">wang</div>
            <div className="plan">MorphUI Pro</div>
          </div>
        </div>
      </div>
    </aside>
  )
}
