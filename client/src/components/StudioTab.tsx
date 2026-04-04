import { useEffect, useState } from 'react'
import { useAudioPlayer, useRecorder, fmt, fmtBytes } from '../hooks/useAudio'

interface Props {
  selectedTrack: string | null
  onChangeTrack: () => void
  autoTranscribe: boolean
  onOpenLyrics: (filename: string) => void
  apiFetch: (input: RequestInfo, init?: RequestInit) => Promise<Response>
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

function WaveformBars({ amplitude, bars = 32, isRec = false }: { amplitude: number; bars?: number; isRec?: boolean }) {
  return (
    <div className={`waveform-bar${amplitude > 0.05 ? ' active' : ''}`}>
      {Array.from({ length: bars }, (_, i) => {
        const phase = (i / bars) * Math.PI * 2
        const h = amplitude > 0.05
          ? Math.max(4, Math.abs(Math.sin(phase + Date.now() / 200)) * amplitude * 50)
          : 4
        return <div key={i} className={`wave-col${isRec ? ' rec' : ''}`} style={{ height: `${h}px` }} />
      })}
    </div>
  )
}

export function StudioTab({ selectedTrack, onChangeTrack, autoTranscribe, onOpenLyrics, apiFetch }: Props) {
  const bgPlayer = useAudioPlayer()
  const recorder = useRecorder()

  const [bgVol,  setBgVol]  = useState(0.5)
  const [micVol, setMicVol] = useState(1.0)

  const [recName, setRecName] = useState('scripture_reading')
  const [saving,  setSaving]  = useState(false)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)
  const [lastBlob, setLastBlob] = useState<Blob | null>(null)
  const [lastUrl,  setLastUrl]  = useState<string | null>(null)
  const [transcribing, setTranscribing] = useState(false)
  const [savedFilename, setSavedFilename] = useState<string | null>(null)

