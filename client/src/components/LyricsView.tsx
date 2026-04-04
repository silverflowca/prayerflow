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

// ── 10 Lyric Display Styles ────────────────────────────────────────────────

interface LyricStyle {
  id: string
  label: string
  emoji: string
  // Container
  fontSize: number
  lineHeight: number
  fontFamily?: string
  letterSpacing?: string
  // Active word
  activeColor: string
  activeBg: string
  activeFontWeight: number | string
  activeTransform: string
  activeTextDecoration?: string
  activeAnimation?: string
  activeFontStyle?: string
  activeTextShadow?: string
  // Past word
  pastColor: string
  pastFontWeight: number | string
  pastTextDecoration?: string
  pastOpacity?: number
  // Future word
  futureColor: string
  futureFontWeight: number | string
  futureOpacity?: number
  // Line (active)
  activeBorderLeft: string
  activeLineBg: string
}

const LYRIC_STYLES: LyricStyle[] = [
  {
    id: 'classic',
    label: 'Classic',
    emoji: '✦',
    fontSize: 18,
    lineHeight: 1.9,
    activeColor: '#fff',
    activeBg: 'var(--accent)',
    activeFontWeight: 700,
    activeTransform: 'scale(1.08)',
    pastColor: 'var(--text)',
    pastFontWeight: 500,
    futureColor: 'var(--text-muted)',
    futureFontWeight: 400,
    activeBorderLeft: '3px solid var(--accent)',
    activeLineBg: 'rgba(122,162,247,.06)',
  },
  {
    id: 'bold-glow',
    label: 'Bold Glow',
    emoji: '✨',
    fontSize: 20,
    lineHeight: 2.0,
    fontFamily: "'Inter', system-ui, sans-serif",
    activeColor: '#fff',
    activeBg: 'transparent',
    activeFontWeight: 900,
    activeTransform: 'scale(1.1)',
    activeTextShadow: '0 0 16px #7aa2f7, 0 0 32px rgba(122,162,247,0.5)',
    activeTextDecoration: 'none',
    pastColor: '#c0caf5',
    pastFontWeight: 600,
    futureColor: '#414868',
    futureFontWeight: 400,
    activeBorderLeft: '3px solid #7aa2f7',
    activeLineBg: 'rgba(122,162,247,.04)',
  },
  {
    id: 'underline',
    label: 'Underline',
    emoji: '⎁',
    fontSize: 18,
    lineHeight: 2.0,
    activeColor: '#e0e4f0',
    activeBg: 'transparent',
    activeFontWeight: 700,
    activeTransform: 'scale(1)',
    activeTextDecoration: 'underline 3px #7aa2f7',
    pastColor: '#c0caf5',
    pastFontWeight: 500,
    pastTextDecoration: 'underline 1px rgba(122,162,247,0.3)',
    futureColor: 'var(--text-muted)',
    futureFontWeight: 400,
    activeBorderLeft: '3px solid transparent',
    activeLineBg: 'transparent',
  },
  {
    id: 'flowy',
    label: 'Flowy',
    emoji: '〜',
    fontSize: 19,
    lineHeight: 2.2,
    fontFamily: "'Georgia', 'Times New Roman', serif",
    letterSpacing: '0.01em',
    activeColor: '#eda685',
    activeBg: 'transparent',
    activeFontWeight: 700,
    activeTransform: 'scale(1.05)',
    activeFontStyle: 'italic',
    activeAnimation: 'flowy-wave 1s ease-in-out infinite',
    pastColor: '#c0aaa0',
    pastFontWeight: 400,
    pastOpacity: 0.8,
    futureColor: '#565f89',
    futureFontWeight: 300,
    activeBorderLeft: '3px solid #eda685',
    activeLineBg: 'rgba(237,166,133,.05)',
  },
  {
    id: 'neon',
    label: 'Neon',
    emoji: '⚡',
    fontSize: 18,
    lineHeight: 1.9,
    fontFamily: "'JetBrains Mono', monospace",
    letterSpacing: '0.05em',
    activeColor: '#7dcfff',
    activeBg: 'transparent',
    activeFontWeight: 700,
    activeTransform: 'scale(1.06)',
    activeTextShadow: '0 0 8px #7dcfff, 0 0 20px rgba(125,207,255,0.6)',
    pastColor: '#9ece6a',
    pastFontWeight: 500,
    pastTextDecoration: 'none',
    futureColor: '#2f3354',
    futureFontWeight: 400,
    activeBorderLeft: '3px solid #7dcfff',
    activeLineBg: 'rgba(125,207,255,.04)',
  },
  {
    id: 'warm-highlight',
    label: 'Warm Hi',
    emoji: '🔆',
    fontSize: 18,
    lineHeight: 2.0,
    activeColor: '#1a1b26',
    activeBg: '#e0af68',
    activeFontWeight: 800,
    activeTransform: 'scale(1.05)',
    pastColor: '#c0caf5',
    pastFontWeight: 500,
    futureColor: '#414868',
    futureFontWeight: 400,
    activeBorderLeft: '3px solid #e0af68',
    activeLineBg: 'rgba(224,175,104,.06)',
  },
  {
    id: 'minimal',
    label: 'Minimal',
    emoji: '—',
    fontSize: 17,
    lineHeight: 2.1,
    fontFamily: "'Inter', system-ui, sans-serif",
    letterSpacing: '-0.01em',
    activeColor: '#e0e4f0',
    activeBg: 'transparent',
    activeFontWeight: 600,
    activeTransform: 'scale(1)',
    pastColor: '#9099b8',
    pastFontWeight: 400,
    futureColor: '#3d4166',
    futureFontWeight: 400,
    futureOpacity: 0.6,
    activeBorderLeft: '2px solid #565f89',
    activeLineBg: 'transparent',
  },
  {
    id: 'purple-dream',
    label: 'Purple',
    emoji: '💜',
    fontSize: 19,
    lineHeight: 2.0,
    activeColor: '#fff',
    activeBg: '#bb9af7',
    activeFontWeight: 700,
    activeTransform: 'scale(1.07)',
    activeTextShadow: '0 2px 8px rgba(187,154,247,0.4)',
    pastColor: '#cdb8f7',
    pastFontWeight: 500,
    futureColor: '#4a3d6b',
    futureFontWeight: 400,
    activeBorderLeft: '3px solid #bb9af7',
    activeLineBg: 'rgba(187,154,247,.06)',
  },
  {
    id: 'green-life',
    label: 'Green',
    emoji: '🌿',
    fontSize: 18,
    lineHeight: 2.0,
    fontFamily: "'Georgia', serif",
    activeColor: '#1a2614',
    activeBg: '#9ece6a',
    activeFontWeight: 700,
    activeTransform: 'scale(1.06)',
    pastColor: '#9ece6a',
    pastFontWeight: 500,
    pastOpacity: 0.85,
    futureColor: '#2d4a1e',
    futureFontWeight: 400,
    activeBorderLeft: '3px solid #9ece6a',
    activeLineBg: 'rgba(158,206,106,.05)',
  },
  {
    id: 'outline',
    label: 'Outline',
    emoji: '□',
    fontSize: 18,
    lineHeight: 2.0,
    fontFamily: "'Inter', system-ui, sans-serif",
    letterSpacing: '0.02em',
    activeColor: '#7aa2f7',
    activeBg: 'transparent',
    activeFontWeight: 800,
    activeTransform: 'scale(1.05)',
    activeTextDecoration: 'none',
    // Outline via border on the span
    pastColor: '#c0caf5',
    pastFontWeight: 500,
    futureColor: '#414868',
    futureFontWeight: 400,
    activeBorderLeft: '3px solid #7aa2f7',
    activeLineBg: 'transparent',
  },
]

