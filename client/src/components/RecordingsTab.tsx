import { useEffect, useRef, useState } from 'react'
import { fmtBytes } from '../hooks/useAudio'

interface Recording {
  name: string
  size: number
  createdAt: string
}

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleString()
  } catch { return iso }
}

interface Props {
  onOpenLyrics: (filename: string) => void
  apiFetch: (input: RequestInfo, init?: RequestInit) => Promise<Response>
}

export function RecordingsTab({ onOpenLyrics, apiFetch }: Props) {
  const [recordings, setRecordings] = useState<Recording[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [hasTranscript, setHasTranscript] = useState<Record<string, boolean>>({})
  const [transcribing, setTranscribing] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  // Inline rename state
  const [editingName, setEditingName] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [renaming, setRenaming] = useState<string | null>(null)
  const [renameError, setRenameError] = useState<string | null>(null)
  const editInputRef = useRef<HTMLInputElement>(null)

  // Blob URLs — loaded on demand when user clicks play
  const [audioBlobUrls, setAudioBlobUrls] = useState<Record<string, string>>({})
  const [loadingAudio, setLoadingAudio] = useState<Record<string, boolean>>({})
  const blobUrlsRef = useRef<Record<string, string>>({})

  const load = () => {
    setLoading(true)
    apiFetch('/api/recordings')
      .then(r => r.json())
      .then(d => {
        const recs: Recording[] = d.recordings || []
        setRecordings(recs)
        setLoading(false)
        recs.forEach(rec => {
          apiFetch(`/api/transcripts/${encodeURIComponent(rec.name)}`)
            .then(r => setHasTranscript(prev => ({ ...prev, [rec.name]: r.ok })))
            .catch(() => {})
        })
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    load()
    return () => {
      Object.values(blobUrlsRef.current).forEach(URL.revokeObjectURL)
    }
  }, [])

  // Focus input when editing starts
  useEffect(() => {
    if (editingName) editInputRef.current?.focus()
  }, [editingName])

  const handlePlay = async (name: string) => {
    if (audioBlobUrls[name]) return
    setLoadingAudio(prev => ({ ...prev, [name]: true }))
    try {
      const res = await apiFetch(`/api/recordings/${encodeURIComponent(name)}`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      blobUrlsRef.current[name] = url
      setAudioBlobUrls(prev => ({ ...prev, [name]: url }))
    } catch {}
    setLoadingAudio(prev => ({ ...prev, [name]: false }))
  }

  const handleDelete = async (name: string) => {
    if (!confirm(`Delete "${name}"?`)) return
    setDeleting(name)
    await apiFetch(`/api/recordings/${encodeURIComponent(name)}`, { method: 'DELETE' })
    if (blobUrlsRef.current[name]) {
      URL.revokeObjectURL(blobUrlsRef.current[name])
      delete blobUrlsRef.current[name]
      setAudioBlobUrls(prev => { const n = { ...prev }; delete n[name]; return n })
    }
    setDeleting(null)
    load()
  }

  const startEdit = (name: string) => {
    // Strip extension for the input value
    const base = name.replace(/\.(webm|mp4|mp3|wav)$/i, '')
    setEditValue(base)
    setEditingName(name)
    setRenameError(null)
  }

  const cancelEdit = () => {
    setEditingName(null)
    setEditValue('')
    setRenameError(null)
  }

  const commitRename = async (oldName: string) => {
    const trimmed = editValue.trim()
    if (!trimmed) { cancelEdit(); return }

    // If name didn't change (ignoring extension), no-op
    const oldBase = oldName.replace(/\.(webm|mp4|mp3|wav)$/i, '')
    if (trimmed === oldBase) { cancelEdit(); return }

    setRenaming(oldName)
    setRenameError(null)
    try {
      const res = await apiFetch(`/api/recordings/${encodeURIComponent(oldName)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      })
      const data = await res.json()
      if (data.ok) {
        // Revoke old blob URL if loaded — new name will need a fresh fetch
        if (blobUrlsRef.current[oldName]) {
          URL.revokeObjectURL(blobUrlsRef.current[oldName])
          delete blobUrlsRef.current[oldName]
          setAudioBlobUrls(prev => { const n = { ...prev }; delete n[oldName]; return n })
        }
        setEditingName(null)
        setEditValue('')
        load()
      } else {
        setRenameError(data.error ?? 'Rename failed')
      }
    } catch {
      setRenameError('Rename failed')
    }
    setRenaming(null)
  }

  const handleCopyLink = (name: string) => {
    const url = `${window.location.origin}/share/${encodeURIComponent(name)}`
    navigator.clipboard.writeText(url).then(() => {
      setCopied(name)
      setTimeout(() => setCopied(null), 2000)
    })
  }

  const handleDownload = async (name: string) => {
    const res = await apiFetch(`/api/recordings/${encodeURIComponent(name)}`)
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleTranscribe = async (name: string) => {
    setTranscribing(name)
    try {
      const res = await apiFetch(`/api/transcripts/${encodeURIComponent(name)}`, { method: 'POST' })
      const data = await res.json()
      if (!data.error) {
        setHasTranscript(prev => ({ ...prev, [name]: true }))
        onOpenLyrics(name)
      }
    } catch {}
    setTranscribing(null)
  }

  return (
    <div>
      <div className="toolbar">
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          {recordings.length} recording{recordings.length !== 1 ? 's' : ''} saved
        </span>
        <div className="toolbar-right">
          <button className="btn btn-ghost btn-sm" onClick={load}>↻ Refresh</button>
        </div>
      </div>

      {loading && <div className="empty">Loading…</div>}

      {!loading && recordings.length === 0 && (
        <div className="empty">
          No recordings yet. Go to the Studio tab to record your first session.
        </div>
      )}

      {recordings.map(rec => (
        <div key={rec.name} className="rec-row" style={{ flexWrap: 'wrap', gap: 8 }}>
          <span style={{ fontSize: 18, flexShrink: 0 }}>🎙</span>

          {/* Name — inline editable */}
          {editingName === rec.name ? (
            <div style={{ flex: 1, minWidth: 160, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input
                  ref={editInputRef}
                  style={{
                    flex: 1, background: 'var(--bg)', border: '1px solid var(--accent)',
                    borderRadius: 'var(--radius)', color: 'var(--text)',
                    fontSize: 13, fontFamily: 'var(--font)', padding: '4px 8px', outline: 'none',
                    boxShadow: '0 0 0 2px color-mix(in srgb, var(--accent) 15%, transparent)',
                  }}
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') commitRename(rec.name)
                    if (e.key === 'Escape') cancelEdit()
                  }}
                  disabled={renaming === rec.name}
                />
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => commitRename(rec.name)}
                  disabled={renaming === rec.name}
                >
                  {renaming === rec.name ? '…' : '✓'}
                </button>
                <button className="btn btn-ghost btn-sm" onClick={cancelEdit} disabled={renaming === rec.name}>
                  ✕
                </button>
              </div>
              {renameError && (
                <span style={{ fontSize: 11, color: 'var(--danger)' }}>{renameError}</span>
              )}
            </div>
          ) : (
            <div
              className="rec-row-name"
              title={`${rec.name} — click pencil to rename`}
            >
              {rec.name}
            </div>
          )}

          {editingName !== rec.name && (
            <>
              <span className="rec-row-size">{fmtBytes(rec.size)}</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
                {fmtDate(rec.createdAt)}
              </span>
            </>
          )}

          <div className="rec-row-actions">
            {/* Play */}
            {audioBlobUrls[rec.name] ? (
              <audio
                controls
                autoPlay
                src={audioBlobUrls[rec.name]}
                style={{ height: 28, accentColor: 'var(--accent)', maxWidth: 180 }}
              />
            ) : (
              <button
                className="btn btn-ghost btn-sm"
                title="Play"
                onClick={() => handlePlay(rec.name)}
                disabled={loadingAudio[rec.name]}
              >
                {loadingAudio[rec.name] ? '⏳' : '▶'}
              </button>
            )}
            {/* Rename */}
            {editingName !== rec.name && (
              <button
                className="btn btn-ghost btn-sm"
                title="Rename"
                onClick={() => startEdit(rec.name)}
              >
                ✏
              </button>
            )}
            {/* Share */}
            <button
              className="btn btn-ghost btn-sm"
              title="Copy shareable link"
              onClick={() => handleCopyLink(rec.name)}
              style={copied === rec.name ? { color: 'var(--success)' } : undefined}
            >
              {copied === rec.name ? '✓' : '🔗'}
            </button>
            {/* Transcript */}
            {transcribing === rec.name ? (
              <button className="btn btn-ghost btn-sm" disabled>⏳</button>
            ) : hasTranscript[rec.name] ? (
              <button
                className="btn btn-ghost btn-sm"
                title="View lyrics"
                onClick={() => onOpenLyrics(rec.name)}
              >
                🎤
              </button>
            ) : (
              <button
                className="btn btn-ghost btn-sm"
                title="Transcribe"
                onClick={() => handleTranscribe(rec.name)}
              >
                ✦
              </button>
            )}
            {/* Download */}
            <button
              className="btn btn-ghost btn-sm"
              title="Download"
              onClick={() => handleDownload(rec.name)}
            >
              ⬇
            </button>
            {/* Delete */}
            <button
              className="btn btn-danger btn-sm"
              title="Delete"
              disabled={deleting === rec.name}
              onClick={() => handleDelete(rec.name)}
            >
              {deleting === rec.name ? '…' : '🗑'}
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
