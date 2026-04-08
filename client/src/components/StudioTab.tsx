import { useEffect, useRef, useState, useCallback } from 'react'
import { useRecorder, fmt, fmtBytes } from '../hooks/useAudio'
import type { RecordingQuality } from '../hooks/useSettings'

interface Props {
  selectedTrack: string | null
  onChangeTrack: () => void
  autoTranscribe: boolean
  recQuality: RecordingQuality
  onOpenLyrics: (filename: string) => void
  apiFetch: (input: RequestInfo, init?: RequestInit) => Promise<Response>
}

// ── Track in the deck ──────────────────────────────────────
interface DeckTrack {
  id: string          // unique key
  trackId: string     // library track path e.g. 'calm/song.mp3'
  name: string        // display name
  vol: number         // 0..1
  playing: boolean
  audioEl: HTMLAudioElement | null
}

function cleanName(filename: string) {
  if (!filename) return ''
  return filename
    .replace(/\.mp3$/i, '')
    .replace(/_\d+$/, '')
    .replace(/_/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

function WaveformBars({ amplitude, bars = 28, isRec = false }: { amplitude: number; bars?: number; isRec?: boolean }) {
  return (
    <div className={`waveform-bar${amplitude > 0.05 ? ' active' : ''}`} style={{ marginBottom: 0, height: 44 }}>
      {Array.from({ length: bars }, (_, i) => {
        const phase = (i / bars) * Math.PI * 2
        const h = amplitude > 0.05
          ? Math.max(3, Math.abs(Math.sin(phase + Date.now() / 200)) * amplitude * 40)
          : 3
        return <div key={i} className={`wave-col${isRec ? ' rec' : ''}`} style={{ height: `${h}px` }} />
      })}
    </div>
  )
}

// ── Small search modal for adding a track to deck ─────────
function TrackPicker({
  onPick,
  onClose,
  apiFetch,
}: {
  onPick: (trackId: string, name: string) => void
  onClose: () => void
  apiFetch: (input: RequestInfo, init?: RequestInit) => Promise<Response>
}) {
  const [tracks, setTracks] = useState<{ id: string; name: string; folder: string }[]>([])
  const [search, setSearch] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    apiFetch('/api/tracks')
      .then(r => r.json())
      .then(d => setTracks(d.tracks || []))
      .catch(() => {})
  }, [])

  const filtered = tracks.filter(t =>
    search.length < 1 ||
    t.id.toLowerCase().includes(search.toLowerCase()) ||
    cleanName(t.name).toLowerCase().includes(search.toLowerCase())
  ).slice(0, 40)

  return (
    <div className="deck-picker-overlay" onClick={onClose}>
      <div className="deck-picker" onClick={e => e.stopPropagation()}>
        <div className="deck-picker-head">
          <span style={{ fontWeight: 700, fontSize: 14 }}>Add Track</span>
          <input
            ref={inputRef}
            placeholder="🔍 Search tracks…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ padding: '2px 8px' }}>✕</button>
        </div>
        <div className="deck-picker-list">
          {filtered.map(t => (
            <div
              key={t.id}
              className="deck-picker-row"
              onClick={() => { onPick(t.id, t.name); onClose() }}
            >
              <span style={{ fontSize: 13 }}>🎵</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {cleanName(t.name)}
                </div>
                {t.folder && (
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{t.folder}</div>
                )}
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
              No tracks found
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── One row in the deck ────────────────────────────────────
function DeckRow({
  track,
  exclusive,
  isRecording,
  onPlay,
  onPause,
  onStop,
  onVol,
  onRemove,
}: {
  track: DeckTrack
  exclusive: boolean
  isRecording: boolean
  onPlay: (id: string) => void
  onPause: (id: string) => void
  onStop: (id: string) => void
  onVol: (id: string, v: number) => void
  onRemove: (id: string) => void
}) {
  return (
    <div className={`deck-row${track.playing ? ' deck-row-active' : ''}`}>
      <span style={{ fontSize: 15, flexShrink: 0 }}>{track.playing ? '🔊' : '🎵'}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {cleanName(track.name)}
        </div>
        <input
          type="range" min={0} max={1} step={0.02}
          value={track.vol}
          onChange={e => onVol(track.id, parseFloat(e.target.value))}
          style={{ width: '100%', height: 3, accentColor: 'var(--accent)', marginTop: 4 }}
        />
      </div>
      <span style={{ fontSize: 10, color: 'var(--text-muted)', width: 26, textAlign: 'right', flexShrink: 0 }}>
        {Math.round(track.vol * 100)}%
      </span>
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        {track.playing ? (
          <button className="btn btn-ghost btn-sm" style={{ padding: '3px 8px' }} onClick={() => onPause(track.id)}>⏸</button>
        ) : (
          <button className="btn btn-primary btn-sm" style={{ padding: '3px 8px' }} onClick={() => onPlay(track.id)}>▶</button>
        )}
        <button className="btn btn-ghost btn-sm" style={{ padding: '3px 8px' }} onClick={() => onStop(track.id)}>⏹</button>
        {!isRecording && (
          <button className="btn btn-danger btn-sm" style={{ padding: '3px 8px' }} onClick={() => onRemove(track.id)}>✕</button>
        )}
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────
export function StudioTab({ selectedTrack, onChangeTrack, autoTranscribe, recQuality, onOpenLyrics, apiFetch }: Props) {
  const recorder = useRecorder()

  // Deck: list of tracks + their audio elements
  const [deck, setDeck] = useState<DeckTrack[]>([])
  const audioElsRef = useRef<Map<string, HTMLAudioElement>>(new Map())

  // Exclusive mode: only one track plays at a time
  const [exclusive, setExclusive] = useState(true)

  // Global mic volume
  const [micVol, setMicVol] = useState(1.0)

  // Picker open
  const [pickerOpen, setPickerOpen] = useState(false)

  // Recording / save state
  const [recName, setRecName] = useState('scripture_reading')
  const [saving,  setSaving]  = useState(false)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)
  const [lastBlob, setLastBlob] = useState<Blob | null>(null)
  const [lastUrl,  setLastUrl]  = useState<string | null>(null)
  const [transcribing, setTranscribing] = useState(false)
  const [savedFilename, setSavedFilename] = useState<string | null>(null)

  // Re-render waveform
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!recorder.recording) return
    const id = setInterval(() => setTick(t => t + 1), 60)
    return () => clearInterval(id)
  }, [recorder.recording])

  // Seed deck with the pre-selected track when it changes
  useEffect(() => {
    if (!selectedTrack) return
    setDeck(prev => {
      // If it's already in the deck don't add again
      if (prev.some(t => t.trackId === selectedTrack)) return prev
      const name = selectedTrack.split('/').pop() ?? selectedTrack
      const id = `track-${Date.now()}`
      return [{ id, trackId: selectedTrack, name, vol: 0.5, playing: false, audioEl: null }, ...prev]
    })
  }, [selectedTrack])

  // Create / retrieve audio element for a deck entry
  const getOrCreateAudioEl = useCallback((trackId: string, deckId: string): HTMLAudioElement => {
    if (audioElsRef.current.has(deckId)) return audioElsRef.current.get(deckId)!
    const el = new Audio()
    el.src = `/api/tracks/${trackId.split('/').map(encodeURIComponent).join('/')}`
    el.loop = true
    el.preload = 'none'
    audioElsRef.current.set(deckId, el)
    return el
  }, [])

  // Clean up audio elements on unmount
  useEffect(() => {
    return () => {
      audioElsRef.current.forEach(el => { el.pause(); el.src = '' })
    }
  }, [])

  const addTrack = (trackId: string, name: string) => {
    const id = `track-${Date.now()}`
    setDeck(prev => [...prev, { id, trackId, name, vol: 0.5, playing: false, audioEl: null }])
  }

  const playTrack = (deckId: string) => {
    setDeck(prev => prev.map(t => {
      if (t.id === deckId) {
        const el = getOrCreateAudioEl(t.trackId, t.id)
        el.volume = t.vol
        el.play().catch(() => {})
        // If recording and track isn't yet wired into context, connect it now
        if (recorder.recording) {
          recorder.connectTrack(el, t.vol)
        }
        return { ...t, playing: true, audioEl: el }
      }
      // In exclusive mode pause all others
      if (exclusive) {
        const otherEl = audioElsRef.current.get(t.id)
        otherEl?.pause()
        return { ...t, playing: false }
      }
      return t
    }))
  }

  const pauseTrack = (deckId: string) => {
    setDeck(prev => prev.map(t => {
      if (t.id !== deckId) return t
      audioElsRef.current.get(deckId)?.pause()
      return { ...t, playing: false }
    }))
  }

  const stopTrack = (deckId: string) => {
    setDeck(prev => prev.map(t => {
      if (t.id !== deckId) return t
      const el = audioElsRef.current.get(deckId)
      if (el) { el.pause(); el.currentTime = 0 }
      return { ...t, playing: false }
    }))
  }

  const setVol = (deckId: string, v: number) => {
    setDeck(prev => prev.map(t => {
      if (t.id !== deckId) return t
      const el = audioElsRef.current.get(deckId)
      if (el) el.volume = v
      return { ...t, vol: v }
    }))
  }

  const removeTrack = (deckId: string) => {
    const el = audioElsRef.current.get(deckId)
    if (el) { el.pause(); el.src = '' }
    audioElsRef.current.delete(deckId)
    setDeck(prev => prev.filter(t => t.id !== deckId))
  }

  const stopAllTracks = () => {
    audioElsRef.current.forEach(el => { el.pause(); el.currentTime = 0 })
    setDeck(prev => prev.map(t => ({ ...t, playing: false })))
  }

  // Start recording — pass all currently playing audio elements
  const handleStartRecording = async () => {
    setSaveMsg(null); setLastBlob(null); setLastUrl(null)

    // Play all deck tracks that are queued (already playing)
    // Build list of active audio elements
    const activeEls: HTMLAudioElement[] = []
    const playingDeck: string[] = []

    deck.forEach(t => {
      if (t.playing) {
        const el = audioElsRef.current.get(t.id)
        if (el) { activeEls.push(el); playingDeck.push(t.id) }
      }
    })

    await new Promise(r => setTimeout(r, 80))

    // Use global vol 0.5 as default bg; individual vols are set on the elements already
    await recorder.start(activeEls, 0.5, micVol, recQuality)
  }

  const handleStopRecording = async () => {
    const blob = await recorder.stop()
    stopAllTracks()
    setLastBlob(blob)
    setLastUrl(URL.createObjectURL(blob))
  }

  const handleSave = async () => {
    if (!lastBlob) return
    setSaving(true); setSaveMsg(null); setSavedFilename(null)
    try {
      const fd = new FormData()
      const ext = lastBlob.type.includes('mp4') ? 'mp4' : 'webm'
      fd.append('audio', lastBlob, `${recName}.${ext}`)
      fd.append('name', recName)
      const res = await apiFetch('/api/recordings', { method: 'POST', body: fd })
      const json = await res.json()
      if (json.ok) {
        setSavedFilename(json.filename)
        setSaveMsg(`✓ Saved as ${json.filename} (${fmtBytes(json.size)})`)
        if (autoTranscribe) {
          setTranscribing(true); setSaveMsg(`✓ Saved · Transcribing…`)
          try {
            const tr = await apiFetch(`/api/transcripts/${encodeURIComponent(json.filename)}`, { method: 'POST' })
            const td = await tr.json()
            if (td.error) throw new Error(td.error)
            setSaveMsg(`✓ Saved & transcribed — ${td.words?.length ?? 0} words`)
          } catch (e) {
            setSaveMsg(`✓ Saved · Transcription failed: ${e instanceof Error ? e.message : 'unknown'}`)
          }
          setTranscribing(false)
        }
      } else {
        setSaveMsg(`✗ ${json.error}`)
      }
    } catch { setSaveMsg('✗ Save failed') }
    setSaving(false)
  }

  const handleDiscard = () => {
    if (lastUrl) URL.revokeObjectURL(lastUrl)
    setLastBlob(null); setLastUrl(null); setSaveMsg(null); setSavedFilename(null)
  }

  const panelState: 'idle' | 'recording' | 'review' =
    lastUrl ? 'review' : recorder.recording ? 'recording' : 'idle'

  const playingCount = deck.filter(t => t.playing).length

  return (
    <div className="studio-root">
      {pickerOpen && (
        <TrackPicker
          onPick={addTrack}
          onClose={() => setPickerOpen(false)}
          apiFetch={apiFetch}
        />
      )}

      {/* ── TOP SCROLL ZONE ── */}
      <div className="studio-scroll">

        {/* ── TRACK DECK ── */}
        <div className="card" style={{ marginBottom: 12, padding: '12px 14px' }}>
          {/* Deck header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.07em', flex: 1 }}>
              🎛 Music Deck {deck.length > 0 && <span style={{ opacity: .6 }}>· {deck.length} track{deck.length !== 1 ? 's' : ''}{playingCount > 0 ? ` · ${playingCount} playing` : ''}</span>}
            </span>
            {/* Exclusive toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                {exclusive ? '1 at a time' : 'Multi-play'}
              </span>
              <button
                onClick={() => setExclusive(e => !e)}
                title={exclusive ? 'Only one track plays at a time. Click to allow multiple.' : 'Multiple tracks can play. Click for exclusive mode.'}
                style={{
                  width: 38, height: 22, borderRadius: 11,
                  background: exclusive ? 'var(--accent)' : 'var(--surface2)',
                  border: 'none', cursor: 'pointer', position: 'relative',
                  transition: 'background .15s', padding: 0, flexShrink: 0,
                }}
              >
                <span style={{
                  position: 'absolute', top: 2, left: exclusive ? 18 : 2,
                  width: 18, height: 18, borderRadius: '50%', background: '#fff',
                  transition: 'left .15s cubic-bezier(.4,0,.2,1)',
                  boxShadow: '0 1px 4px rgba(0,0,0,.25)',
                }} />
              </button>
            </div>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setPickerOpen(true)}
              style={{ padding: '4px 12px', fontSize: 12 }}
            >
              + Add Track
            </button>
          </div>

          {/* Empty state */}
          {deck.length === 0 && (
            <div style={{ padding: '10px 0 4px', fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
              No tracks in deck. <button className="btn btn-ghost btn-sm" style={{ fontSize: 12 }} onClick={() => setPickerOpen(true)}>Browse library →</button>
            </div>
          )}

          {/* Track rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {deck.map(t => (
              <DeckRow
                key={t.id}
                track={t}
                exclusive={exclusive}
                isRecording={recorder.recording}
                onPlay={playTrack}
                onPause={pauseTrack}
                onStop={stopTrack}
                onVol={setVol}
                onRemove={removeTrack}
              />
            ))}
          </div>

          {/* Hint while recording */}
          {recorder.recording && deck.length > 0 && (
            <div style={{ marginTop: 8, fontSize: 11, color: 'var(--cyan)' }}>
              🎵 {playingCount > 0 ? `${playingCount} track${playingCount !== 1 ? 's' : ''} mixing into recording` : 'Tap ▶ to add a track to the mix'}
            </div>
          )}
        </div>

        {/* ── MIC VOLUME ── */}
        <div className="card" style={{ marginBottom: 0, padding: '10px 14px' }}>
          <div className="vol-row" style={{ marginBottom: 0 }}>
            <span className="vol-label" style={{ fontSize: 11 }}>🎙 My voice</span>
            <input type="range" min={0} max={1} step={0.02}
              value={micVol} onChange={e => setMicVol(parseFloat(e.target.value))} />
            <span className="vol-value">{Math.round(micVol * 100)}%</span>
          </div>
        </div>
      </div>

      {/* ── BOTTOM FIXED PANEL ── */}
      <div className="studio-footer">

        {/* IDLE */}
        {panelState === 'idle' && (
          <div className="studio-footer-inner">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>Session name</span>
              <input
                className="studio-name-input"
                value={recName}
                onChange={e => setRecName(e.target.value)}
                placeholder="e.g. psalm_23_reading"
              />
            </div>
            <button
              className="btn btn-rec"
              onClick={handleStartRecording}
              disabled={saving}
              style={{ fontSize: 15, padding: '10px 0', width: '100%' }}
            >
              ⏺ Start Recording
            </button>
            {deck.length === 0 && (
              <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
                No tracks in deck — recording voice only
              </div>
            )}
          </div>
        )}

        {/* RECORDING */}
        {panelState === 'recording' && (
          <div className="studio-footer-inner">
            {recorder.error && (
              <div style={{ color: 'var(--danger)', marginBottom: 6, fontSize: 12 }}>⚠ {recorder.error}</div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div className={`rec-dot${recorder.paused ? ' paused' : ''}`} />
              <div className="rec-timer" style={{ fontSize: 18 }}>{fmt(recorder.seconds)}</div>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', flex: 1 }}>
                {recorder.paused ? 'Paused' : 'Recording'}
              </span>
              {playingCount > 0 && (
                <span style={{ fontSize: 11, color: 'var(--cyan)' }}>🎵 {playingCount}</span>
              )}
            </div>
            <WaveformBars amplitude={recorder.amplitude} isRec bars={24} />
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              {recorder.paused ? (
                <button className="btn btn-primary" onClick={recorder.resume}
                  style={{ fontSize: 14, padding: '8px 0', flex: 1 }}>▶ Resume</button>
              ) : (
                <button className="btn btn-ghost" onClick={recorder.pause}
                  style={{ fontSize: 14, padding: '8px 0', flex: 1 }}>⏸ Pause</button>
              )}
              <button className="btn btn-rec recording" onClick={handleStopRecording}
                style={{ fontSize: 14, padding: '8px 0', flex: 1 }}>⏹ Stop</button>
            </div>
          </div>
        )}

        {/* REVIEW */}
        {panelState === 'review' && (
          <div className="studio-footer-inner">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)' }}>💾 Ready to Save</span>
              {saveMsg && (
                <span style={{ fontSize: 11, color: saveMsg.startsWith('✓') ? 'var(--success)' : 'var(--danger)' }}>
                  {saveMsg}
                </span>
              )}
            </div>
            <audio controls src={lastUrl!} style={{ width: '100%', height: 34, marginBottom: 8 }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>Name:</span>
              <input className="studio-name-input" value={recName}
                onChange={e => setRecName(e.target.value)} disabled={saving || transcribing} />
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving || transcribing}
                style={{ flex: 1, fontSize: 13, padding: '8px 0' }}>
                {saving ? 'Saving…' : transcribing ? '⏳ Transcribing…' : '💾 Save'}
              </button>
              {savedFilename && !saving && !transcribing && (
                <button className="btn btn-ghost btn-sm" onClick={() => onOpenLyrics(savedFilename)}>🎤</button>
              )}
              <button className="btn btn-danger btn-sm" onClick={handleDiscard}
                disabled={saving || transcribing} style={{ padding: '8px 14px' }}>🗑</button>
            </div>
            {autoTranscribe && !savedFilename && !saving && (
              <div style={{ marginTop: 5, fontSize: 10, color: 'var(--text-muted)' }}>
                Auto-transcribe on — transcript created after saving
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
