import { useEffect, useRef, useState, useCallback } from 'react'
import { useRecorder, fmt, fmtBytes } from '../hooks/useAudio'
import type { RecordingQuality, AudioProcessing } from '../hooks/useSettings'

interface Props {
  selectedTrack: string | null
  onChangeTrack: () => void
  autoTranscribe: boolean
  recQuality: RecordingQuality
  audioProcessing: AudioProcessing
  onUpdateAudioProcessing: (patch: Partial<AudioProcessing>) => void
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
  currentTime,
  duration,
  onPlay,
  onPause,
  onStop,
  onVol,
  onSeek,
  onRemove,
}: {
  track: DeckTrack
  exclusive: boolean
  isRecording: boolean
  currentTime: number
  duration: number
  onPlay: (id: string) => void
  onPause: (id: string) => void
  onStop: (id: string) => void
  onVol: (id: string, v: number) => void
  onSeek: (id: string, t: number) => void
  onRemove: (id: string) => void
}) {
  const pct = duration > 0 ? currentTime / duration : 0

  return (
    <div className={`deck-row${track.playing ? ' deck-row-active' : ''}`}>
      <span style={{ fontSize: 15, flexShrink: 0 }}>{track.playing ? '🔊' : '🎵'}</span>

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Track name */}
        <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {cleanName(track.name)}
        </div>

        {/* Seek bar — doubles as playback position indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4 }}>
          <input
            type="range" min={0} max={duration || 1} step={0.1}
            value={currentTime}
            onChange={e => onSeek(track.id, parseFloat(e.target.value))}
            style={{ flex: 1, height: 3, accentColor: track.playing ? 'var(--danger)' : 'var(--accent)' }}
          />
          <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0, width: 68, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
            {fmt(currentTime)}{duration > 0 ? ` / ${fmt(duration)}` : ''}
          </span>
        </div>

        {/* Volume slider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3 }}>
          <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>Vol</span>
          <input
            type="range" min={0} max={1} step={0.02}
            value={track.vol}
            onChange={e => onVol(track.id, parseFloat(e.target.value))}
            style={{ flex: 1, height: 3, accentColor: 'var(--accent)' }}
          />
          <span style={{ fontSize: 10, color: 'var(--text-muted)', width: 28, textAlign: 'right', flexShrink: 0 }}>
            {Math.round(track.vol * 100)}%
          </span>
        </div>
      </div>

      {/* Transport buttons */}
      <div style={{ display: 'flex', gap: 4, flexShrink: 0, alignSelf: 'center' }}>
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

// ── Audio Processing collapsible drawer ────────────────────
function AudioProcessingDrawer({
  proc,
  onChange,
}: {
  proc: AudioProcessing
  onChange: (patch: Partial<AudioProcessing>) => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <div style={{ marginTop: 8 }}>
      {/* Pull-down handle */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 8,
          background: 'none', border: 'none', cursor: 'pointer',
          padding: '4px 0', color: 'var(--text-muted)', fontSize: 12,
        }}
      >
        <span style={{ flex: 1, textAlign: 'left', fontWeight: 500 }}>
          🎛 Audio Processing
          <span style={{ marginLeft: 6, color: 'var(--text-muted)', fontWeight: 400, fontSize: 11 }}>
            {proc.hissFilter ? `hiss ${(proc.hissFreq/1000).toFixed(1)}k` : 'no hiss filter'}
            {proc.enabled ? ` · comp ${proc.threshold}dB` : ' · no comp'}
          </span>
        </span>
        <span style={{
          fontSize: 10, transition: 'transform .15s',
          display: 'inline-block', transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
        }}>▾</span>
      </button>

      {/* Drawer body */}
      {open && (
        <div style={{
          marginTop: 6, padding: '10px 12px',
          background: 'var(--bg)', borderRadius: 'var(--radius)',
          border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          {/* Hiss filter toggle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <span style={{ fontSize: 12, color: 'var(--text)', fontWeight: 500 }}>Hiss Filter</span>
              {proc.hissFilter && (
                <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--text-muted)' }}>
                  {(proc.hissFreq / 1000).toFixed(1)}kHz · {proc.hissGain}dB
                </span>
              )}
            </div>
            <button
              onClick={() => onChange({ hissFilter: !proc.hissFilter })}
              style={{
                width: 38, height: 22, borderRadius: 11,
                background: proc.hissFilter ? 'var(--accent)' : 'var(--surface2)',
                border: 'none', cursor: 'pointer', position: 'relative',
                transition: 'background .15s', padding: 0, flexShrink: 0,
              }}
            >
              <span style={{
                position: 'absolute', top: 2, left: proc.hissFilter ? 18 : 2,
                width: 18, height: 18, borderRadius: '50%', background: '#fff',
                transition: 'left .15s cubic-bezier(.4,0,.2,1)',
                boxShadow: '0 1px 4px rgba(0,0,0,.25)',
              }} />
            </button>
          </div>

          {proc.hissFilter && (
            <>
              <ProcRow label="Shelf Freq" value={`${(proc.hissFreq / 1000).toFixed(1)} kHz`} hint="6k = strong · 8k = balanced · 12k = subtle">
                <input type="range" min={2000} max={16000} step={500}
                  value={proc.hissFreq}
                  onChange={e => onChange({ hissFreq: +e.target.value })}
                  style={{ flex: 1, accentColor: 'var(--accent)' }}
                />
              </ProcRow>
              <ProcRow label="Cut Depth" value={`${proc.hissGain} dB`} hint="-12 = light · -18 = balanced · -30 = heavy">
                <input type="range" min={-40} max={0} step={1}
                  value={proc.hissGain}
                  onChange={e => onChange({ hissGain: +e.target.value })}
                  style={{ flex: 1, accentColor: 'var(--accent)' }}
                />
              </ProcRow>
            </>
          )}

          <div style={{ height: 1, background: 'var(--border)' }} />

          {/* Enable toggle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, color: 'var(--text)' }}>Compressor</span>
            <button
              onClick={() => onChange({ enabled: !proc.enabled })}
              style={{
                width: 38, height: 22, borderRadius: 11,
                background: proc.enabled ? 'var(--accent)' : 'var(--surface2)',
                border: 'none', cursor: 'pointer', position: 'relative',
                transition: 'background .15s', padding: 0, flexShrink: 0,
              }}
            >
              <span style={{
                position: 'absolute', top: 2, left: proc.enabled ? 18 : 2,
                width: 18, height: 18, borderRadius: '50%', background: '#fff',
                transition: 'left .15s cubic-bezier(.4,0,.2,1)',
                boxShadow: '0 1px 4px rgba(0,0,0,.25)',
              }} />
            </button>
          </div>

          {proc.enabled && (
            <>
              {/* Threshold */}
              <ProcRow
                label="Threshold"
                value={`${proc.threshold} dB`}
                hint="-6 = gentle · -24 = always on"
              >
                <input type="range" min={-60} max={0} step={1}
                  value={proc.threshold}
                  onChange={e => onChange({ threshold: +e.target.value })}
                  style={{ flex: 1, accentColor: 'var(--accent)' }}
                />
              </ProcRow>

              {/* Ratio */}
              <ProcRow
                label="Ratio"
                value={`${proc.ratio}:1`}
                hint="2 = light · 4 = vocal · 10 = limiter"
              >
                <input type="range" min={1} max={20} step={0.5}
                  value={proc.ratio}
                  onChange={e => onChange({ ratio: +e.target.value })}
                  style={{ flex: 1, accentColor: 'var(--accent)' }}
                />
              </ProcRow>

              {/* Knee */}
              <ProcRow
                label="Knee"
                value={`${proc.knee} dB`}
                hint="0 = hard · 12 = soft"
              >
                <input type="range" min={0} max={40} step={1}
                  value={proc.knee}
                  onChange={e => onChange({ knee: +e.target.value })}
                  style={{ flex: 1, accentColor: 'var(--accent)' }}
                />
              </ProcRow>

              {/* Attack */}
              <ProcRow
                label="Attack"
                value={`${proc.attack} ms`}
                hint="1 ms = catch peaks · 30 ms = natural"
              >
                <input type="range" min={1} max={200} step={1}
                  value={proc.attack}
                  onChange={e => onChange({ attack: +e.target.value })}
                  style={{ flex: 1, accentColor: 'var(--accent)' }}
                />
              </ProcRow>

              {/* Release */}
              <ProcRow
                label="Release"
                value={`${proc.release} ms`}
                hint="100 ms = snappy · 600 ms = smooth"
              >
                <input type="range" min={10} max={2000} step={10}
                  value={proc.release}
                  onChange={e => onChange({ release: +e.target.value })}
                  style={{ flex: 1, accentColor: 'var(--accent)' }}
                />
              </ProcRow>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function ProcRow({ label, value, hint, children }: {
  label: string; value: string; hint: string; children: React.ReactNode
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: 11, color: 'var(--text)', fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>{value}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {children}
      </div>
      <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{hint}</span>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────
export function StudioTab({ selectedTrack, onChangeTrack, autoTranscribe, recQuality, audioProcessing, onUpdateAudioProcessing, onOpenLyrics, apiFetch }: Props) {
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
  const [addingToLib, setAddingToLib] = useState(false)
  const [addedToLib, setAddedToLib]   = useState(false)

  // Per-track playback position: deckId → { currentTime, duration }
  const [trackTimes, setTrackTimes] = useState<Record<string, { currentTime: number; duration: number }>>({})
  const rafRef = useRef<number>(0)

  // Poll audio element positions at ~15fps — lightweight, no per-element listeners needed
  useEffect(() => {
    const poll = () => {
      setTrackTimes(() => {
        const next: Record<string, { currentTime: number; duration: number }> = {}
        audioElsRef.current.forEach((el, id) => {
          next[id] = { currentTime: el.currentTime, duration: isFinite(el.duration) ? el.duration : 0 }
        })
        return next
      })
      rafRef.current = requestAnimationFrame(poll)
    }
    rafRef.current = requestAnimationFrame(poll)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

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
        // If recording and track isn't yet wired into context, connect it now.
        // bgVolume=1.0 because element.volume already carries the user's level.
        if (recorder.recording) {
          recorder.connectTrack(el, 1.0)
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

  const seekTrack = (deckId: string, t: number) => {
    const el = audioElsRef.current.get(deckId)
    if (el) el.currentTime = t
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

    // createMediaElementSource() permanently binds an <audio> element to an AudioContext.
    // After stop() closes the context, we must recreate elements fresh so the new context
    // can claim them — otherwise the try/catch in useAudio silently skips them (mic-only recording).
    const activeEls: HTMLAudioElement[] = []

    setDeck(prev => prev.map(t => {
      // Destroy old element (unbind from dead context)
      const old = audioElsRef.current.get(t.id)
      if (old) { old.pause(); old.src = '' }

      // Create fresh element with same settings
      const el = new Audio()
      el.src = `/api/tracks/${t.trackId.split('/').map(encodeURIComponent).join('/')}`
      el.loop = true
      el.volume = t.vol
      audioElsRef.current.set(t.id, el)

      if (t.playing) {
        el.play().catch(() => {})
        activeEls.push(el)
      }

      return { ...t, audioEl: el }
    }))

    // Small delay so elements can begin buffering
    await new Promise(r => setTimeout(r, 80))

    // Use individual element volumes; bgVolume=1.0 so gain node is transparent
    await recorder.start(activeEls, 1.0, micVol, recQuality, audioProcessing)
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

  const handleAddToLibrary = async () => {
    if (!savedFilename) return
    setAddingToLib(true)
    try {
      const res = await apiFetch(`/api/recordings/${encodeURIComponent(savedFilename)}/add-to-library`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder: 'My Recordings' }),
      })
      const data = await res.json()
      if (data.ok) { setAddedToLib(true) }
    } catch {}
    setAddingToLib(false)
  }

  const handleDiscard = () => {
    if (lastUrl) URL.revokeObjectURL(lastUrl)
    setLastBlob(null); setLastUrl(null); setSaveMsg(null); setSavedFilename(null)
    setAddedToLib(false)
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
                currentTime={trackTimes[t.id]?.currentTime ?? 0}
                duration={trackTimes[t.id]?.duration ?? 0}
                onPlay={playTrack}
                onPause={pauseTrack}
                onStop={stopTrack}
                onVol={setVol}
                onSeek={seekTrack}
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

        {/* ── MIC VOLUME + AUDIO PROCESSING ── */}
        <div className="card" style={{ marginBottom: 0, padding: '10px 14px' }}>
          <div className="vol-row" style={{ marginBottom: 0 }}>
            <span className="vol-label" style={{ fontSize: 11 }}>🎙 My voice</span>
            <input type="range" min={0} max={1} step={0.02}
              value={micVol} onChange={e => setMicVol(parseFloat(e.target.value))} />
            <span className="vol-value">{Math.round(micVol * 100)}%</span>
          </div>
          <AudioProcessingDrawer
            proc={audioProcessing}
            onChange={onUpdateAudioProcessing}
          />
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
              {savedFilename && !saving && !transcribing && (
                <button
                  className="btn btn-ghost btn-sm"
                  title="Add to Music Library"
                  onClick={handleAddToLibrary}
                  disabled={addingToLib || addedToLib}
                  style={addedToLib ? { color: 'var(--success)' } : undefined}
                >
                  {addingToLib ? '⏳' : addedToLib ? '✓ In Library' : '🎵+ Library'}
                </button>
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
