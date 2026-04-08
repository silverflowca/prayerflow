import { useState, useCallback, useEffect } from 'react'

export type ColorScheme = 'apple-light' | 'tokyo-night' | 'catppuccin' | 'gruvbox' | 'dracula' | 'nord'

export type RecBitrate    = 32 | 48 | 64 | 96 | 128 | 160 | 192 | 256 | 320
export type RecChannels   = 1 | 2
export type RecSampleRate = 8000 | 16000 | 22050 | 32000 | 44100 | 48000 | 96000

export interface RecordingQuality {
  bitrate:    RecBitrate
  channels:   RecChannels
  sampleRate: RecSampleRate
}

export interface AudioProcessing {
  enabled:   boolean   // false = bypass compressor entirely (wire mic straight to dest)
  threshold: number    // dB  — default -6  (range: -60..0)
  knee:      number    // dB  — default 6   (range: 0..40)
  ratio:     number    // x:1 — default 2   (range: 1..20)
  attack:    number    // ms  — default 10  (range: 1..200)
  release:   number    // ms  — default 400 (range: 10..2000)
}

export interface AppSettings {
  autoTranscribe:   boolean
  colorScheme:      ColorScheme
  recQuality:       RecordingQuality
  audioProcessing:  AudioProcessing
}

export const AUDIO_PROCESSING_DEFAULTS: AudioProcessing = {
  enabled:   true,
  threshold: -6,
  knee:      6,
  ratio:     2,
  attack:    10,
  release:   400,
}

const DEFAULTS: AppSettings = {
  autoTranscribe: false,
  colorScheme:    'apple-light',
  recQuality: {
    bitrate:    192,
    channels:   1,
    sampleRate: 48000,
  },
  audioProcessing: AUDIO_PROCESSING_DEFAULTS,
}

