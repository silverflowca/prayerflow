import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

export interface Theme {
  id: string
  name: string
  type: 'light' | 'dark'
  colors: {
    primary: string
    text: string
    textSecondary: string
    bg: string
    bgDark: string
    bgLighter: string
    accent: string
    green: string
    red: string
    yellow: string
    purple: string
    cyan: string
    orange: string
    blue: string
    magenta: string
  }
}

const darkThemes: Theme[] = [
  {
    id: 'tokyo-night',
    name: 'Tokyo Night',
    type: 'dark',
    colors: {
      primary: '#EDA685',
      text: '#b5bcc9',
      textSecondary: '#565f89',
      bg: '#1a1b26',
      bgDark: '#16161e',
      bgLighter: '#2a2e3f',
      accent: '#7aa2f7',
      green: '#9ece6a',
      red: '#f7768e',
      yellow: '#e0af68',
      purple: '#bb9af7',
      cyan: '#7dcfff',
      orange: '#ff9e64',
      blue: '#7aa2f7',
      magenta: '#bb9af7',
    },
  },
  {
    id: 'dracula',
    name: 'Dracula',
    type: 'dark',
    colors: {
      primary: '#bd93f9',
      text: '#f8f8f2',
      textSecondary: '#6272a4',
      bg: '#282a36',
      bgDark: '#21222c',
      bgLighter: '#4a4d62',
      accent: '#8be9fd',
      green: '#50fa7b',
      red: '#ff5555',
      yellow: '#f1fa8c',
      purple: '#bd93f9',
      cyan: '#8be9fd',
      orange: '#ffb86c',
      blue: '#6272a4',
      magenta: '#ff79c6',
    },
  },
  {
    id: 'monokai-pro',
    name: 'Monokai Pro',
    type: 'dark',
    colors: {
      primary: '#ffd866',
      text: '#fcfcfa',
      textSecondary: '#727072',
      bg: '#2d2a2e',
      bgDark: '#221f22',
      bgLighter: '#49464a',
      accent: '#78dce8',
      green: '#a9dc76',
      red: '#ff6188',
      yellow: '#ffd866',
      purple: '#ab9df2',
      cyan: '#78dce8',
      orange: '#fc9867',
      blue: '#78dce8',
      magenta: '#ff6188',
    },
  },
  {
    id: 'nord',
    name: 'Nord',
    type: 'dark',
    colors: {
      primary: '#88c0d0',
      text: '#eceff4',
      textSecondary: '#4c566a',
      bg: '#2e3440',
      bgDark: '#242933',
      bgLighter: '#434c5e',
      accent: '#81a1c1',
      green: '#a3be8c',
      red: '#bf616a',
      yellow: '#ebcb8b',
      purple: '#b48ead',
      cyan: '#88c0d0',
      orange: '#d08770',
      blue: '#81a1c1',
      magenta: '#b48ead',
    },
  },
  {
    id: 'catppuccin-mocha',
    name: 'Catppuccin Mocha',
    type: 'dark',
    colors: {
      primary: '#cba6f7',
      text: '#cdd6f4',
      textSecondary: '#6c7086',
      bg: '#1e1e2e',
      bgDark: '#181825',
      bgLighter: '#383a4c',
      accent: '#89b4fa',
      green: '#a6e3a1',
      red: '#f38ba8',
      yellow: '#f9e2af',
      purple: '#cba6f7',
      cyan: '#94e2d5',
      orange: '#fab387',
      blue: '#89b4fa',
      magenta: '#f5c2e7',
    },
  },
  {
    id: 'one-dark',
    name: 'One Dark',
    type: 'dark',
    colors: {
      primary: '#61afef',
      text: '#abb2bf',
      textSecondary: '#5c6370',
      bg: '#282c34',
      bgDark: '#21252b',
      bgLighter: '#464c59',
      accent: '#61afef',
      green: '#98c379',
      red: '#e06c75',
      yellow: '#e5c07b',
      purple: '#c678dd',
      cyan: '#56b6c2',
      orange: '#d19a66',
      blue: '#61afef',
      magenta: '#c678dd',
    },
  },
  {
    id: 'gruvbox-dark',
    name: 'Gruvbox Dark',
    type: 'dark',
    colors: {
      primary: '#fe8019',
      text: '#ebdbb2',
      textSecondary: '#928374',
      bg: '#282828',
      bgDark: '#1d2021',
      bgLighter: '#45403d',
      accent: '#83a598',
      green: '#b8bb26',
      red: '#fb4934',
      yellow: '#fabd2f',
      purple: '#d3869b',
      cyan: '#8ec07c',
      orange: '#fe8019',
      blue: '#83a598',
      magenta: '#d3869b',
    },
  },
  {
    id: 'synthwave',
    name: 'Synthwave',
    type: 'dark',
    colors: {
      primary: '#ff7edb',
      text: '#ffffff',
      textSecondary: '#848bbd',
      bg: '#262335',
      bgDark: '#1e1a2e',
      bgLighter: '#3d3057',
      accent: '#36f9f6',
      green: '#72f1b8',
      red: '#fe4450',
      yellow: '#fede5d',
      purple: '#ff7edb',
      cyan: '#36f9f6',
      orange: '#f97e72',
      blue: '#03edf9',
      magenta: '#ff7edb',
    },
  },
  {
    id: 'night-owl',
    name: 'Night Owl',
    type: 'dark',
    colors: {
      primary: '#c792ea',
      text: '#d6deeb',
      textSecondary: '#637777',
      bg: '#011627',
      bgDark: '#010e1a',
      bgLighter: '#112d4e',
      accent: '#82aaff',
      green: '#22da6e',
      red: '#ef5350',
      yellow: '#ffeb95',
      purple: '#c792ea',
      cyan: '#7fdbca',
      orange: '#f78c6c',
      blue: '#82aaff',
      magenta: '#c792ea',
    },
  },
  {
    id: 'github-dark',
    name: 'GitHub Dark',
    type: 'dark',
    colors: {
      primary: '#58a6ff',
      text: '#c9d1d9',
      textSecondary: '#8b949e',
      bg: '#0d1117',
      bgDark: '#010409',
      bgLighter: '#1c2128',
      accent: '#58a6ff',
      green: '#3fb950',
      red: '#f85149',
      yellow: '#d29922',
      purple: '#a371f7',
      cyan: '#39c5cf',
      orange: '#db6d28',
      blue: '#58a6ff',
      magenta: '#db61a2',
    },
  },
  {
    id: 'executive-slate',
    name: 'Executive Slate',
    type: 'dark',
    colors: {
      primary: '#cbd5e1',
      text: '#e2e8f0',
      textSecondary: '#94a3b8',
      bg: '#0f172a',
      bgDark: '#020617',
      bgLighter: '#273447',
      accent: '#3b82f6',
      green: '#10b981',
      red: '#ef4444',
      yellow: '#f59e0b',
      purple: '#8b5cf6',
      cyan: '#06b6d4',
      orange: '#f97316',
      blue: '#3b82f6',
      magenta: '#ec4899',
    },
  },
  {
    id: 'corporate-navy',
    name: 'Corporate Navy',
    type: 'dark',
    colors: {
      primary: '#60a5fa',
      text: '#f1f5f9',
      textSecondary: '#94a3b8',
      bg: '#0a1628',
      bgDark: '#030712',
      bgLighter: '#273447',
      accent: '#2563eb',
      green: '#059669',
      red: '#dc2626',
      yellow: '#d97706',
      purple: '#7c3aed',
      cyan: '#0891b2',
      orange: '#ea580c',
      blue: '#2563eb',
      magenta: '#db2777',
    },
  },
  {
    id: 'midnight-pro',
    name: 'Midnight Pro',
    type: 'dark',
    colors: {
      primary: '#93c5fd',
      text: '#e0e7ff',
      textSecondary: '#a5b4fc',
      bg: '#0c1222',
      bgDark: '#050a14',
      bgLighter: '#262357',
      accent: '#6366f1',
      green: '#34d399',
      red: '#f87171',
      yellow: '#fbbf24',
      purple: '#a78bfa',
      cyan: '#22d3ee',
      orange: '#fb923c',
      blue: '#60a5fa',
      magenta: '#f472b6',
    },
  },
  {
    id: 'obsidian-executive',
    name: 'Obsidian Executive',
    type: 'dark',
    colors: {
      primary: '#a5b4fc',
      text: '#f9fafb',
      textSecondary: '#9ca3af',
      bg: '#111827',
      bgDark: '#030712',
      bgLighter: '#27303f',
      accent: '#818cf8',
      green: '#22c55e',
      red: '#ef4444',
      yellow: '#fbbf24',
      purple: '#a78bfa',
      cyan: '#06b6d4',
      orange: '#f97316',
      blue: '#3b82f6',
      magenta: '#ec4899',
    },
  },
  {
    id: 'charcoal-premium',
    name: 'Charcoal Premium',
    type: 'dark',
    colors: {
      primary: '#d1d5db',
      text: '#f3f4f6',
      textSecondary: '#9ca3af',
      bg: '#1c1c1e',
      bgDark: '#0a0a0b',
      bgLighter: '#343436',
      accent: '#3b82f6',
      green: '#10b981',
      red: '#ef4444',
      yellow: '#f59e0b',
      purple: '#8b5cf6',
      cyan: '#14b8a6',
      orange: '#f97316',
      blue: '#3b82f6',
      magenta: '#ec4899',
    },
  },
]

