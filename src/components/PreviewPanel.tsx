import { useEffect, useState } from 'react'
import { ExternalLinkIcon, RefreshIcon, XIcon } from './icons'

interface PreviewPanelProps {
  url: string
  onUrlChange: (url: string) => void
  onClose: () => void
}

export function PreviewPanel({ url, onUrlChange, onClose }: PreviewPanelProps) {
  const [draft, setDraft] = useState(url)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => setDraft(url), [url])

  const commit = () => {
    let u = draft.trim()
    if (!u) {
      setDraft(url)
      return
    }
    if (!/^https?:\/\//i.test(u)) u = `http://${u}`
    setDraft(u)
    if (u !== url) onUrlChange(u)
  }

  return (
    <section className="preview-panel">
      <header className="preview-head">
        <span className="preview-title">实时预览</span>
        <input
          className="preview-url"
          value={draft}
          spellCheck={false}
          title="要预览的地址（Enter 确认）"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
          }}
        />
        <button className="icon-btn" title="刷新" onClick={() => setReloadKey((k) => k + 1)}>
          <RefreshIcon size={15} />
        </button>
        <button className="icon-btn" title="在新窗口打开" onClick={() => window.open(url, '_blank')}>
          <ExternalLinkIcon size={15} />
        </button>
        <button className="icon-btn" title="关闭预览" onClick={onClose}>
          <XIcon size={16} />
        </button>
      </header>
      <iframe key={reloadKey} className="preview-frame" src={url} title="MorphUI 实时预览" />
    </section>
  )
}