// Color scheme definitions
export const COLOR_SCHEMES: Record<ColorScheme, { label: string; vars: Record<string, string> }> = {
  'apple-light': {
    label: 'Apple Light',
    vars: {
      '--bg':          '#f2f2f7',
      '--surface':     '#ffffff',
      '--surface2':    '#e5e5ea',
      '--surface3':    '#d1d1d6',
      '--border':      '#c6c6c8',
      '--text':        '#1c1c1e',
      '--text-muted':  '#8e8e93',
      '--accent':      '#007aff',
      '--accent-2':    '#0062cc',
      '--primary':     '#007aff',
      '--success':     '#34c759',
      '--warning':     '#ff9500',
      '--danger':      '#ff3b30',
      '--info':        '#5856d6',
      '--cyan':        '#32ade6',
      '--orange':      '#ff9500',
      '--red':         '#ff3b30',
      '--green':       '#34c759',
    },
  },
  'tokyo-night': {
    label: 'Tokyo Night',
    vars: {
      '--bg':          '#1a1b26',
      '--surface':     '#16161e',
      '--surface2':    '#24283b',
      '--surface3':    '#2f334d',
      '--border':      '#2a2f45',
      '--text':        '#b5bcc9',
      '--text-muted':  '#565f89',
      '--accent':      '#7aa2f7',
      '--accent-2':    '#5d7fdb',
      '--primary':     '#eda685',
      '--success':     '#9ece6a',
      '--warning':     '#e0af68',
      '--danger':      '#f7768e',
      '--info':        '#bb9af7',
      '--cyan':        '#7dcfff',
      '--orange':      '#ff9e64',
      '--red':         '#f7768e',
      '--green':       '#9ece6a',
    },
  },
  'catppuccin': {
    label: 'Catppuccin Mocha',
    vars: {
      '--bg':          '#1e1e2e',
      '--surface':     '#181825',
      '--surface2':    '#313244',
      '--surface3':    '#45475a',
      '--border':      '#45475a',
      '--text':        '#cdd6f4',
      '--text-muted':  '#6c7086',
      '--accent':      '#89b4fa',
      '--accent-2':    '#74c7ec',
      '--primary':     '#89b4fa',
      '--success':     '#a6e3a1',
      '--warning':     '#f9e2af',
      '--danger':      '#f38ba8',
      '--info':        '#cba6f7',
      '--cyan':        '#89dceb',
      '--orange':      '#fab387',
      '--red':         '#f38ba8',
      '--green':       '#a6e3a1',
    },
  },
  'gruvbox': {
    label: 'Gruvbox Dark',
    vars: {
      '--bg':          '#282828',
      '--surface':     '#1d2021',
      '--surface2':    '#3c3836',
      '--surface3':    '#504945',
      '--border':      '#504945',
      '--text':        '#ebdbb2',
      '--text-muted':  '#928374',
      '--accent':      '#83a598',
      '--accent-2':    '#689d6a',
      '--primary':     '#83a598',
      '--success':     '#b8bb26',
      '--warning':     '#fabd2f',
      '--danger':      '#fb4934',
      '--info':        '#d3869b',
      '--cyan':        '#8ec07c',
      '--orange':      '#fe8019',
      '--red':         '#fb4934',
      '--green':       '#b8bb26',
    },
  },
  'dracula': {
    label: 'Dracula',
    vars: {
      '--bg':          '#282a36',
      '--surface':     '#21222c',
      '--surface2':    '#44475a',
      '--surface3':    '#44475a',
      '--border':      '#44475a',
      '--text':        '#f8f8f2',
      '--text-muted':  '#6272a4',
      '--accent':      '#6272a4',
      '--accent-2':    '#bd93f9',
      '--primary':     '#bd93f9',
      '--success':     '#50fa7b',
      '--warning':     '#f1fa8c',
      '--danger':      '#ff5555',
      '--info':        '#bd93f9',
      '--cyan':        '#8be9fd',
      '--orange':      '#ffb86c',
      '--red':         '#ff5555',
      '--green':       '#50fa7b',
    },
  },
  'nord': {
    label: 'Nord',
    vars: {
      '--bg':          '#2e3440',
      '--surface':     '#242933',
      '--surface2':    '#3b4252',
      '--surface3':    '#434c5e',
      '--border':      '#434c5e',
      '--text':        '#d8dee9',
      '--text-muted':  '#4c566a',
      '--accent':      '#88c0d0',
      '--accent-2':    '#81a1c1',
      '--primary':     '#88c0d0',
      '--success':     '#a3be8c',
      '--warning':     '#ebcb8b',
      '--danger':      '#bf616a',
      '--info':        '#b48ead',
      '--cyan':        '#8fbcbb',
      '--orange':      '#d08770',
      '--red':         '#bf616a',
      '--green':       '#a3be8c',
    },
  },
}

/** Estimated MB for a given duration (seconds) and quality */
export function estimateFileSizeMB(durationSec: number, q: RecordingQuality): number {
  return (q.bitrate * 1000 * durationSec) / 8 / 1024 / 1024
}

function applyScheme(scheme: ColorScheme) {
  const vars = COLOR_SCHEMES[scheme]?.vars
  if (!vars) return
  const root = document.documentElement
  Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v))
  // Update color-scheme meta for browser chrome (scrollbars, inputs, etc.)
  root.style.setProperty('color-scheme', scheme === 'apple-light' ? 'light' : 'dark')
}

function load(): AppSettings {
  try {
    const raw = localStorage.getItem('prayerflow_settings')
    if (raw) {
      const parsed = JSON.parse(raw)
      // Deep-merge nested objects so new keys get defaults
      return {
        ...DEFAULTS,
        ...parsed,
        recQuality:      { ...DEFAULTS.recQuality,      ...(parsed.recQuality      ?? {}) },
        audioProcessing: { ...DEFAULTS.audioProcessing, ...(parsed.audioProcessing ?? {}) },
      }
    }
  } catch {}
  return DEFAULTS
}

function save(s: AppSettings) {
  try { localStorage.setItem('prayerflow_settings', JSON.stringify(s)) } catch {}
}

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(load)

  // Apply scheme on mount and whenever it changes
  useEffect(() => { applyScheme(settings.colorScheme) }, [settings.colorScheme])

  const update = useCallback((patch: Partial<AppSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...patch }
      save(next)
      return next
    })
  }, [])

  return { settings, update }
}
