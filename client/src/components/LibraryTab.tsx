import { useEffect, useRef, useState } from 'react'
import { useAudioPlayer, fmt } from '../hooks/useAudio'

interface Track {
  id: string      // 'folder/file.mp3' or 'file.mp3'
  folder: string  // '' for root-level
  name: string    // just the filename
}

interface Props {
  selectedTrack: string | null
  onSelect: (id: string) => void
}

function cleanName(filename: string) {
  return filename
    .replace(/\.mp3$/i, '')
    .replace(/_\d+$/, '')
    .replace(/_/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

function folderLabel(folder: string) {
  if (!folder) return 'General'
  return folder.charAt(0).toUpperCase() + folder.slice(1)
}

const FOLDER_EMOJI: Record<string, string> = {
  scripture_reading: '📖',
  Jesus: '✝️',
  calm: '🌿',
  brave: '⚔️',
  classical: '🎻',
  jazz: '🎷',
  hiphop: '🎤',
  party: '🎉',
  Dance: '💃',
  family: '👨‍👩‍👧',
  encourage: '🌟',
  business: '💼',
  good: '✨',
  nice: '🎶',
  filler: '🔹',
  generic: '🎵',
  drumbs: '🥁',
}

export function LibraryTab({ selectedTrack, onSelect }: Props) {
  const [tracks, setTracks] = useState<Track[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [previewTrack, setPreviewTrack] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const player = useAudioPlayer()

  useEffect(() => {
    fetch('/api/tracks')
      .then(r => r.json())
      .then(d => { setTracks(d.tracks || []); setLoading(false) })
      .catch(() => { setError('Cannot connect to server'); setLoading(false) })
  }, [])

  const filtered = tracks.filter(t =>
    t.id.toLowerCase().includes(search.toLowerCase()) ||
    cleanName(t.name).toLowerCase().includes(search.toLowerCase())
  )

  // Group by folder
  const groups: Record<string, Track[]> = {}
  for (const t of filtered) {
    const key = t.folder || ''
    if (!groups[key]) groups[key] = []
    groups[key].push(t)
  }
  const folderOrder = Object.keys(groups).sort((a, b) => {
    // scripture_reading first, then alphabetical
    if (a === 'scripture_reading') return -1
    if (b === 'scripture_reading') return 1
    if (a === '') return 1
    if (b === '') return -1
    return a.localeCompare(b)
  })

  const handlePreview = (id: string) => {
    if (previewTrack === id && player.playing) {
      player.pause()
      return
    }
    setPreviewTrack(id)
    player.load(`/api/tracks/${id.split('/').map(encodeURIComponent).join('/')}`)
    setTimeout(() => player.play(), 80)
  }

  const stopPreview = () => {
    player.stop()
    setPreviewTrack(null)
  }

  const toggleFolder = (folder: string) => {
    setCollapsed(prev => ({ ...prev, [folder]: !prev[folder] }))
  }

  const totalCount = filtered.length

  return (
    <div className="library-root">
      <audio ref={player.audioRef} style={{ display: 'none' }} />

      {/* ── Sticky header: player + search ── */}
      <div className="library-sticky">
        {/* Mini player bar — always reserve space, collapses when not previewing */}
        <div className={`library-player${previewTrack ? ' visible' : ''}`}>
          <button className="btn btn-ghost btn-sm" style={{ fontSize: 18, padding: '0 6px' }} onClick={() => player.toggle()}>
            {player.playing ? '⏸' : '▶'}
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 3 }}>
              {previewTrack ? cleanName(previewTrack.split('/').pop() ?? previewTrack) : ''}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>{fmt(player.currentTime)}</span>
              <div
                className="progress-wrap"
                style={{ flex: 1 }}
                onClick={e => {
                  const rect = e.currentTarget.getBoundingClientRect()
                  player.seek((e.clientX - rect.left) / rect.width * player.duration)
                }}
              >
                <div className="progress-fill" style={{ width: player.duration ? `${(player.currentTime / player.duration) * 100}%` : '0%' }} />
              </div>
              <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>{fmt(player.duration)}</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>🔊</span>
            <input type="range" min={0} max={1} step={0.02}
              value={player.volume}
              onChange={e => player.changeVolume(parseFloat(e.target.value))}
              style={{ width: 60, accentColor: 'var(--accent)' }}
            />
          </div>
          {previewTrack && (
            <button
              className="btn btn-primary btn-sm"
              style={{ flexShrink: 0 }}
              onClick={() => { stopPreview(); onSelect(previewTrack) }}
            >
              Use →
            </button>
          )}
          {previewTrack && (
            <button className="btn btn-ghost btn-sm" style={{ flexShrink: 0 }} onClick={stopPreview}>✕</button>
          )}
        </div>

        {/* Search + count */}
        <div className="library-search-row">
          <input
            className="search-input"
            style={{ flex: 1, width: 'auto' }}
            placeholder="🔍  Search tracks…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <span style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>{totalCount} tracks</span>
          {selectedTrack && (
            <span style={{ fontSize: 12, color: 'var(--accent)', flexShrink: 0, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              ✓ {cleanName((selectedTrack.split('/').pop()) ?? selectedTrack)}
            </span>
          )}
        </div>

        {/* Folder filter chips — horizontally scrollable */}
        <div className="library-chips">
          <button
            className={`chip${Object.keys(collapsed).every(k => collapsed[k]) || folderOrder.every(f => collapsed[f]) ? ' chip-active' : ''}`}
            onClick={() => setCollapsed(Object.fromEntries(folderOrder.map(f => [f, true])))}
          >All folders</button>
          {folderOrder.map(folder => (
            <button
              key={folder}
              className={`chip${!collapsed[folder] ? ' chip-active' : ''}`}
              onClick={() => setCollapsed(prev => {
                // Close all, open only this one (toggle)
                const allClosed = Object.fromEntries(folderOrder.map(f => [f, true]))
                return collapsed[folder] ? { ...allClosed, [folder]: false } : { ...prev, [folder]: true }
              })}
            >
              {FOLDER_EMOJI[folder] || '🎵'} {folderLabel(folder)} <span style={{ opacity: .6 }}>({groups[folder]?.length ?? 0})</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Scrollable track list ── */}
      <div className="library-scroll">
        {loading && <div className="empty">Loading tracks…</div>}
        {error && <div style={{ color: 'var(--danger)', marginBottom: 12 }}>{error}</div>}

        {folderOrder.map(folder => {
          const group = groups[folder]
          const isCollapsed = collapsed[folder]
          const emoji = FOLDER_EMOJI[folder] || '🎵'
          const label = folderLabel(folder)
          return (
            <div key={folder} style={{ marginBottom: 8 }}>
              {/* Folder header */}
              <div
                onClick={() => toggleFolder(folder)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 10px', cursor: 'pointer',
                  borderRadius: 'var(--radius)',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  userSelect: 'none',
                  marginBottom: isCollapsed ? 0 : 4,
                }}
              >
                <span style={{ fontSize: 16 }}>{emoji}</span>
                <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>{label}</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 4 }}>
                  {group.length} track{group.length !== 1 ? 's' : ''}
                </span>
                <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)' }}>
                  {isCollapsed ? '▶' : '▼'}
                </span>
              </div>

              {/* Track list */}
              {!isCollapsed && (
                <div className="track-list" style={{ marginLeft: 8, borderLeft: '2px solid var(--border)', paddingLeft: 8 }}>
                  {group.map(track => {
                    const isPreviewing = previewTrack === track.id
                    const isSelected = selectedTrack === track.id
                    return (
                      <div
                        key={track.id}
                        className={`track-row${isSelected ? ' selected' : ''}${isPreviewing ? ' previewing' : ''}`}
                        onClick={() => handlePreview(track.id)}
                      >
                        <span style={{ fontSize: 16, flexShrink: 0 }}>
                          {isPreviewing && player.playing ? '🔊' : '🎵'}
                        </span>
                        <div className="track-name">{cleanName(track.name)}</div>
                        <div className="track-actions" onClick={e => e.stopPropagation()}>
                          <button
                            className={`btn btn-sm ${isPreviewing && player.playing ? 'btn-primary' : 'btn-ghost'}`}
                            onClick={() => handlePreview(track.id)}
                          >
                            {isPreviewing && player.playing ? '⏸ Pause' : '▶ Preview'}
                          </button>
                          <button
                            className={`btn btn-sm ${isSelected ? 'btn-success' : 'btn-primary'}`}
                            onClick={() => { stopPreview(); onSelect(track.id) }}
                          >
                            {isSelected ? '✓ Selected' : 'Use →'}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}

        {!loading && totalCount === 0 && (
          <div className="empty">No tracks found</div>
        )}
      </div>
    </div>
  )
}