const lightThemes: Theme[] = [
  {
    id: 'github-light',
    name: 'GitHub Light',
    type: 'light',
    colors: {
      primary: '#0969da',
      text: '#24292f',
      textSecondary: '#57606a',
      bg: '#ffffff',
      bgDark: '#f6f8fa',
      bgLighter: '#d0d7de',
      accent: '#0969da',
      green: '#1a7f37',
      red: '#cf222e',
      yellow: '#9a6700',
      purple: '#8250df',
      cyan: '#0a3069',
      orange: '#bc4c00',
      blue: '#0969da',
      magenta: '#8250df',
    },
  },
  {
    id: 'solarized-light',
    name: 'Solarized Light',
    type: 'light',
    colors: {
      primary: '#268bd2',
      text: '#657b83',
      textSecondary: '#93a1a1',
      bg: '#fdf6e3',
      bgDark: '#eee8d5',
      bgLighter: '#d9d2c0',
      accent: '#268bd2',
      green: '#859900',
      red: '#dc322f',
      yellow: '#b58900',
      purple: '#6c71c4',
      cyan: '#2aa198',
      orange: '#cb4b16',
      blue: '#268bd2',
      magenta: '#d33682',
    },
  },
  {
    id: 'catppuccin-latte',
    name: 'Catppuccin Latte',
    type: 'light',
    colors: {
      primary: '#8839ef',
      text: '#4c4f69',
      textSecondary: '#9ca0b0',
      bg: '#eff1f5',
      bgDark: '#e6e9ef',
      bgLighter: '#bcc0cc',
      accent: '#1e66f5',
      green: '#40a02b',
      red: '#d20f39',
      yellow: '#df8e1d',
      purple: '#8839ef',
      cyan: '#179299',
      orange: '#fe640b',
      blue: '#1e66f5',
      magenta: '#ea76cb',
    },
  },
  {
    id: 'one-light',
    name: 'One Light',
    type: 'light',
    colors: {
      primary: '#4078f2',
      text: '#383a42',
      textSecondary: '#a0a1a7',
      bg: '#fafafa',
      bgDark: '#f0f0f0',
      bgLighter: '#d5d5d6',
      accent: '#4078f2',
      green: '#50a14f',
      red: '#e45649',
      yellow: '#c18401',
      purple: '#a626a4',
      cyan: '#0184bc',
      orange: '#986801',
      blue: '#4078f2',
      magenta: '#a626a4',
    },
  },
  {
    id: 'gruvbox-light',
    name: 'Gruvbox Light',
    type: 'light',
    colors: {
      primary: '#d65d0e',
      text: '#3c3836',
      textSecondary: '#7c6f64',
      bg: '#fbf1c7',
      bgDark: '#f2e5bc',
      bgLighter: '#d5c4a1',
      accent: '#458588',
      green: '#79740e',
      red: '#cc241d',
      yellow: '#d79921',
      purple: '#8f3f71',
      cyan: '#689d6a',
      orange: '#d65d0e',
      blue: '#458588',
      magenta: '#b16286',
    },
  },
  {
    id: 'nord-light',
    name: 'Nord Light',
    type: 'light',
    colors: {
      primary: '#5e81ac',
      text: '#2e3440',
      textSecondary: '#4c566a',
      bg: '#eceff4',
      bgDark: '#e5e9f0',
      bgLighter: '#c8d0dd',
      accent: '#81a1c1',
      green: '#a3be8c',
      red: '#bf616a',
      yellow: '#ebcb8b',
      purple: '#b48ead',
      cyan: '#88c0d0',
      orange: '#d08770',
      blue: '#5e81ac',
      magenta: '#b48ead',
    },
  },
  {
    id: 'tokyo-day',
    name: 'Tokyo Day',
    type: 'light',
    colors: {
      primary: '#965027',
      text: '#343b58',
      textSecondary: '#9699a3',
      bg: '#e1e2e7',
      bgDark: '#d5d6db',
      bgLighter: '#b4b8cc',
      accent: '#2e7de9',
      green: '#587539',
      red: '#f52a65',
      yellow: '#8c6c3e',
      purple: '#7847bd',
      cyan: '#007197',
      orange: '#965027',
      blue: '#2e7de9',
      magenta: '#9854f1',
    },
  },
  {
    id: 'paper',
    name: 'Paper',
    type: 'light',
    colors: {
      primary: '#1565c0',
      text: '#222222',
      textSecondary: '#777777',
      bg: '#f5f5f5',
      bgDark: '#eeeeee',
      bgLighter: '#cfcfcf',
      accent: '#1565c0',
      green: '#2e7d32',
      red: '#c62828',
      yellow: '#f9a825',
      purple: '#6a1b9a',
      cyan: '#00838f',
      orange: '#ef6c00',
      blue: '#1565c0',
      magenta: '#ad1457',
    },
  },
  {
    id: 'rose-pine-dawn',
    name: 'Rosé Pine Dawn',
    type: 'light',
    colors: {
      primary: '#907aa9',
      text: '#575279',
      textSecondary: '#9893a5',
      bg: '#faf4ed',
      bgDark: '#f2e9de',
      bgLighter: '#e4ddd0',
      accent: '#286983',
      green: '#56949f',
      red: '#b4637a',
      yellow: '#ea9d34',
      purple: '#907aa9',
      cyan: '#56949f',
      orange: '#d7827e',
      blue: '#286983',
      magenta: '#907aa9',
    },
  },
  {
    id: 'ayu-light',
    name: 'Ayu Light',
    type: 'light',
    colors: {
      primary: '#ff9940',
      text: '#5c6166',
      textSecondary: '#8a9199',
      bg: '#fcfcfc',
      bgDark: '#f3f4f5',
      bgLighter: '#d7d8d9',
      accent: '#399ee6',
      green: '#86b300',
      red: '#f07171',
      yellow: '#f2ae49',
      purple: '#a37acc',
      cyan: '#4cbf99',
      orange: '#ff9940',
      blue: '#399ee6',
      magenta: '#f07171',
    },
  },
  {
    id: 'corporate-white',
    name: 'Corporate White',
    type: 'light',
    colors: {
      primary: '#1e40af',
      text: '#1f2937',
      textSecondary: '#6b7280',
      bg: '#ffffff',
      bgDark: '#f9fafb',
      bgLighter: '#d1d5db',
      accent: '#2563eb',
      green: '#059669',
      red: '#dc2626',
      yellow: '#d97706',
      purple: '#7c3aed',
      cyan: '#0891b2',
      orange: '#ea580c',
      blue: '#2563eb',
      magenta: '#db2777',
    },
  },
  {
    id: 'executive-silver',
    name: 'Executive Silver',
    type: 'light',
    colors: {
      primary: '#475569',
      text: '#0f172a',
      textSecondary: '#64748b',
      bg: '#f8fafc',
      bgDark: '#f1f5f9',
      bgLighter: '#cbd5e0',
      accent: '#3b82f6',
      green: '#10b981',
      red: '#ef4444',
      yellow: '#f59e0b',
      purple: '#8b5cf6',
      cyan: '#06b6d4',
      orange: '#f97316',
      blue: '#3b82f6',
      magenta: '#ec4899',
    },
  },
  {
    id: 'professional-cream',
    name: 'Professional Cream',
    type: 'light',
    colors: {
      primary: '#0f766e',
      text: '#0f172a',
      textSecondary: '#475569',
      bg: '#fefce8',
      bgDark: '#fef9c3',
      bgLighter: '#fde047',
      accent: '#0d9488',
      green: '#059669',
      red: '#dc2626',
      yellow: '#ca8a04',
      purple: '#7c3aed',
      cyan: '#0891b2',
      orange: '#ea580c',
      blue: '#0284c7',
      magenta: '#db2777',
    },
  },
  {
    id: 'boardroom-beige',
    name: 'Boardroom Beige',
    type: 'light',
    colors: {
      primary: '#78350f',
      text: '#292524',
      textSecondary: '#78716c',
      bg: '#fafaf9',
      bgDark: '#f5f5f4',
      bgLighter: '#d6d3d1',
      accent: '#92400e',
      green: '#15803d',
      red: '#dc2626',
      yellow: '#ca8a04',
      purple: '#7c3aed',
      cyan: '#0891b2',
      orange: '#ea580c',
      blue: '#1d4ed8',
      magenta: '#db2777',
    },
  },
  {
    id: 'pearl-white',
    name: 'Pearl White',
    type: 'light',
    colors: {
      primary: '#1e3a8a',
      text: '#18181b',
      textSecondary: '#71717a',
      bg: '#fafafa',
      bgDark: '#f4f4f5',
      bgLighter: '#d4d4d8',
      accent: '#2563eb',
      green: '#16a34a',
      red: '#dc2626',
      yellow: '#d97706',
      purple: '#9333ea',
      cyan: '#0891b2',
      orange: '#ea580c',
      blue: '#2563eb',
      magenta: '#db2777',
    },
  },
]

