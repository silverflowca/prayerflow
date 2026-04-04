import { useState } from 'react'
import { LibraryTab }    from './components/LibraryTab'
import { StudioTab }     from './components/StudioTab'
import { RecordingsTab } from './components/RecordingsTab'
import { SettingsTab }   from './components/SettingsTab'
import { LyricsView }    from './components/LyricsView'
import { LoginPage }     from './components/LoginPage'
import { useSettings }   from './hooks/useSettings'
import { useAuth }       from './hooks/useAuth'

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
