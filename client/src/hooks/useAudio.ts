import { useRef, useState, useCallback, useEffect } from 'react'
import type { RecordingQuality } from './useSettings'

export function useAudioPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(0.7)

  useEffect(() => {
    const el = audioRef.current
    if (!el) return
    const onTime = () => setCurrentTime(el.currentTime)
    const onDur  = () => setDuration(el.duration || 0)
    const onEnd  = () => setPlaying(false)
    el.addEventListener('timeupdate', onTime)
    el.addEventListener('loadedmetadata', onDur)
    el.addEventListener('ended', onEnd)
    return () => {
      el.removeEventListener('timeupdate', onTime)
      el.removeEventListener('loadedmetadata', onDur)
      el.removeEventListener('ended', onEnd)
    }
  }, [])

  const load = useCallback((url: string) => {
    const el = audioRef.current
    if (!el) return
    el.pause()
    el.src = url
    el.volume = volume
    el.load()
    setCurrentTime(0)
    setDuration(0)
    setPlaying(false)
  }, [volume])

  const play = useCallback(() => {
    audioRef.current?.play().then(() => setPlaying(true)).catch(() => {})
  }, [])

  const pause = useCallback(() => {
    audioRef.current?.pause()
    setPlaying(false)
  }, [])

  const toggle = useCallback(() => {
    playing ? pause() : play()
  }, [playing, play, pause])

  const stop = useCallback(() => {
    const el = audioRef.current
    if (!el) return
    el.pause()
    el.currentTime = 0
    setPlaying(false)
    setCurrentTime(0)
  }, [])

  const seek = useCallback((t: number) => {
    const el = audioRef.current
    if (!el) return
    el.currentTime = t
    setCurrentTime(t)
  }, [])

  const changeVolume = useCallback((v: number) => {
    setVolume(v)
    if (audioRef.current) audioRef.current.volume = v
  }, [])

  return { audioRef, playing, currentTime, duration, volume, load, play, pause, toggle, stop, seek, changeVolume }
}