const STYLE_KEY = 'pf_lyric_style'

function getStyle(): LyricStyle {
  const id = localStorage.getItem(STYLE_KEY) || 'classic'
  return LYRIC_STYLES.find(s => s.id === id) || LYRIC_STYLES[0]
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

  const [activeWordIdx, setActiveWordIdx] = useState(-1)
  const [activeLineIdx, setActiveLineIdx] = useState(-1)

  const [style, setStyleState] = useState<LyricStyle>(getStyle)
  const [showStylePicker, setShowStylePicker] = useState(false)

  const wordRefs = useRef<(HTMLSpanElement | null)[]>([])
  const lineRefs = useRef<(HTMLDivElement | null)[]>([])
  const lyricsScrollRef = useRef<HTMLDivElement | null>(null)

  const changeStyle = (s: LyricStyle) => {
    setStyleState(s)
    localStorage.setItem(STYLE_KEY, s.id)
    setShowStylePicker(false)
  }

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

      if (transcript) {
        let wi = -1
        for (let i = 0; i < transcript.words.length; i++) {
          const w = transcript.words[i]
          if (t >= w.start && t <= w.end) { wi = i; break }
          if (t >= w.start) wi = i
        }
        setActiveWordIdx(wi)

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

  // Word style helper
  const wordStyle = (isActive: boolean, isPast: boolean, isActiveLine: boolean): React.CSSProperties => {
    const s = style
    return {
      display: 'inline-block',
      marginRight: '0.35em',
      padding: s.id === 'outline' && isActive ? '1px 5px' : '2px 4px',
      borderRadius: s.id === 'outline' && isActive ? 4 : 4,
      cursor: 'pointer',
      transition: 'all 0.12s ease',
      color: isActive ? s.activeColor : isPast ? s.pastColor : s.futureColor,
      background: isActive ? s.activeBg : 'transparent',
      fontWeight: isActive ? s.activeFontWeight : isPast ? s.pastFontWeight : s.futureFontWeight,
      transform: isActive ? s.activeTransform : 'scale(1)',
      textDecoration: isActive && s.activeTextDecoration
        ? s.activeTextDecoration
        : !isActive && isPast && s.pastTextDecoration
        ? s.pastTextDecoration
        : 'none',
      fontStyle: isActive && s.activeFontStyle ? s.activeFontStyle : 'normal',
      textShadow: isActive && s.activeTextShadow ? s.activeTextShadow : 'none',
      animation: isActive && s.activeAnimation ? s.activeAnimation : 'none',
      opacity: !isActiveLine && isPast && s.pastOpacity != null
        ? s.pastOpacity
        : isActive ? 1
        : !isPast && s.futureOpacity != null ? s.futureOpacity : 1,
      // Outline style: box-shadow border when active
      boxShadow: s.id === 'outline' && isActive ? 'inset 0 0 0 2px #7aa2f7' : 'none',
      fontFamily: s.fontFamily,
      letterSpacing: s.letterSpacing,
    }
  }

  // ── Render ────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 0 }}>
      {/* Flowy animation keyframes injected via style tag */}
      <style>{`
        @keyframes flowy-wave {
          0%, 100% { transform: translateY(0) scale(1.05); }
          50% { transform: translateY(-3px) scale(1.07); }
        }
      `}</style>

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

      {/* Style picker toolbar */}
      <div style={{ position: 'relative', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginRight: 2 }}>Style:</span>
          {LYRIC_STYLES.map(s => (
            <button
              key={s.id}
              onClick={() => changeStyle(s)}
              title={s.label}
              style={{
                background: style.id === s.id ? 'var(--accent)' : 'var(--surface2)',
                border: `1px solid ${style.id === s.id ? 'var(--accent)' : 'var(--border)'}`,
                color: style.id === s.id ? '#1a1b26' : 'var(--text-muted)',
                borderRadius: 6,
                padding: '3px 8px',
                fontSize: 11,
                cursor: 'pointer',
                fontWeight: style.id === s.id ? 700 : 400,
                transition: 'all 0.15s',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <span>{s.emoji}</span>
              <span>{s.label}</span>
            </button>
          ))}
        </div>
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
                    borderLeft: isActiveLine ? style.activeBorderLeft : '3px solid transparent',
                    background: isActiveLine ? style.activeLineBg : 'transparent',
                  }}
                >
                  <div style={{
                    fontSize: 10, color: 'var(--text-muted)',
                    marginBottom: 6, fontFamily: 'var(--font)',
                  }}>
                    {fmt(utt.start)}
                  </div>

                  <div style={{
                    lineHeight: style.lineHeight,
                    fontSize: style.fontSize,
                    fontFamily: style.fontFamily || 'inherit',
                    letterSpacing: style.letterSpacing,
                  }}>
                    {utt.words.map((w, wi) => {
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
                          style={wordStyle(isActive, isPast, isActiveLine)}
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
          <div style={{
            lineHeight: style.lineHeight,
            fontSize: style.fontSize,
            fontFamily: style.fontFamily || 'inherit',
            letterSpacing: style.letterSpacing,
            padding: '0 12px',
          }}>
            {transcript.words.map((w, i) => {
              const isActive = i === activeWordIdx
              const isPast   = w.end < currentTime
              return (
                <span
                  key={i}
                  onClick={() => seekToWord(w.start)}
                  style={wordStyle(isActive, isPast, false)}
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
