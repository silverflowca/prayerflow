import { useEffect, useRef, useState, useCallback } from 'react'
import { fmt } from '../hooks/useAudio'

interface Word {
  word: string
  punctuated_word: string
  start: number
  end: number
  confidence: number
}

interface Utterance {
  start: number
  end: number
  transcript: string
  words: Word[]
}

interface Transcript {
  filename: string
  transcript: string
  duration: number
  words: Word[]
  utterances: Utterance[]
  createdAt: string
}

interface Props {
  filename: string
  onBack: () => void
  apiFetch: (input: RequestInfo, init?: RequestInit) => Promise<Response>
}

export function LyricsView({ filename, onBack, apiFetch }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [transcript, setTranscript] = useState<Transcript | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [transcribing, setTranscribing] = useState(false)

  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [volume, setVolume] = useState(1)

  // Index of the currently active word
  const [activeWordIdx, setActiveWordIdx] = useState(-1)
  // Index of the currently active utterance (line)
  const [activeLineIdx, setActiveLineIdx] = useState(-1)

  const wordRefs = useRef<(HTMLSpanElement | null)[]>([])
  const lineRefs = useRef<(HTMLDivElement | null)[]>([])
  const lyricsScrollRef = useRef<HTMLDivElement | null>(null)

  // Load transcript on mount
  useEffect(() => {
    apiFetch(`/api/transcripts/${encodeURIComponent(filename)}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d && d.words) setTranscript(d)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [filename])

  // Load audio as blob (needs auth header) then attach to element
  useEffect(() => {
    let blobUrl: string | null = null
    apiFetch(`/api/recordings/${encodeURIComponent(filename)}`)
      .then(r => r.blob())
      .then(blob => {
        blobUrl = URL.createObjectURL(blob)
        if (audioRef.current) audioRef.current.src = blobUrl
      })
      .catch(() => {})
    return () => { if (blobUrl) URL.revokeObjectURL(blobUrl) }
  }, [filename])

  // Audio time tracking
  useEffect(() => {
    const el = audioRef.current
    if (!el) return
    const onTime = () => {
      const t = el.currentTime
      setCurrentTime(t)

      // Find active word
      if (transcript) {
        let wi = -1
        for (let i = 0; i < transcript.words.length; i++) {
          const w = transcript.words[i]
          if (t >= w.start && t <= w.end) { wi = i; break }
          if (t >= w.start) wi = i // last word before cursor
        }
        setActiveWordIdx(wi)

        // Find active utterance (line)
        let li = -1
        for (let i = 0; i < transcript.utterances.length; i++) {
          const u = transcript.utterances[i]
          if (t >= u.start && t <= u.end) { li = i; break }
          if (t >= u.start) li = i
        }
        if (li !== activeLineIdx) setActiveLineIdx(li)
      }
    }
    const onDur  = () => setDuration(el.duration || 0)
    const onEnd  = () => { setPlaying(false) }
    el.addEventListener('timeupdate', onTime)
    el.addEventListener('loadedmetadata', onDur)
    el.addEventListener('ended', onEnd)
    return () => {
      el.removeEventListener('timeupdate', onTime)
      el.removeEventListener('loadedmetadata', onDur)
      el.removeEventListener('ended', onEnd)
    }
  }, [transcript, filename])

  // Auto-scroll active line into view
  useEffect(() => {
    if (activeLineIdx < 0) return
    const el = lineRefs.current[activeLineIdx]
    if (el && lyricsScrollRef.current) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [activeLineIdx])

  const togglePlay = useCallback(() => {
    const el = audioRef.current
    if (!el) return
    if (playing) { el.pause(); setPlaying(false) }
    else { el.play().then(() => setPlaying(true)).catch(() => {}) }
  }, [playing])

  const seek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = audioRef.current
    if (!el) return
    const r = e.currentTarget.getBoundingClientRect()
    el.currentTime = ((e.clientX - r.left) / r.width) * duration
  }, [duration])

  const seekToWord = useCallback((start: number) => {
    const el = audioRef.current
    if (!el) return
    el.currentTime = start
    el.play().then(() => setPlaying(true)).catch(() => {})
  }, [])

  const handleTranscribe = async () => {
    setTranscribing(true)
    setError(null)
    try {
      const res = await apiFetch(`/api/transcripts/${encodeURIComponent(filename)}`, { method: 'POST' })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setTranscript(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Transcription failed')
    }
    setTranscribing(false)
  }

  const pct = duration ? (currentTime / duration) * 100 : 0

  // ── Render ────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 0 }}>
      {/* Top bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 0', marginBottom: 16, borderBottom: '1px solid var(--border)',
      }}>
        <button className="btn btn-ghost btn-sm" onClick={onBack}>← Back</button>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <div style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {filename.replace(/_\d+\.webm$/, '').replace(/_/g, ' ')}
          </div>
          {transcript && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {transcript.words.length} words · {Math.round(transcript.duration)}s
              · transcribed {new Date(transcript.createdAt).toLocaleDateString()}
            </div>
          )}
        </div>
        {!transcript && !loading && (
          <button
            className="btn btn-primary btn-sm"
            onClick={handleTranscribe}
            disabled={transcribing}
          >
            {transcribing ? '⏳ Transcribing…' : '✦ Transcribe'}
          </button>
        )}
        {transcript && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={handleTranscribe}
            disabled={transcribing}
            title="Re-transcribe"
          >
            {transcribing ? '⏳' : '↻ Re-transcribe'}
          </button>
        )}
      </div>

      {error && (
        <div style={{ color: 'var(--danger)', marginBottom: 12, fontSize: 13 }}>⚠ {error}</div>
      )}

      {/* Lyrics area */}
      <div
        ref={lyricsScrollRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          paddingBottom: 120,
          paddingRight: 8,
        }}
      >
        {loading && <div className="empty">Loading transcript…</div>}

        {!loading && !transcript && !transcribing && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', height: '100%', gap: 16, paddingTop: 60,
          }}>
            <div style={{ fontSize: 48 }}>🎙</div>
            <div style={{ fontSize: 14, color: 'var(--text-muted)', textAlign: 'center', maxWidth: 340, lineHeight: 1.7 }}>
              No transcript yet. Click <strong style={{ color: 'var(--accent)' }}>✦ Transcribe</strong> to
              send this recording to Deepgram and get word-by-word timestamps.
            </div>
          </div>
        )}

        {transcribing && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', paddingTop: 60, gap: 16,
          }}>
            <div style={{ fontSize: 40, animation: 'pulse-rec 1.2s infinite' }}>⏳</div>
            <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
              Sending to Deepgram… this usually takes 5–15 seconds
            </div>
          </div>
        )}

        {transcript && transcript.utterances.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
            {transcript.utterances.map((utt, li) => {
              const isActiveLine = li === activeLineIdx
              const isPastLine = utt.end < currentTime
              return (
                <div
                  key={li}
                  ref={el => { lineRefs.current[li] = el }}
                  onClick={() => seekToWord(utt.start)}
                  style={{
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    padding: '6px 12px',
                    borderRadius: 'var(--radius)',
                    borderLeft: isActiveLine ? '3px solid var(--accent)' : '3px solid transparent',
                    background: isActiveLine ? 'rgba(122,162,247,.06)' : 'transparent',
                  }}
                >
                  {/* Line timestamp */}
                  <div style={{
                    fontSize: 10, color: 'var(--text-muted)',
                    marginBottom: 6, fontFamily: 'var(--font)',
                  }}>
                    {fmt(utt.start)}
                  </div>

                  {/* Words in this utterance */}
                  <div style={{ lineHeight: 1.9, fontSize: 18, fontWeight: 500 }}>
                    {utt.words.map((w, wi) => {
                      // Global word index
                      const globalIdx = transcript.words.findIndex(
                        gw => gw.start === w.start && gw.word === w.word
                      )
                      const isActive = globalIdx === activeWordIdx
                      const isPast   = w.end < currentTime

                      return (
                        <span
                          key={wi}
                          ref={el => { if (globalIdx >= 0) wordRefs.current[globalIdx] = el }}
                          onClick={e => { e.stopPropagation(); seekToWord(w.start) }}
                          style={{
                            display: 'inline-block',
                            marginRight: '0.35em',
                            padding: '2px 4px',
                            borderRadius: 4,
                            cursor: 'pointer',
                            transition: 'all 0.12s ease',
                            // Active word: bright accent, slightly larger
                            color: isActive ? '#fff'
                                 : isPast   ? 'var(--text)'
                                 : 'var(--text-muted)',
                            background: isActive ? 'var(--accent)' : 'transparent',
                            fontWeight: isActive ? 700 : isPast ? 500 : 400,
                            transform: isActive ? 'scale(1.08)' : 'scale(1)',
                            opacity: isPastLine && !isActiveLine ? 0.55 : 1,
                          }}
                          title={`${fmt(w.start)} – ${fmt(w.end)} (${Math.round(w.confidence * 100)}%)`}
                        >
                          {w.punctuated_word}
                        </span>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Fallback: flat word list if no utterances */}
        {transcript && transcript.utterances.length === 0 && transcript.words.length > 0 && (
          <div style={{ lineHeight: 2.1, fontSize: 17, fontWeight: 500, padding: '0 12px' }}>
            {transcript.words.map((w, i) => {
              const isActive = i === activeWordIdx
              const isPast   = w.end < currentTime
              return (
                <span
                  key={i}
                  onClick={() => seekToWord(w.start)}
                  style={{
                    display: 'inline-block', marginRight: '0.35em',
                    padding: '2px 4px', borderRadius: 4, cursor: 'pointer',
                    transition: 'all 0.12s',
                    color: isActive ? '#fff' : isPast ? 'var(--text)' : 'var(--text-muted)',
                    background: isActive ? 'var(--accent)' : 'transparent',
                    fontWeight: isActive ? 700 : 400,
                    transform: isActive ? 'scale(1.08)' : 'scale(1)',
                  }}
                >
                  {w.punctuated_word}
                </span>
              )
            })}
          </div>
        )}
      </div>

      {/* Fixed transport bar at bottom */}
      <div style={{
        borderTop: '1px solid var(--border)',
        paddingTop: 14, marginTop: 8,
        background: 'var(--bg)',
      }}>
        {/* Progress bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 36 }}>{fmt(currentTime)}</span>
          <div
            onClick={seek}
            style={{
              flex: 1, height: 6, borderRadius: 3,
              background: 'var(--surface2)', cursor: 'pointer', position: 'relative',
            }}
          >
            <div style={{
              height: '100%', borderRadius: 3,
              background: 'var(--accent)',
              width: `${pct}%`,
              transition: 'width 0.1s linear',
            }} />
          </div>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 36, textAlign: 'right' }}>{fmt(duration)}</span>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          <button
            className="btn btn-ghost"
            onClick={() => { if (audioRef.current) audioRef.current.currentTime = Math.max(0, currentTime - 5) }}
          >
            ↩ 5s
          </button>
          <button
            className="btn btn-primary"
            style={{ width: 52, height: 52, borderRadius: '50%', fontSize: 20, padding: 0, justifyContent: 'center' }}
            onClick={togglePlay}
          >
            {playing ? '⏸' : '▶'}
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => { if (audioRef.current) audioRef.current.currentTime = Math.min(duration, currentTime + 5) }}
          >
            5s ↪
          </button>
        </div>

        {/* Volume */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14 }}>
          <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>
            {volume === 0 ? '🔇' : volume < 0.5 ? '🔉' : '🔊'}
          </span>
          <input
            type="range"
            min={0} max={1} step={0.02}
            value={volume}
            onChange={e => {
              const v = Number(e.target.value)
              setVolume(v)
              if (audioRef.current) audioRef.current.volume = v
            }}
            style={{ flex: 1, accentColor: 'var(--accent)', height: 4, cursor: 'pointer' }}
          />
          <span style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 28, textAlign: 'right' }}>
            {Math.round(volume * 100)}%
          </span>
        </div>
      </div>

      <audio ref={audioRef} style={{ display: 'none' }} />
    </div>
  )
}
