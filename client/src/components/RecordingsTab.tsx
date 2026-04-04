import { useEffect, useState } from 'react'
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
}

export function RecordingsTab({ onOpenLyrics }: Props) {
  const [recordings, setRecordings] = useState<Recording[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)
  // track which recordings have a transcript: name → true/false/undefined(unknown)
  const [hasTranscript, setHasTranscript] = useState<Record<string, boolean>>({})
  const [transcribing, setTranscribing] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    fetch('/api/recordings')
      .then(r => r.json())
      .then(d => {
        const recs: Recording[] = d.recordings || []
        setRecordings(recs)
        setLoading(false)
        // Check which ones already have transcripts
        recs.forEach(rec => {
          fetch(`/api/transcripts/${encodeURIComponent(rec.name)}`)
            .then(r => setHasTranscript(prev => ({ ...prev, [rec.name]: r.ok })))
            .catch(() => {})
        })
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleDelete = async (name: string) => {
    if (!confirm(`Delete "${name}"?`)) return
    setDeleting(name)
    await fetch(`/api/recordings/${encodeURIComponent(name)}`, { method: 'DELETE' })
    setDeleting(null)
    load()
  }

  const handleCopyLink = (name: string) => {
    const url = `${window.location.origin}/share/${encodeURIComponent(name)}`
    navigator.clipboard.writeText(url).then(() => {
      setCopied(name)
      setTimeout(() => setCopied(null), 2000)
    })
  }

  const handleDownload = (name: string) => {
    const a = document.createElement('a')
    a.href = `/api/recordings/${encodeURIComponent(name)}`
    a.download = name.replace('.webm', '.webm')
    a.click()
  }

  const handleTranscribe = async (name: string) => {
    setTranscribing(name)
    try {
      const res = await fetch(`/api/transcripts/${encodeURIComponent(name)}`, { method: 'POST' })
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
        <span style={{fontSize:13, color:'var(--text-muted)'}}>
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
        <div key={rec.name} className="rec-row">
          <span style={{fontSize:18, flexShrink:0}}>🎙</span>
          <div className="rec-row-name" title={rec.name}>{rec.name}</div>
          <span className="rec-row-size">{fmtBytes(rec.size)}</span>
          <span style={{fontSize:11, color:'var(--text-muted)', flexShrink:0}}>
            {fmtDate(rec.createdAt)}
          </span>
          <div className="rec-row-actions">
            {/* Inline playback */}
            <audio
              controls
              src={`/api/recordings/${encodeURIComponent(rec.name)}`}
              style={{height:28, accentColor:'var(--accent)', maxWidth:180}}
            />
            {/* Share link */}
            <button
              className="btn btn-ghost btn-sm"
              title="Copy shareable link"
              onClick={() => handleCopyLink(rec.name)}
              style={copied === rec.name ? { color: 'var(--green, #9ece6a)' } : undefined}
            >
              {copied === rec.name ? '✓ Copied' : '🔗'}
            </button>
            {/* Transcript: show Transcribe button if none, Lyrics button if exists */}
            {transcribing === rec.name ? (
              <button className="btn btn-ghost btn-sm" disabled>⏳ Transcribing…</button>
            ) : hasTranscript[rec.name] ? (
              <button
                className="btn btn-ghost btn-sm"
                title="View word-timed lyrics"
                onClick={() => onOpenLyrics(rec.name)}
              >
                🎤 Lyrics
              </button>
            ) : (
              <button
                className="btn btn-ghost btn-sm"
                title="Transcribe with Deepgram"
                onClick={() => handleTranscribe(rec.name)}
              >
                ✦ Transcribe
              </button>
            )}
            <button
              className="btn btn-ghost btn-sm"
              title="Download"
              onClick={() => handleDownload(rec.name)}
            >
              ⬇
            </button>
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
