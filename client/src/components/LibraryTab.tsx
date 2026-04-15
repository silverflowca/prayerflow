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

const token = () => localStorage.getItem('pf_token') ?? ''

export function LibraryTab({ selectedTrack, onSelect }: Props) {
  const [tracks, setTracks] = useState<Track[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [previewTrack, setPreviewTrack] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [playCounts, setPlayCounts] = useState<Record<string, number>>({})

  // Upload state
  const uploadInputRef = useRef<HTMLInputElement>(null)
  const [uploadFolder, setUploadFolder] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState<string | null>(null)

  // Rename folder state
  const [renamingFolder, setRenamingFolder] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [renaming, setRenaming] = useState(false)

  const player = useAudioPlayer()

  const fetchTracks = () => {
    setLoading(true)
    fetch('/api/tracks')
      .then(r => r.json())
      .then(d => { setTracks(d.tracks || []); setLoading(false) })
      .catch(() => { setError('Cannot connect to server'); setLoading(false) })
  }

  useEffect(() => {
    fetchTracks()
    fetch('/api/tracks/counts')
      .then(r => r.json())
      .then(d => setPlayCounts(d))
      .catch(() => {})
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
    if (a === 'scripture_reading') return -1
    if (b === 'scripture_reading') return 1
    if (a === '') return 1
    if (b === '') return -1
    return a.localeCompare(b)
  })

  // All folder names (for upload folder picker)
  const allFolders = [...new Set(tracks.map(t => t.folder).filter(Boolean))].sort()

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

  const handleUse = (id: string) => {
    stopPreview()
    onSelect(id)
    // Record play count
    fetch('/api/tracks/counts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trackId: id }),
    })
      .then(r => r.json())
      .then(d => { if (d.ok) setPlayCounts(prev => ({ ...prev, [id]: d.count })) })
      .catch(() => {})
  }

  const toggleFolder = (folder: string) => {
    setCollapsed(prev => ({ ...prev, [folder]: !prev[folder] }))
  }

  // ── Upload handler
  const handleUploadFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setUploading(true)
    setUploadMsg(null)
    let ok = 0, fail = 0
    for (const file of Array.from(files)) {
      const form = new FormData()
      form.append('file', file)
      form.append('folder', uploadFolder)
      try {
        const res = await fetch('/api/tracks/upload', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token()}` },
          body: form,
        })
        const d = await res.json()
        if (d.ok) ok++; else { fail++; console.error(d.error) }
      } catch { fail++ }
    }
    setUploading(false)
    setUploadMsg(fail === 0 ? `✓ ${ok} track${ok !== 1 ? 's' : ''} uploaded` : `Uploaded ${ok}, failed ${fail}`)
    fetchTracks()
    if (uploadInputRef.current) uploadInputRef.current.value = ''
  }

  // ── Rename folder handler
  const handleRenameFolder = async (from: string) => {
    const to = renameValue.trim()
    if (!to || to === from) { setRenamingFolder(null); return }
    setRenaming(true)
    try {
      const res = await fetch('/api/tracks/rename-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ from, to }),
      })
      const d = await res.json()
      if (d.ok) {
        fetchTracks()
        setRenamingFolder(null)
      } else {
        alert(d.error || 'Rename failed')
      }
    } catch {
      alert('Rename failed')
    } finally {
      setRenaming(false)
    }
  }

  const totalCount = filtered.length

  return (
    <div className="library-root">
      <audio ref={player.audioRef} style={{ display: 'none' }} />

      {/* ── Sticky header ── */}
      <div className="library-sticky">
        {/* Mini player bar */}
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
            <button className="btn btn-primary btn-sm" style={{ flexShrink: 0 }} onClick={() => handleUse(previewTrack)}>
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

        {/* Folder filter chips */}
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
                const allClosed = Object.fromEntries(folderOrder.map(f => [f, true]))
                return collapsed[folder] ? { ...allClosed, [folder]: false } : { ...prev, [folder]: true }
              })}
            >
              {FOLDER_EMOJI[folder] || '🎵'} {folderLabel(folder)} <span style={{ opacity: .6 }}>({groups[folder]?.length ?? 0})</span>
            </button>
          ))}
        </div>

        {/* ── Upload panel ── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
          padding: '8px 0 4px',
          borderTop: '1px solid var(--border)',
        }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>📂 Upload:</span>
          <select
            value={uploadFolder}
            onChange={e => setUploadFolder(e.target.value)}
            style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 6, padding: '3px 6px', fontSize: 12, color: 'var(--text)',
              maxWidth: 130,
            }}
          >
            <option value="">Root / New folder…</option>
            {allFolders.map(f => <option key={f} value={f}>{folderLabel(f)}</option>)}
          </select>
          {uploadFolder === '' && (
            <input
              placeholder="New folder name"
              style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 6, padding: '3px 8px', fontSize: 12, color: 'var(--text)',
                width: 120,
              }}
              onChange={e => setUploadFolder(e.target.value.replace(/[^a-zA-Z0-9 _-]/g, ''))}
            />
          )}
          <button
            className="btn btn-sm btn-ghost"
            disabled={uploading}
            onClick={() => uploadInputRef.current?.click()}
            style={{ flexShrink: 0 }}
          >
            {uploading ? '…' : '+ Add tracks'}
          </button>
          <input
            ref={uploadInputRef}
            type="file"
            accept=".mp3,.wav,.ogg,.m4a,.webm,.mp4"
            multiple
            style={{ display: 'none' }}
            onChange={e => handleUploadFiles(e.target.files)}
          />
          {uploadMsg && (
            <span style={{ fontSize: 12, color: uploadMsg.startsWith('✓') ? 'var(--success)' : 'var(--danger)', flexShrink: 0 }}>
              {uploadMsg}
            </span>
          )}
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
          const isRenaming = renamingFolder === folder
          return (
            <div key={folder} style={{ marginBottom: 8 }}>
              {/* Folder header */}
              <div
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
                <span style={{ fontSize: 16 }} onClick={() => toggleFolder(folder)}>{emoji}</span>
                {isRenaming ? (
                  <form
                    onSubmit={e => { e.preventDefault(); handleRenameFolder(folder) }}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}
                    onClick={e => e.stopPropagation()}
                  >
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={e => setRenameValue(e.target.value)}
                      style={{
                        background: 'var(--surface2)', border: '1px solid var(--accent)',
                        borderRadius: 5, padding: '2px 8px', fontSize: 13, color: 'var(--text)',
                        width: 140,
                      }}
                    />
                    <button type="submit" className="btn btn-sm btn-primary" disabled={renaming}>
                      {renaming ? '…' : 'Save'}
                    </button>
                    <button type="button" className="btn btn-sm btn-ghost" onClick={() => setRenamingFolder(null)}>✕</button>
                  </form>
                ) : (
                  <>
                    <span
                      style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)', flex: 1 }}
                      onClick={() => toggleFolder(folder)}
                    >
                      {label}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }} onClick={() => toggleFolder(folder)}>
                      {group.length} track{group.length !== 1 ? 's' : ''}
                    </span>
                    {folder && (
                      <button
                        title="Rename folder"
                        className="btn btn-ghost btn-sm"
                        style={{ padding: '1px 5px', fontSize: 12, opacity: 0.6 }}
                        onClick={e => { e.stopPropagation(); setRenamingFolder(folder); setRenameValue(folder) }}
                      >
                        ✏️
                      </button>
                    )}
                    <span style={{ marginLeft: 2, fontSize: 12, color: 'var(--text-muted)' }} onClick={() => toggleFolder(folder)}>
                      {isCollapsed ? '▶' : '▼'}
                    </span>
                  </>
                )}
              </div>

              {/* Track list */}
              {!isCollapsed && (
                <div className="track-list" style={{ marginLeft: 8, borderLeft: '2px solid var(--border)', paddingLeft: 8 }}>
                  {group.map(track => {
                    const isPreviewing = previewTrack === track.id
                    const isSelected = selectedTrack === track.id
                    const plays = playCounts[track.id] ?? 0
                    return (
                      <div
                        key={track.id}
                        className={`track-row${isSelected ? ' selected' : ''}${isPreviewing ? ' previewing' : ''}`}
                        onClick={() => handlePreview(track.id)}
                      >
                        <span style={{ fontSize: 16, flexShrink: 0 }}>
                          {isPreviewing && player.playing ? '🔊' : '🎵'}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="track-name">{cleanName(track.name)}</div>
                          {plays > 0 && (
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>
                              ▶ {plays} use{plays !== 1 ? 's' : ''}
                            </div>
                          )}
                        </div>
                        <div className="track-actions" onClick={e => e.stopPropagation()}>
                          <button
                            className={`btn btn-sm ${isPreviewing && player.playing ? 'btn-primary' : 'btn-ghost'}`}
                            onClick={() => handlePreview(track.id)}
                          >
                            {isPreviewing && player.playing ? '⏸ Pause' : '▶ Preview'}
                          </button>
                          <button
                            className={`btn btn-sm ${isSelected ? 'btn-success' : 'btn-primary'}`}
                            onClick={() => handleUse(track.id)}
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