// ── Mixed recorder: mic + audio element → one track ──────
export function useRecorder() {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const audioCtxRef = useRef<AudioContext | null>(null)
  const bgAudioRef = useRef<HTMLAudioElement | null>(null)
  const [recording, setRecording] = useState(false)
  const [paused, setPaused] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [amplitude, setAmplitude] = useState(0)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animFrameRef = useRef<number>(0)

  /**
   * start(bgAudioEl?, bgVolume?, micVolume?, quality?)
   *   bgAudioEl — the <audio> element playing the background music
   *   bgVolume  — 0..1 gain for the music in the mix
   *   micVolume — 0..1 gain for the mic in the mix
   *   quality   — RecordingQuality from settings
   *
   * Uses Web Audio API to merge mic + music into a single MediaStream,
   * then records that with MediaRecorder so both end up in one file.
   */
  const start = useCallback(async (
    bgAudioEl?: HTMLAudioElement | null,
    bgVolume = 0.7,
    micVolume = 1.0,
    quality?: RecordingQuality,
  ) => {
    const sampleRate  = quality?.sampleRate  ?? 48000
    const channels    = quality?.channels    ?? 1
    const bitrate     = quality?.bitrate     ?? 192
    setError(null)
    setPaused(false)
    try {
      bgAudioRef.current = bgAudioEl ?? null

      // 1. Get microphone — request highest quality possible
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,   // off — degrades voice quality for music recording
          noiseSuppression: false,   // off — would cut out quiet phrases
          autoGainControl: false,    // off — causes volume pumping / dropouts
          sampleRate,
          channelCount: channels,
        },
      })

      // 2. Create AudioContext to match mic settings
      const ctx = new AudioContext({ sampleRate })
      audioCtxRef.current = ctx

      // Resume context immediately (some browsers start it suspended)
      if (ctx.state === 'suspended') await ctx.resume()

      // 3. Destination — this is what we record
      const dest = ctx.createMediaStreamDestination()

      // 4. Mic → gain → compressor → dest
      //    DynamicsCompressor evens out the voice so it stays audible
      //    throughout the recording without getting lost under the music.
      const micSource = ctx.createMediaStreamSource(micStream)
      const micGain = ctx.createGain()
      micGain.gain.value = micVolume * 1.5   // slight boost so voice cuts through

      const compressor = ctx.createDynamicsCompressor()
      compressor.threshold.value = -24   // start compressing at -24 dBFS
      compressor.knee.value = 10
      compressor.ratio.value = 4         // 4:1 ratio — gentle, transparent
      compressor.attack.value = 0.003    // 3 ms — catches transients fast
      compressor.release.value = 0.25   // 250 ms — smooth release

      micSource.connect(micGain)
      micGain.connect(compressor)
      compressor.connect(dest)

      // 5. Background music → gain → dest  (if an audio element is playing)
      if (bgAudioEl && bgAudioEl.src) {
        try {
          const bgSource = ctx.createMediaElementSource(bgAudioEl)
          const bgGain = ctx.createGain()
          bgGain.gain.value = bgVolume
          bgSource.connect(bgGain)
          bgGain.connect(dest)
          // Also route music to speakers so you can hear it while recording
          bgGain.connect(ctx.destination)
        } catch {
          // Element already connected to this context — reconnect not needed
        }
      }

      // 6. Analyser on the mixed output for the waveform
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.7
      const analyserSource = ctx.createMediaStreamSource(dest.stream)
      analyserSource.connect(analyser)
      analyserRef.current = analyser

      // 7. Record the mixed stream
      // Prefer MP4/AAC (works on iOS Safari) — fall back to WebM/Opus (Chrome/Firefox)
      const preferredTypes = [
        'audio/mp4;codecs=mp4a.40.2', // AAC-LC in MP4 — iOS Safari ✓
        'audio/mp4',                   // MP4 generic — iOS Safari ✓
        'audio/webm;codecs=opus',      // Opus in WebM — Chrome/Firefox/Android ✓
        'audio/webm',                  // WebM generic
      ]
      const mimeType = preferredTypes.find(t => MediaRecorder.isTypeSupported(t)) ?? ''
      const mr = new MediaRecorder(dest.stream, {
        ...(mimeType ? { mimeType } : {}),
        audioBitsPerSecond: bitrate * 1000,
      })
      chunksRef.current = []
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.start(100)
      mediaRecorderRef.current = mr

      setRecording(true)
      setSeconds(0)
      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000)

      // Animate waveform
      const data = new Uint8Array(analyser.frequencyBinCount)
      const tick = () => {
        analyser.getByteFrequencyData(data)
        const avg = data.reduce((a, b) => a + b, 0) / data.length
        setAmplitude(avg / 128)
        animFrameRef.current = requestAnimationFrame(tick)
      }
      tick()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Microphone access denied')
    }
  }, [])

  const pause = useCallback(() => {
    const mr = mediaRecorderRef.current
    if (!mr || mr.state !== 'recording') return
    mr.pause()
    // Pause background music too
    bgAudioRef.current?.pause()
    setPaused(true)
    setAmplitude(0)
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    cancelAnimationFrame(animFrameRef.current)
  }, [])

  const resume = useCallback(() => {
    const mr = mediaRecorderRef.current
    if (!mr || mr.state !== 'paused') return
    mr.resume()
    // Resume background music
    bgAudioRef.current?.play().catch(() => {})
    setPaused(false)
    timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000)
    // Restart waveform animation
    const analyser = analyserRef.current
    if (analyser) {
      const data = new Uint8Array(analyser.frequencyBinCount)
      const tick = () => {
        analyser.getByteFrequencyData(data)
        const avg = data.reduce((a, b) => a + b, 0) / data.length
        setAmplitude(avg / 128)
        animFrameRef.current = requestAnimationFrame(tick)
      }
      tick()
    }
  }, [])

  const stop = useCallback((): Promise<Blob> => {
    return new Promise((resolve) => {
      const mr = mediaRecorderRef.current
      if (!mr) { resolve(new Blob()); return }
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        // Close the AudioContext to free resources
        audioCtxRef.current?.close()
        audioCtxRef.current = null
        resolve(blob)
      }
      mr.stop()
      mr.stream.getTracks().forEach(t => t.stop())
      setRecording(false)
      setPaused(false)
      setAmplitude(0)
      cancelAnimationFrame(animFrameRef.current)
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    })
  }, [])

  return { recording, paused, seconds, amplitude, error, start, pause, resume, stop }
}

export function fmt(s: number): string {
  if (!isFinite(s)) return '0:00'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

export function fmtBytes(b: number): string {
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / 1024 / 1024).toFixed(1)} MB`
}
