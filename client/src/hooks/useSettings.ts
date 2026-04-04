import { useState, useCallback } from 'react'

export interface AppSettings {
  autoTranscribe: boolean
}

const DEFAULTS: AppSettings = {
  autoTranscribe: false,
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

  const update = useCallback((patch: Partial<AppSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...patch }
      save(next)
      return next
    })
  }, [])

  return { settings, update }
}
