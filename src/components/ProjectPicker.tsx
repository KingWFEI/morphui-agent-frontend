import { useEffect, useState } from 'react'
import { api, type ProjectBrowseResult } from '../api'
import { ChevronDownIcon, XIcon } from './icons'

interface ProjectPickerProps {
  open: boolean
  onClose: () => void
  onSelect: (path: string | null) => void
}

export function ProjectPicker({ open, onClose, onSelect }: ProjectPickerProps) {
  const [browse, setBrowse] = useState<ProjectBrowseResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const navigate = async (path?: string) => {
    setLoading(true)
    setError(null)
    try {
      setBrowse(await api.browseProjects(path))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '读取文件夹失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) void navigate()
  }, [open])

  if (!open) return null

  return (
    <div className="project-picker-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <section className="project-picker" role="dialog" aria-modal="true" aria-labelledby="project-picker-title">
        <header className="project-picker-head">
          <div>
            <h2 id="project-picker-title">选择项目文件夹</h2>
            <p>只能浏览后端允许访问的目录</p>
          </div>
          <button className="icon-btn" title="关闭" onClick={onClose}><XIcon /></button>
        </header>

        <div className="project-picker-location">
          {browse?.parent_path ? (
            <button className="project-picker-back" onClick={() => void navigate(browse.parent_path ?? undefined)}>
              <ChevronDownIcon size={14} className="project-picker-back-icon" />
              上一级
            </button>
          ) : null}
          <span title={browse?.current_path ?? ''}>{browse?.current_path ?? '允许访问的目录'}</span>
        </div>

        <div className="project-picker-list">
          {loading && <div className="project-picker-empty">正在读取文件夹…</div>}
          {!loading && error && <div className="project-picker-error">{error}</div>}
          {!loading && !error && browse?.directories.length === 0 && (
            <div className="project-picker-empty">
              {browse.current_path
                ? '此文件夹下没有子文件夹'
                : '未配置可选项目目录，请设置 MORPHUI_ALLOWED_PROJECT_ROOTS'}
            </div>
          )}
          {!loading && !error && browse?.directories.map((directory) => (
            <button
              className="project-picker-item"
              key={directory.path}
              onClick={() => void navigate(directory.path)}
              title={directory.path}
            >
              <span className="project-folder-icon">▰</span>
              <span>{directory.name}</span>
              <span className="project-folder-path">{directory.path}</span>
            </button>
          ))}
        </div>

        <footer className="project-picker-foot">
          <button className="project-picker-secondary" onClick={() => onSelect(null)}>
            使用隔离工作区
          </button>
          <button
            className="project-picker-primary"
            disabled={!browse?.current_path || loading || Boolean(error)}
            onClick={() => browse?.current_path && onSelect(browse.current_path)}
          >
            选择此文件夹
          </button>
        </footer>
      </section>
    </div>
  )
}
