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
}

const API = (import.meta as any).env?.VITE_API_URL || ''

export function SharePage({ filename }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [transcript, setTranscript] = useState<Transcript | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [activeWordIdx, setActiveWordIdx] = useState(-1)
  const [activeLineIdx, setActiveLineIdx] = useState(-1)
  const lineRefs = useRef<(HTMLDivElement | null)[]>([])
  const lyricsScrollRef = useRef<HTMLDivElement | null>(null)
  const [volume, setVolume] = useState(1)
  const [copied, setCopied] = useState(false)

  const displayName = filename
    .replace(/_\d+\.webm$/, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())

  useEffect(() => {
    fetch(`${API}/api/share/transcript/${encodeURIComponent(filename)}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.words) setTranscript(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [filename])

  useEffect(() => {
    const el = audioRef.current
    if (!el) return
    el.src = `${API}/api/share/audio/${encodeURIComponent(filename)}`
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
        setActiveLineIdx(li)
      }
    }
    const onDur = () => setDuration(el.duration || 0)
    const onEnd = () => setPlaying(false)
    el.addEventListener('timeupdate', onTime)
    el.addEventListener('loadedmetadata', onDur)
    el.addEventListener('ended', onEnd)
    return () => {
      el.removeEventListener('timeupdate', onTime)
      el.removeEventListener('loadedmetadata', onDur)
      el.removeEventListener('ended', onEnd)
    }
  }, [transcript, filename])

  useEffect(() => {
    if (activeLineIdx < 0) return
    lineRefs.current[activeLineIdx]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
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

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const pct = duration ? (currentTime / duration) * 100 : 0

  return (
    <div style={{
      minHeight: '100vh',
      background: '#1a1b26',
      color: '#c0caf5',
      fontFamily: "'Inter', system-ui, sans-serif",
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
    }}>
      {/* Header */}
      <div style={{
        width: '100%',
        maxWidth: 680,
        padding: '28px 24px 0',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <span style={{ fontSize: 28 }}>🙏</span>
          <span style={{ fontWeight: 700, fontSize: 18, color: '#7aa2f7', letterSpacing: '-0.3px' }}>PrayerFlow</span>
          <span style={{ marginLeft: 'auto' }}>
            <button
              onClick={copyLink}
              style={{
                background: copied ? 'rgba(158,206,106,.15)' : 'rgba(122,162,247,.12)',
                border: `1px solid ${copied ? 'rgba(158,206,106,.4)' : 'rgba(122,162,247,.3)'}`,
                color: copied ? '#9ece6a' : '#7aa2f7',
                borderRadius: 8,
                padding: '6px 14px',
                fontSize: 13,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {copied ? '✓ Copied!' : '🔗 Copy Link'}
            </button>
          </span>
        </div>

        {/* Title */}
        <div style={{ marginBottom: 8 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: '#e0e4f0' }}>{displayName}</h1>
          {transcript && (
            <div style={{ fontSize: 12, color: '#565f89', marginTop: 6 }}>
              {transcript.words.length} words · {Math.round(transcript.duration)}s
              · {new Date(transcript.createdAt).toLocaleDateString()}
            </div>
          )}
        </div>

        {/* Transport */}
        <div style={{
          background: '#24283b',
          borderRadius: 16,
          padding: '20px 24px',
          marginBottom: 28,
          border: '1px solid #2f334d',
        }}>
          {/* Progress */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <span style={{ fontSize: 11, color: '#565f89', minWidth: 36 }}>{fmt(currentTime)}</span>
            <div
              onClick={seek}
              style={{
                flex: 1, height: 6, borderRadius: 3,
                background: '#2f334d', cursor: 'pointer', position: 'relative',
              }}
            >
              <div style={{
                height: '100%', borderRadius: 3, background: '#7aa2f7',
                width: `${pct}%`, transition: 'width 0.1s linear',
              }} />
            </div>
            <span style={{ fontSize: 11, color: '#565f89', minWidth: 36, textAlign: 'right' }}>{fmt(duration)}</span>
          </div>

          {/* Controls */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
            <button
              onClick={() => { if (audioRef.current) audioRef.current.currentTime = Math.max(0, currentTime - 5) }}
              style={{ background: 'none', border: 'none', color: '#7aa2f7', cursor: 'pointer', fontSize: 14, padding: '6px 10px', borderRadius: 8 }}
            >
              ↩ 5s
            </button>
            <button
              onClick={togglePlay}
              style={{
                width: 52, height: 52, borderRadius: '50%', border: 'none',
                background: '#7aa2f7', color: '#1a1b26',
                fontSize: 20, cursor: 'pointer', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              {playing ? '⏸' : '▶'}
            </button>
            <button
              onClick={() => { if (audioRef.current) audioRef.current.currentTime = Math.min(duration, currentTime + 5) }}
              style={{ background: 'none', border: 'none', color: '#7aa2f7', cursor: 'pointer', fontSize: 14, padding: '6px 10px', borderRadius: 8 }}
            >
              5s ↪
            </button>
          </div>

          {/* Volume */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14 }}>
            <span style={{ fontSize: 14, color: '#565f89' }}>
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
              style={{ flex: 1, accentColor: '#7aa2f7', height: 4, cursor: 'pointer' }}
            />
            <span style={{ fontSize: 11, color: '#565f89', minWidth: 28, textAlign: 'right' }}>
              {Math.round(volume * 100)}%
            </span>
          </div>
        </div>
      </div>

      {/* Lyrics */}
      <div
        ref={lyricsScrollRef}
        style={{
          width: '100%', maxWidth: 680,
          padding: '0 24px 80px',
          overflowY: 'auto',
        }}
      >
        {loading && (
          <div style={{ textAlign: 'center', color: '#565f89', paddingTop: 40 }}>Loading…</div>
        )}

        {!loading && !transcript && (
          <div style={{ textAlign: 'center', color: '#565f89', paddingTop: 40, lineHeight: 1.8 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🎙</div>
            No transcript available for this recording.
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
                    padding: '6px 12px',
                    borderRadius: 10,
                    borderLeft: isActiveLine ? '3px solid #7aa2f7' : '3px solid transparent',
                    background: isActiveLine ? 'rgba(122,162,247,.06)' : 'transparent',
                    transition: 'all 0.25s',
                  }}
                >
                  <div style={{ fontSize: 10, color: '#565f89', marginBottom: 6 }}>{fmt(utt.start)}</div>
                  <div style={{ lineHeight: 1.9, fontSize: 18, fontWeight: 500 }}>
                    {utt.words.map((w, wi) => {
                      const globalIdx = transcript.words.findIndex(
                        gw => gw.start === w.start && gw.word === w.word
                      )
                      const isActive = globalIdx === activeWordIdx
                      const isPast = w.end < currentTime
                      return (
                        <span
                          key={wi}
                          onClick={e => { e.stopPropagation(); seekToWord(w.start) }}
                          style={{
                            display: 'inline-block',
                            marginRight: '0.35em',
                            padding: '2px 4px',
                            borderRadius: 4,
                            cursor: 'pointer',
                            transition: 'all 0.12s',
                            color: isActive ? '#fff' : isPast ? '#c0caf5' : '#565f89',
                            background: isActive ? '#7aa2f7' : 'transparent',
                            fontWeight: isActive ? 700 : isPast ? 500 : 400,
                            transform: isActive ? 'scale(1.08)' : 'scale(1)',
                            opacity: isPastLine && !isActiveLine ? 0.55 : 1,
                          }}
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

        {transcript && transcript.utterances.length === 0 && transcript.words.length > 0 && (
          <div style={{ lineHeight: 2.1, fontSize: 18, fontWeight: 500, padding: '0 12px' }}>
            {transcript.words.map((w, i) => {
              const isActive = i === activeWordIdx
              const isPast = w.end < currentTime
              return (
                <span
                  key={i}
                  onClick={() => seekToWord(w.start)}
                  style={{
                    display: 'inline-block', marginRight: '0.35em',
                    padding: '2px 4px', borderRadius: 4, cursor: 'pointer',
                    transition: 'all 0.12s',
                    color: isActive ? '#fff' : isPast ? '#c0caf5' : '#565f89',
                    background: isActive ? '#7aa2f7' : 'transparent',
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

      <audio ref={audioRef} style={{ display: 'none' }} />
    </div>
  )
}
