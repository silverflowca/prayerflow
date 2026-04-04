import { useState, useCallback, useEffect } from 'react'

export type ColorScheme = 'tokyo-night' | 'catppuccin' | 'gruvbox' | 'dracula' | 'nord'

export interface AppSettings {
  autoTranscribe: boolean
  colorScheme: ColorScheme
}

const DEFAULTS: AppSettings = {
  autoTranscribe: false,
  colorScheme: 'tokyo-night',
}

// Color scheme definitions — same palette as devflow
export const COLOR_SCHEMES: Record<ColorScheme, { label: string; vars: Record<string, string> }> = {
  'tokyo-night': {
    label: 'Tokyo Night',
    vars: {
      '--bg':          '#1a1b26',
      '--surface':     '#16161e',
      '--surface2':    '#24283b',
      '--border':      '#2a2f45',
      '--text':        '#b5bcc9',
      '--text-muted':  '#565f89',
      '--accent':      '#7aa2f7',
      '--accent-2':    '#5d7fdb',
      '--success':     '#9ece6a',
      '--warning':     '#e0af68',
      '--danger':      '#f7768e',
      '--info':        '#bb9af7',
      '--cyan':        '#7dcfff',
      '--orange':      '#ff9e64',
      '--red':         '#f7768e',
    },
  },
  'catppuccin': {
    label: 'Catppuccin Mocha',
    vars: {
      '--bg':          '#1e1e2e',
      '--surface':     '#181825',
      '--surface2':    '#313244',
      '--border':      '#45475a',
      '--text':        '#cdd6f4',
      '--text-muted':  '#6c7086',
      '--accent':      '#89b4fa',
      '--accent-2':    '#74c7ec',
      '--success':     '#a6e3a1',
      '--warning':     '#f9e2af',
      '--danger':      '#f38ba8',
      '--info':        '#cba6f7',
      '--cyan':        '#89dceb',
      '--orange':      '#fab387',
      '--red':         '#f38ba8',
    },
  },
  'gruvbox': {
    label: 'Gruvbox Dark',
    vars: {
      '--bg':          '#282828',
      '--surface':     '#1d2021',
      '--surface2':    '#3c3836',
      '--border':      '#504945',
      '--text':        '#ebdbb2',
      '--text-muted':  '#928374',
      '--accent':      '#83a598',
      '--accent-2':    '#689d6a',
      '--success':     '#b8bb26',
      '--warning':     '#fabd2f',
      '--danger':      '#fb4934',
      '--info':        '#d3869b',
      '--cyan':        '#8ec07c',
      '--orange':      '#fe8019',
      '--red':         '#fb4934',
    },
  },
  'dracula': {
    label: 'Dracula',
    vars: {
      '--bg':          '#282a36',
      '--surface':     '#21222c',
      '--surface2':    '#44475a',
      '--border':      '#44475a',
      '--text':        '#f8f8f2',
      '--text-muted':  '#6272a4',
      '--accent':      '#6272a4',
      '--accent-2':    '#bd93f9',
      '--success':     '#50fa7b',
      '--warning':     '#f1fa8c',
      '--danger':      '#ff5555',
      '--info':        '#bd93f9',
      '--cyan':        '#8be9fd',
      '--orange':      '#ffb86c',
      '--red':         '#ff5555',
    },
  },
  'nord': {
    label: 'Nord',
    vars: {
      '--bg':          '#2e3440',
      '--surface':     '#242933',
      '--surface2':    '#3b4252',
      '--border':      '#434c5e',
      '--text':        '#d8dee9',
      '--text-muted':  '#4c566a',
      '--accent':      '#88c0d0',
      '--accent-2':    '#81a1c1',
      '--success':     '#a3be8c',
      '--warning':     '#ebcb8b',
      '--danger':      '#bf616a',
      '--info':        '#b48ead',
      '--cyan':        '#8fbcbb',
      '--orange':      '#d08770',
      '--red':         '#bf616a',
    },
  },
}

function applyScheme(scheme: ColorScheme) {
  const vars = COLOR_SCHEMES[scheme]?.vars
  if (!vars) return
  const root = document.documentElement
  Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v))
}

function load(): AppSettings {
  try {
    const raw = localStorage.getItem('prayerflow_settings')
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) }
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