  // Re-render waveform while recording
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!recorder.recording) return
    const id = setInterval(() => setTick(t => t + 1), 60)
    return () => clearInterval(id)
  }, [recorder.recording])

  // Load background track when selection changes
  useEffect(() => {
    if (selectedTrack) {
      bgPlayer.load(`/api/tracks/${selectedTrack.split('/').map(encodeURIComponent).join('/')}`)
    }
  }, [selectedTrack])

  useEffect(() => { bgPlayer.changeVolume(bgVol) }, [bgVol])

  const handleStartRecording = async () => {
    setSaveMsg(null)
    setLastBlob(null)
    setLastUrl(null)

    // Load + play music first (if a track is selected)
    if (selectedTrack) {
      bgPlayer.load(`/api/tracks/${selectedTrack.split('/').map(encodeURIComponent).join('/')}`)
      await new Promise(r => setTimeout(r, 150))
      bgPlayer.play()
    }

    // Small delay so the audio element has time to start
    await new Promise(r => setTimeout(r, 100))

    // Pass the <audio> element so the recorder can tap into it and mix it
    await recorder.start(bgPlayer.audioRef.current, bgVol, micVol)
  }

  const handleStopRecording = async () => {
    const blob = await recorder.stop()
    bgPlayer.stop()
    setLastBlob(blob)
    setLastUrl(URL.createObjectURL(blob))
  }

  const handleSave = async () => {
    if (!lastBlob) return
    setSaving(true)
    setSaveMsg(null)
    setSavedFilename(null)
    try {
      const fd = new FormData()
      fd.append('audio', lastBlob, `${recName}.webm`)
      fd.append('name', recName)
      const res = await apiFetch('/api/recordings', { method: 'POST', body: fd })
      const json = await res.json()
      if (json.ok) {
        setSavedFilename(json.filename)
        setSaveMsg(`✓ Saved as ${json.filename} (${fmtBytes(json.size)})`)
        if (autoTranscribe) {
          setTranscribing(true)
          setSaveMsg(`✓ Saved · Transcribing…`)
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
    } catch {
      setSaveMsg('✗ Save failed')
    }
    setSaving(false)
  }

  const handleDiscard = () => {
    if (lastUrl) URL.revokeObjectURL(lastUrl)
    setLastBlob(null)
    setLastUrl(null)
    setSaveMsg(null)
  }

  return (
    <div>
      {/* Background track */}
      <div className="card mb-16">
        <div className="card-title">Background Music Track</div>
        {selectedTrack ? (
          <div className="studio-selected-track">
            <span style={{ fontSize: 20 }}>🎵</span>
            <div style={{ flex: 1 }}>
              <div className="studio-track-label">{cleanName(selectedTrack.split('/').pop() ?? selectedTrack)}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{selectedTrack}</div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={onChangeTrack}>Change track</button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0' }}>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>No track selected.</span>
            <button className="btn btn-primary btn-sm" onClick={onChangeTrack}>Browse Library →</button>
          </div>
        )}

        {selectedTrack && !recorder.recording && (
          <>
            <div className="progress-row">
              <span className="progress-time">{fmt(bgPlayer.currentTime)}</span>
              <div
                className="progress-wrap"
                onClick={e => {
                  const r = e.currentTarget.getBoundingClientRect()
                  bgPlayer.seek(((e.clientX - r.left) / r.width) * bgPlayer.duration)
                }}
              >
                <div className="progress-fill" style={{
                  width: bgPlayer.duration ? `${(bgPlayer.currentTime / bgPlayer.duration) * 100}%` : '0%',
                }} />
              </div>
              <span className="progress-time">{fmt(bgPlayer.duration)}</span>
            </div>
            <div className="transport">
              <div className="transport-group">
                <button className="btn btn-ghost btn-sm" onClick={bgPlayer.stop}>⏹</button>
                <button className="btn btn-primary btn-sm" onClick={bgPlayer.toggle}>
                  {bgPlayer.playing ? '⏸ Pause' : '▶ Preview'}
                </button>
              </div>
            </div>
          </>
        )}

        {recorder.recording && (
          <div style={{ fontSize: 12, color: 'var(--cyan)', padding: '6px 0' }}>
            🎵 Music is playing and being mixed into your recording
          </div>
        )}

        <audio ref={bgPlayer.audioRef} style={{ display: 'none' }} loop />
      </div>

      {/* Mix levels */}
      <div className="card mb-16">
        <div className="card-title">Mix Levels</div>
        <div className="vol-row">
          <span className="vol-label">🎵 Music</span>
          <input type="range" min={0} max={1} step={0.02}
            value={bgVol} onChange={e => setBgVol(parseFloat(e.target.value))} />
          <span className="vol-value">{Math.round(bgVol * 100)}%</span>
        </div>
        <div className="vol-row" style={{ marginBottom: 0 }}>
          <span className="vol-label">🎙 My voice</span>
          <input type="range" min={0} max={1} step={0.02}
            value={micVol} onChange={e => setMicVol(parseFloat(e.target.value))} />
          <span className="vol-value">{Math.round(micVol * 100)}%</span>
        </div>
      </div>

      {/* Recording */}
      <div className="card mb-16">
        <div className="card-title">Voice Recording</div>

        {recorder.error && (
          <div style={{ color: 'var(--danger)', marginBottom: 12, fontSize: 13 }}>
            ⚠ {recorder.error}
          </div>
        )}

        {recorder.recording && (
          <div className="rec-status">
            <div className={`rec-dot${recorder.paused ? ' paused' : ''}`} />
            <div className="rec-timer">{fmt(recorder.seconds)}</div>
            <span style={{ fontSize: 13, color: recorder.paused ? 'var(--text-muted)' : 'var(--text-muted)' }}>
              {recorder.paused ? 'Paused — click Resume to continue' : 'Recording — mic + music mixed together'}
            </span>
          </div>
        )}

        <WaveformBars amplitude={recorder.amplitude} isRec={recorder.recording} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>Session name</span>
          <input
            style={{
              background: 'var(--bg)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius)', color: 'var(--text)',
              fontSize: 13, fontFamily: 'var(--font)', padding: '6px 10px',
              outline: 'none', flex: 1,
            }}
            value={recName}
            onChange={e => setRecName(e.target.value)}
            disabled={recorder.recording}
            placeholder="e.g. psalm_23_reading"
          />
        </div>

        <div className="transport">
          {!recorder.recording ? (
            <button
              className="btn btn-rec"
              onClick={handleStartRecording}
              disabled={saving}
              style={{ fontSize: 15, padding: '10px 24px' }}
            >
              ⏺ Start Recording
            </button>
          ) : (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              {recorder.paused ? (
                <button
                  className="btn btn-primary"
                  onClick={recorder.resume}
                  style={{ fontSize: 15, padding: '10px 24px' }}
                >
                  ▶ Resume
                </button>
              ) : (
                <button
                  className="btn btn-ghost"
                  onClick={recorder.pause}
                  style={{ fontSize: 15, padding: '10px 20px' }}
                >
                  ⏸ Pause
                </button>
              )}
              <button
                className="btn btn-rec recording"
                onClick={handleStopRecording}
                style={{ fontSize: 15, padding: '10px 24px' }}
              >
                ⏹ Stop
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Last take */}
      {lastUrl && (
        <div className="card">
          <div className="card-title">Last Take — Review & Save</div>
          <div style={{ marginBottom: 14 }}>
            <audio controls src={lastUrl} style={{ width: '100%' }} />
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
            Duration: ~{fmt(recorder.seconds)} · Format: WebM/Opus · Contains: voice + music mixed
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving || transcribing}>
              {saving ? 'Saving…' : transcribing ? '⏳ Transcribing…' : '💾 Save Recording'}
            </button>
            {savedFilename && !saving && !transcribing && (
              <button className="btn btn-ghost" onClick={() => onOpenLyrics(savedFilename)}>
                🎤 View Lyrics
              </button>
            )}
            <button className="btn btn-danger" onClick={handleDiscard} disabled={saving || transcribing}>
              🗑 Discard
            </button>
          </div>
          {saveMsg && (
            <div style={{ marginTop: 10, fontSize: 13, color: saveMsg.startsWith('✓') ? 'var(--success)' : 'var(--danger)' }}>
              {transcribing && <span style={{ marginRight: 6 }}>⏳</span>}
              {saveMsg}
            </div>
          )}
          {autoTranscribe && !savedFilename && !saving && (
            <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>
              Auto-transcribe is on — transcript will be created after saving
            </div>
          )}
        </div>
      )}

      {!selectedTrack && !recorder.recording && !lastUrl && (
        <div style={{
          padding: '20px', borderRadius: 'var(--radius)',
          background: 'rgba(122,162,247,.04)', border: '1px solid var(--border)',
          color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.7,
        }}>
          <strong style={{ color: 'var(--text)' }}>How it works:</strong>
          <ol style={{ paddingLeft: 18, marginTop: 8 }}>
            <li>Go to <strong>Music Library</strong> → pick a background track → <strong>Use →</strong></li>
            <li>Set <strong>Music</strong> and <strong>My Voice</strong> mix levels above</li>
            <li>Click <strong>Start Recording</strong> — music starts and your mic is captured together</li>
            <li>The output is a single mixed file: your voice + background music</li>
            <li>Review the take, then <strong>Save</strong> it to the Recordings tab</li>
          </ol>
        </div>
      )}
    </div>
  )
}
