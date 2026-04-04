import { useState, useRef, useEffect } from 'react'
import { LibraryTab }    from './components/LibraryTab'
import { StudioTab }     from './components/StudioTab'
import { RecordingsTab } from './components/RecordingsTab'
import { SettingsTab }   from './components/SettingsTab'
import { LyricsView }    from './components/LyricsView'
import { LoginPage }     from './components/LoginPage'
import { useSettings }   from './hooks/useSettings'
import { useAuth }       from './hooks/useAuth'
import { useTheme }      from './contexts/ThemeContext'

function ThemeSelector() {
  const { currentTheme, setTheme, themes } = useTheme()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const darkThemes  = themes.filter(t => t.type === 'dark')
  const lightThemes = themes.filter(t => t.type === 'light')

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          width: '100%', background: 'transparent', border: 'none',
          padding: '6px 10px', borderRadius: 'var(--radius)',
          cursor: 'pointer', color: 'var(--text-muted)', fontSize: 12,
          fontFamily: 'var(--font)',
        }}
        title="Change theme"
      >
        <span style={{
          width: 12, height: 12, borderRadius: '50%', flexShrink: 0,
          background: currentTheme.colors.accent,
          boxShadow: `0 0 6px ${currentTheme.colors.accent}`,
        }} />
        <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {currentTheme.name}
        </span>
        <span style={{ fontSize: 10 }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', bottom: '100%', left: 0, right: 0,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)', overflow: 'hidden',
          boxShadow: '0 -8px 32px rgba(0,0,0,.4)',
          zIndex: 100, maxHeight: 320, overflowY: 'auto',
        }}>
          <div style={{ padding: '4px 10px 2px', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-muted)', textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>
            Dark
          </div>
          {darkThemes.map(t => (
            <button
              key={t.id}
              onClick={() => { setTheme(t.id); setOpen(false) }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                width: '100%', background: currentTheme.id === t.id ? 'var(--surface2)' : 'transparent',
                border: 'none', padding: '6px 10px', cursor: 'pointer',
                color: currentTheme.id === t.id ? 'var(--accent)' : 'var(--text)',
                fontSize: 12, fontFamily: 'var(--font)', textAlign: 'left',
              }}
            >
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: t.colors.accent, flexShrink: 0 }} />
              {t.name}
            </button>
          ))}
          <div style={{ padding: '4px 10px 2px', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-muted)', textTransform: 'uppercase', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
            Light
          </div>
          {lightThemes.map(t => (
            <button
              key={t.id}
              onClick={() => { setTheme(t.id); setOpen(false) }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                width: '100%', background: currentTheme.id === t.id ? 'var(--surface2)' : 'transparent',
                border: 'none', padding: '6px 10px', cursor: 'pointer',
                color: currentTheme.id === t.id ? 'var(--accent)' : 'var(--text)',
                fontSize: 12, fontFamily: 'var(--font)', textAlign: 'left',
              }}
            >
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: t.colors.accent, flexShrink: 0 }} />
              {t.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

type Tab = 'library' | 'studio' | 'recordings' | 'settings'

export default function App() {
  const [tab, setTab] = useState<Tab>('library')
  const [selectedTrack, setSelectedTrack] = useState<string | null>(null)
  const [lyricsFilename, setLyricsFilename] = useState<string | null>(null)
  const { settings, update } = useSettings()
  const { isLoggedIn, username, login, logout, apiFetch } = useAuth()

  if (!isLoggedIn) {
    return <LoginPage onLogin={login} />
  }

  const selectTrack = (name: string) => {
    setSelectedTrack(name)
    setTab('studio')
  }

  const topbarTitle = lyricsFilename ? '🎤 Lyrics'
    : tab === 'library'    ? '🎵 Music Library'
    : tab === 'studio'     ? '🎙️ Recording Studio'
    : tab === 'recordings' ? '📼 My Recordings'
    : '⚙ Settings'

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo">🙏</div>
          <span className="sidebar-title">PrayerFlow</span>
        </div>
        <nav className="sidebar-nav">
          <div className="nav-section">
            <div className="nav-label">Workspace</div>
            <div
              className={`nav-item${tab === 'library' && !lyricsFilename ? ' active' : ''}`}
              onClick={() => { setLyricsFilename(null); setTab('library') }}
            >
              <span className="icon">🎵</span> Music Library
            </div>
            <div
              className={`nav-item${tab === 'studio' && !lyricsFilename ? ' active' : ''}`}
              onClick={() => { setLyricsFilename(null); setTab('studio') }}
            >
              <span className="icon">🎙️</span> Studio
              {selectedTrack && (
                <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--cyan)', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {(selectedTrack.split('/').pop() ?? selectedTrack).replace(/_\d+\.mp3$/, '').replace(/-/g, ' ').slice(0, 16)}
                </span>
              )}
            </div>
            <div
              className={`nav-item${tab === 'recordings' && !lyricsFilename ? ' active' : ''}`}
              onClick={() => { setLyricsFilename(null); setTab('recordings') }}
            >
              <span className="icon">📼</span> Recordings
            </div>
          </div>

          <div className="nav-section" style={{ marginTop: 'auto', paddingTop: 12 }}>
            <ThemeSelector />
            <div className="nav-label">App</div>
            <div
              className={`nav-item${tab === 'settings' && !lyricsFilename ? ' active' : ''}`}
              onClick={() => { setLyricsFilename(null); setTab('settings') }}
            >
              <span className="icon">⚙</span> Settings
              {settings.autoTranscribe && (
                <span style={{ marginLeft: 'auto', fontSize: 9, color: 'var(--accent)', background: 'rgba(122,162,247,.15)', padding: '1px 5px', borderRadius: 4 }}>
                  AUTO
                </span>
              )}
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 10px', marginTop: 4,
              borderTop: '1px solid var(--border)',
            }}>
              <div style={{
                width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                background: 'linear-gradient(135deg, var(--info), var(--accent))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700, color: '#fff',
              }}>
                {username?.[0]?.toUpperCase()}
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {username}
              </span>
            </div>
          </div>
        </nav>
      </aside>

      <div className="main-area">
        <div className="topbar">
          <span className="topbar-title">{topbarTitle}</span>
          {selectedTrack && tab !== 'settings' && !lyricsFilename && (
            <span style={{ fontSize: 12, color: 'var(--cyan)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>●</span> {selectedTrack}
            </span>
          )}
          {settings.autoTranscribe && tab === 'studio' && !lyricsFilename && (
            <span style={{ fontSize: 11, color: 'var(--accent)', padding: '2px 8px', borderRadius: 4, background: 'rgba(122,162,247,.1)', border: '1px solid rgba(122,162,247,.2)' }}>
              Auto-transcribe ON
            </span>
          )}
        </div>

        <div className="page">
          {lyricsFilename
            ? <LyricsView filename={lyricsFilename} onBack={() => setLyricsFilename(null)} apiFetch={apiFetch} />
            : tab === 'library'
              ? <LibraryTab onSelect={selectTrack} selectedTrack={selectedTrack} />
            : tab === 'studio'
              ? <StudioTab
                  selectedTrack={selectedTrack}
                  onChangeTrack={() => setTab('library')}
                  autoTranscribe={settings.autoTranscribe}
                  onOpenLyrics={setLyricsFilename}
                  apiFetch={apiFetch}
                />
            : tab === 'recordings'
              ? <RecordingsTab onOpenLyrics={setLyricsFilename} apiFetch={apiFetch} />
              : <SettingsTab settings={settings} onUpdate={update} username={username!} onLogout={logout} />
          }
        </div>
      </div>
    </div>
  )
}
