// ── Per-verse recording card ──────────────────────────────────

import { useState, useRef, useEffect, useCallback } from 'react'
import { fmtRef, verseKey } from '../lib/bibleBooks'

export interface VerseRef {
  book:      string
  chapter:   number
  verse:     number
  endVerse?: number
  text?:     string
}

interface VerseRecording {
  filename:  string
  size:      number
  createdAt: string
  blobUrl?:  string
}

interface Props {
  setId:       string
  ref_:        VerseRef
  apiFetch:    (url: string, opts?: RequestInit) => Promise<Response>
  onRemoveRef: () => void
}

type RecState = 'idle' | 'recording' | 'paused' | 'review'

function fmt(s: number) {
  const m = Math.floor(s / 60)
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`
}

const MIME = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/mp4'

export function VerseRecorder({ setId, ref_, apiFetch, onRemoveRef }: Props) {
  const label = fmtRef(ref_.book, ref_.chapter, ref_.verse, ref_.endVerse)
  const key   = verseKey(ref_.book, ref_.chapter, ref_.verse, ref_.endVerse)

  const [recState,     setRecState]     = useState<RecState>('idle')
  const [seconds,      setSeconds]      = useState(0)
  const [amplitude,    setAmplitude]    = useState(0)
  const [error,        setError]        = useState<string | null>(null)
  const [uploading,    setUploading]    = useState(false)
  const [recordings,   setRecordings]   = useState<VerseRecording[]>([])
  const [loadingRecs,  setLoadingRecs]  = useState(true)
  const [playingIdx,   setPlayingIdx]   = useState<number | null>(null)
  const [transcribing, setTranscribing] = useState<string | null>(null)
  const [transcripts,  setTranscripts]  = useState<Record<string, string>>({})
  const [expanded,     setExpanded]     = useState(false)

  const mrRef       = useRef<MediaRecorder | null>(null)
  const chunksRef   = useRef<Blob[]>([])
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animRef     = useRef<number>(0)
  const audioRefs   = useRef<Map<number, HTMLAudioElement>>(new Map())

  const loadRecordings = useCallback(async () => {
    setLoadingRecs(true)
    try {
      const res  = await apiFetch(`/api/scripture/sets/${setId}/recordings`)
      const data = await res.json() as { recordings: VerseRecording[] }
      const mine = data.recordings.filter(r => r.filename.includes(`_${key}.`) || r.filename.includes(`_${key}_`))
      setRecordings(mine)
    } catch {}
    finally { setLoadingRecs(false) }
  }, [setId, key, apiFetch])

  useEffect(() => { loadRecordings() }, [loadRecordings])

  const stopAmplitude = () => { cancelAnimationFrame(animRef.current); setAmplitude(0) }

  const startRecording = async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      })
      const ctx      = new AudioContext()
      const src      = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      src.connect(analyser)
      analyserRef.current = analyser

      const mr = new MediaRecorder(stream, { mimeType: MIME, audioBitsPerSecond: 128000 })
      mrRef.current  = mr
      chunksRef.current = []
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.start(100)
      setRecState('recording')
      setSeconds(0)
      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000)

      const buf = new Uint8Array(analyser.frequencyBinCount)
      const loop = () => {
        analyser.getByteFrequencyData(buf)
        const avg = buf.reduce((a, b) => a + b, 0) / buf.length
        setAmplitude(Math.min(avg / 128, 1))
        animRef.current = requestAnimationFrame(loop)
      }
      loop()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Mic error')
    }
  }

  const stopRecording = (): Promise<Blob> => new Promise(resolve => {
    const mr = mrRef.current
    if (!mr) { resolve(new Blob()); return }
    mr.onstop = () => resolve(new Blob(chunksRef.current, { type: MIME }))
    mr.stop()
    mr.stream.getTracks().forEach(t => t.stop())
    if (timerRef.current) clearInterval(timerRef.current)
    stopAmplitude()
  })

  const handleStop = async () => {
    const blob = await stopRecording()
    setRecState('review')
    setUploading(true)
    try {
      const contentType = MIME.split(';')[0]
      const res = await apiFetch(
        `/api/scripture/sets/${setId}/recordings/${key}`,
        { method: 'POST', headers: { 'Content-Type': contentType }, body: blob }
      )
      if (!res.ok) throw new Error('Upload failed')
      await loadRecordings()
      setRecState('idle')
      setSeconds(0)
      setExpanded(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const handlePause = () => {
    mrRef.current?.pause()
    if (timerRef.current) clearInterval(timerRef.current)
    stopAmplitude()
    setRecState('paused')
  }

  const handleResume = () => {
    mrRef.current?.resume()
    timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000)
    const analyser = analyserRef.current
    if (analyser) {
      const buf = new Uint8Array(analyser.frequencyBinCount)
      const loop = () => {
        analyser.getByteFrequencyData(buf)
        const avg = buf.reduce((a, b) => a + b, 0) / buf.length
        setAmplitude(Math.min(avg / 128, 1))
        animRef.current = requestAnimationFrame(loop)
      }
      loop()
    }
    setRecState('recording')
  }

  const deleteRecording = async (filename: string) => {
    if (!confirm(`Delete this recording?`)) return
    await apiFetch(`/api/scripture/sets/${setId}/recordings/${encodeURIComponent(filename)}`, { method: 'DELETE' })
    await loadRecordings()
  }

  const playRecording = async (idx: number, filename: string) => {
    if (playingIdx === idx) {
      audioRefs.current.get(idx)?.pause()
      setPlayingIdx(null)
      return
    }
    let audio = audioRefs.current.get(idx)
    if (!audio) {
      const res  = await apiFetch(`/api/scripture/audio/${encodeURIComponent(filename)}`)
      const blob = await res.blob()
      audio = new Audio(URL.createObjectURL(blob))
      audio.onended = () => setPlayingIdx(null)
      audioRefs.current.set(idx, audio)
    }
    audio.play()
    setPlayingIdx(idx)
  }

  const transcribeRecording = async (filename: string) => {
    setTranscribing(filename)
    try {
      const res = await apiFetch(`/api/scripture/transcribe/${encodeURIComponent(filename)}`, { method: 'POST' })
      const tx  = await res.json() as { transcript?: string }
      if (tx.transcript) setTranscripts(p => ({ ...p, [filename]: tx.transcript! }))
    } catch {}
    finally { setTranscribing(null) }
  }

  // Waveform bars
  const bars = Array.from({ length: 14 }, (_, i) => {
    const phase = (i / 14) * Math.PI * 2
    return recState === 'recording'
      ? 5 + amplitude * 28 * (0.5 + 0.5 * Math.sin(phase + Date.now() / 200))
      : 5
  })

  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 14, overflow: 'hidden', marginBottom: 14,
    }}>
      {/* Verse header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '14px 18px',
        borderBottom: recordings.length > 0 || recState !== 'idle' ? '1px solid var(--border)' : 'none',
        background: 'var(--surface2)',
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent)' }}>{label}</div>
          {ref_.text && (
            <div style={{
              fontSize: 14, color: 'var(--text-muted)', marginTop: 4,
              lineHeight: 1.6, fontStyle: 'italic',
              overflow: 'hidden', display: '-webkit-box',
              WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            }}>
              "{ref_.text}"
            </div>
          )}
        </div>

        {/* Recording count badge */}
        {recordings.length > 0 && (
          <button
            onClick={() => setExpanded(e => !e)}
            style={{
              padding: '6px 14px', borderRadius: 10,
              background: 'rgba(122,162,247,.15)', border: '1px solid rgba(122,162,247,.3)',
              color: 'var(--accent)', fontSize: 14, fontWeight: 700,
              cursor: 'pointer', flexShrink: 0,
            }}
          >
            🎙 {recordings.length} {expanded ? '▲' : '▼'}
          </button>
        )}

        {/* REC button */}
        {recState === 'idle' && (
          <button
            onClick={startRecording}
            style={{
              padding: '9px 18px', borderRadius: 10, border: 'none',
              background: 'var(--danger)', color: '#fff',
              fontWeight: 700, fontSize: 15, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 8,
              flexShrink: 0,
            }}
          >
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#fff', display: 'inline-block', flexShrink: 0 }} />
            REC
          </button>
        )}

        {/* Remove verse */}
        <button
          onClick={onRemoveRef}
          title="Remove verse from set"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', fontSize: 22, lineHeight: 1, padding: '0 4px',
            flexShrink: 0,
          }}
        >×</button>
      </div>

      {/* Active recording controls */}
      {recState !== 'idle' && (
        <div style={{
          padding: '14px 18px',
          display: 'flex', alignItems: 'center', gap: 16,
          borderBottom: '1px solid var(--border)',
          background: 'rgba(247,118,142,.04)',
        }}>
          {/* Waveform */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, height: 36 }}>
            {bars.map((h, i) => (
              <div key={i} style={{
                width: 4, borderRadius: 3,
                height: recState === 'recording' ? h : 5,
                background: recState === 'recording' ? 'var(--danger)' : 'var(--text-muted)',
                transition: 'height 0.08s ease',
              }} />
            ))}
          </div>

          <div style={{
            fontSize: 20, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
            color: recState === 'recording' ? 'var(--danger)' : 'var(--text-muted)',
            minWidth: 52,
          }}>
            {fmt(seconds)}
          </div>

          <div style={{ display: 'flex', gap: 10, marginLeft: 'auto' }}>
            {recState === 'recording' && (
              <button
                onClick={handlePause}
                className="btn btn-ghost"
                style={{ fontSize: 15, padding: '8px 16px' }}
              >⏸ Pause</button>
            )}
            {recState === 'paused' && (
              <button
                onClick={handleResume}
                className="btn btn-ghost"
                style={{ fontSize: 15, padding: '8px 16px' }}
              >▶ Resume</button>
            )}
            <button
              onClick={handleStop}
              disabled={uploading}
              style={{
                padding: '8px 18px', borderRadius: 9, border: 'none',
                background: 'var(--success)', color: '#fff',
                fontWeight: 700, fontSize: 15, cursor: 'pointer',
                opacity: uploading ? 0.6 : 1,
              }}
            >
              {uploading ? 'Saving…' : '⏹ Save'}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div style={{ padding: '10px 18px', fontSize: 14, color: 'var(--danger)', background: 'rgba(247,118,142,.06)' }}>
          ⚠ {error}
        </div>
      )}

      {/* Recordings list */}
      {expanded && !loadingRecs && recordings.length > 0 && (
        <div style={{ padding: '12px 18px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {recordings.map((rec, idx) => {
            const tx             = transcripts[rec.filename]
            const isPlaying      = playingIdx === idx
            const isTranscribing = transcribing === rec.filename
            return (
              <div key={rec.filename} style={{
                background: 'var(--surface2)', border: '1px solid var(--border)',
                borderRadius: 12, padding: '12px 16px',
              }}>
                {/* Row: number · date · size · actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{
                    fontSize: 13, color: 'var(--text-muted)', fontWeight: 700,
                    background: 'var(--surface)', borderRadius: 6,
                    padding: '2px 8px', flexShrink: 0,
                  }}>
                    #{idx + 1}
                  </span>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {new Date(rec.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    {'  ·  '}{(rec.size / 1024).toFixed(0)} KB
                  </span>

                  {/* Play */}
                  <button
                    onClick={() => playRecording(idx, rec.filename)}
                    style={{
                      padding: '7px 16px', borderRadius: 8, border: 'none',
                      background: isPlaying ? 'var(--accent)' : 'var(--surface)',
                      color: isPlaying ? '#fff' : 'var(--text)',
                      cursor: 'pointer', fontSize: 15, fontWeight: 600,
                      flexShrink: 0,
                    }}
                  >{isPlaying ? '⏸' : '▶'}</button>

                  {/* Transcribe */}
                  <button
                    onClick={() => transcribeRecording(rec.filename)}
                    disabled={isTranscribing}
                    title="Transcribe"
                    style={{
                      padding: '7px 14px', borderRadius: 8,
                      border: '1px solid var(--border)',
                      background: 'transparent', color: 'var(--text-muted)',
                      cursor: 'pointer', fontSize: 13, fontWeight: 600,
                      opacity: isTranscribing ? 0.5 : 1,
                      flexShrink: 0,
                    }}
                  >{isTranscribing ? '…' : '📝 Text'}</button>

                  {/* Delete */}
                  <button
                    onClick={() => deleteRecording(rec.filename)}
                    title="Delete"
                    style={{
                      padding: '7px 10px', borderRadius: 8, border: 'none',
                      background: 'transparent', color: 'var(--danger)',
                      cursor: 'pointer', fontSize: 18, lineHeight: 1,
                      flexShrink: 0,
                    }}
                  >🗑</button>
                </div>

                {/* Transcript */}
                {tx && (
                  <div style={{
                    marginTop: 12, fontSize: 14, color: 'var(--text)',
                    lineHeight: 1.7, fontStyle: 'italic',
                    padding: '10px 14px', background: 'var(--surface)',
                    borderRadius: 8, border: '1px solid var(--border)',
                  }}>
                    "{tx}"
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
