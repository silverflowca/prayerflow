import { useRef, useState, useCallback, useEffect } from 'react'
import type { RecordingQuality, AudioProcessing } from './useSettings'
import { AUDIO_PROCESSING_DEFAULTS } from './useSettings'

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

// ── Mixed recorder: mic + multiple audio elements → one track ──────
export function useRecorder() {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const audioCtxRef = useRef<AudioContext | null>(null)
  const destRef = useRef<MediaStreamAudioDestinationNode | null>(null)
  // Store all connected audio elements so pause/resume can control them
  const bgAudioEls = useRef<HTMLAudioElement[]>([])
  const [recording, setRecording] = useState(false)
  const [paused, setPaused] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [amplitude, setAmplitude] = useState(0)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animFrameRef = useRef<number>(0)

  /**
   * start(bgAudioEls?, bgVolume?, micVolume?, quality?)
   *   bgAudioEls — one or more <audio> elements to mix into the recording
   *   bgVolume   — 0..1 gain applied to ALL bg tracks
   *   micVolume  — 0..1 gain for the mic
   *   quality    — RecordingQuality from settings
   */
  const start = useCallback(async (
    bgElements: HTMLAudioElement[] = [],
    bgVolume = 0.7,
    micVolume = 1.0,
    quality?: RecordingQuality,
    audioProc: AudioProcessing = AUDIO_PROCESSING_DEFAULTS,
  ) => {
    const sampleRate  = quality?.sampleRate  ?? 48000
    const channels    = quality?.channels    ?? 1
    const bitrate     = quality?.bitrate     ?? 192
    setError(null)
    setPaused(false)
    try {
      bgAudioEls.current = bgElements

      // 1. Get microphone
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate,
          channelCount: channels,
        },
      })

      // 2. Create AudioContext
      const ctx = new AudioContext({ sampleRate })
      audioCtxRef.current = ctx
      if (ctx.state === 'suspended') await ctx.resume()

      // 3. Recording destination
      const dest = ctx.createMediaStreamDestination()
      destRef.current = dest

      // 4. Mic → gain → compressor → dest
      const micSource = ctx.createMediaStreamSource(micStream)
      const micGain = ctx.createGain()
      micGain.gain.value = micVolume

      // Optional high-shelf cut to remove mic hiss
      const hissFilter = ctx.createBiquadFilter()
      hissFilter.type = 'highshelf'
      hissFilter.frequency.value = audioProc.hissFreq ?? 8000
      hissFilter.gain.value      = audioProc.hissFilter ? (audioProc.hissGain ?? -18) : 0

      micSource.connect(micGain)
      micGain.connect(hissFilter)

      if (audioProc.enabled) {
        const compressor = ctx.createDynamicsCompressor()
        compressor.threshold.value = audioProc.threshold
        compressor.knee.value      = audioProc.knee
        compressor.ratio.value     = audioProc.ratio
        compressor.attack.value    = audioProc.attack  / 1000  // ms → s
        compressor.release.value   = audioProc.release / 1000  // ms → s
        hissFilter.connect(compressor)
        compressor.connect(dest)
      } else {
        hissFilter.connect(dest)
      }

      // 5. Each bg audio element → gain → dest + speakers
      for (const el of bgElements) {
        if (!el || !el.src) continue
        try {
          const bgSource = ctx.createMediaElementSource(el)
          const bgGain = ctx.createGain()
          bgGain.gain.value = bgVolume
          bgSource.connect(bgGain)
          bgGain.connect(dest)
          bgGain.connect(ctx.destination)
        } catch {
          // Already connected to this context — skip
        }
      }

      // 6. Analyser on mixed output for waveform
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.7
      const analyserSource = ctx.createMediaStreamSource(dest.stream)
      analyserSource.connect(analyser)
      analyserRef.current = analyser

      // 7. Record
      const preferredTypes = [
        'audio/mp4;codecs=mp4a.40.2',
        'audio/mp4',
        'audio/webm;codecs=opus',
        'audio/webm',
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

  // Connect a new audio element into the active AudioContext mid-recording
  const connectTrack = useCallback((el: HTMLAudioElement, bgVolume: number) => {
    const ctx = audioCtxRef.current
    const dest = destRef.current
    if (!ctx || !dest) return
    try {
      const bgSource = ctx.createMediaElementSource(el)
      const bgGain = ctx.createGain()
      bgGain.gain.value = bgVolume
      bgSource.connect(bgGain)
      bgGain.connect(dest)           // → recorder stream (captured in recording)
      bgGain.connect(ctx.destination) // → speakers
      bgAudioEls.current.push(el)
    } catch {
      // Already connected to this context — skip
    }
  }, [])

  const pause = useCallback(() => {
    const mr = mediaRecorderRef.current
    if (!mr || mr.state !== 'recording') return
    mr.pause()
    bgAudioEls.current.forEach(el => el.pause())
    setPaused(true)
    setAmplitude(0)
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    cancelAnimationFrame(animFrameRef.current)
  }, [])

  const resume = useCallback(() => {
    const mr = mediaRecorderRef.current
    if (!mr || mr.state !== 'paused') return
    mr.resume()
    bgAudioEls.current.forEach(el => el.play().catch(() => {}))
    setPaused(false)
    timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000)
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
        audioCtxRef.current?.close()
        audioCtxRef.current = null
        destRef.current = null
        resolve(blob)
      }
      mr.stop()
      mr.stream.getTracks().forEach(t => t.stop())
      bgAudioEls.current = []
      setRecording(false)
      setPaused(false)
      setAmplitude(0)
      cancelAnimationFrame(animFrameRef.current)
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    })
  }, [])

  return { recording, paused, seconds, amplitude, error, start, pause, resume, stop, connectTrack } as const
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