export const themes: Theme[] = [...darkThemes, ...lightThemes]

interface ThemeContextType {
  currentTheme: Theme
  setTheme: (themeId: string) => void
  themes: Theme[]
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

function applyTheme(theme: Theme) {
  const root = document.documentElement
  const c = theme.colors

  // Map to prayerflow CSS variables
  root.style.setProperty('--bg',         c.bg)
  root.style.setProperty('--surface',    c.bgDark)
  root.style.setProperty('--surface2',   c.bgLighter)
  root.style.setProperty('--surface3',   c.bgLighter)  // approximation
  root.style.setProperty('--border',     c.bgLighter)
  root.style.setProperty('--text',       c.text)
  root.style.setProperty('--text-muted', c.textSecondary)
  root.style.setProperty('--accent',     c.accent)
  root.style.setProperty('--accent-2',   c.blue)
  root.style.setProperty('--primary',    c.primary)
  root.style.setProperty('--success',    c.green)
  root.style.setProperty('--warning',    c.yellow)
  root.style.setProperty('--danger',     c.red)
  root.style.setProperty('--info',       c.purple)
  root.style.setProperty('--cyan',       c.cyan)
  root.style.setProperty('--orange',     c.orange)
  root.style.setProperty('--red',        c.red)
  root.style.setProperty('--green',      c.green)
  root.style.setProperty('color-scheme', theme.type)

  localStorage.setItem('pf-theme', theme.id)
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [currentTheme, setCurrentTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('pf-theme')
    return themes.find(t => t.id === saved) || themes[0]
  })

  useEffect(() => {
    applyTheme(currentTheme)
  }, [currentTheme])

  const setTheme = (id: string) => {
    const t = themes.find(t => t.id === id)
    if (t) setCurrentTheme(t)
  }

  return (
    <ThemeContext.Provider value={{ currentTheme, setTheme, themes }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
