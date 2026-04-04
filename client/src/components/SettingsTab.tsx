import { AppSettings, COLOR_SCHEMES, ColorScheme } from '../hooks/useSettings'

interface Props {
  settings: AppSettings
  onUpdate: (patch: Partial<AppSettings>) => void
  username: string
  onLogout: () => void
}

function Toggle({ on, onChange, label, description }: {
  on: boolean
  onChange: (v: boolean) => void
  label: string
  description: string
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
      gap: 16, padding: '14px 0', borderBottom: '1px solid var(--border)',
    }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', marginBottom: 4 }}>{label}</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>{description}</div>
      </div>
      <button
        onClick={() => onChange(!on)}
        style={{
          flexShrink: 0, width: 44, height: 24, borderRadius: 12,
          background: on ? 'var(--accent)' : 'var(--surface2)',
          border: 'none', cursor: 'pointer', position: 'relative',
          transition: 'background 0.2s', padding: 0,
        }}
      >
        <span style={{
          position: 'absolute', top: 3, left: on ? 23 : 3,
          width: 18, height: 18, borderRadius: '50%', background: '#fff',
          transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,.3)',
        }} />
      </button>
    </div>
  )
}

function SchemePreview({ scheme }: { scheme: ColorScheme }) {
  const vars = COLOR_SCHEMES[scheme].vars
  return (
    <div style={{
      width: 40, height: 26, borderRadius: 6, overflow: 'hidden',
      display: 'flex', flexShrink: 0,
    }}>
      <div style={{ flex: 1, background: vars['--bg'] }} />
      <div style={{ flex: 1, background: vars['--accent'] }} />
      <div style={{ flex: 1, background: vars['--info'] }} />
      <div style={{ flex: 1, background: vars['--success'] }} />
    </div>
  )
}

export function SettingsTab({ settings, onUpdate, username, onLogout }: Props) {
  return (
    <div>
      {/* Account */}
      <div className="card">
        <div className="card-title">Account</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--info), var(--accent))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, flexShrink: 0,
          }}>
            {username[0]?.toUpperCase() ?? '?'}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{username}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Signed in</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onLogout}>Sign Out</button>
        </div>
      </div>

      {/* Color scheme */}
      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-title">Colour Scheme</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {(Object.keys(COLOR_SCHEMES) as ColorScheme[]).map(scheme => (
            <div
              key={scheme}
              onClick={() => onUpdate({ colorScheme: scheme })}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 12px', borderRadius: 'var(--radius)',
                border: `1px solid ${settings.colorScheme === scheme ? 'var(--accent)' : 'var(--border)'}`,
                background: settings.colorScheme === scheme ? 'rgba(122,162,247,.08)' : 'var(--bg)',
                cursor: 'pointer', transition: 'all 0.1s',
              }}
            >
              <SchemePreview scheme={scheme} />
              <span style={{
                flex: 1, fontSize: 13, fontWeight: 500,
                color: settings.colorScheme === scheme ? 'var(--accent)' : 'var(--text)',
              }}>
                {COLOR_SCHEMES[scheme].label}
              </span>
              {settings.colorScheme === scheme && (
                <span style={{ fontSize: 12, color: 'var(--accent)' }}>✓</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Transcription */}
      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-title">Transcription</div>
        <Toggle
          on={settings.autoTranscribe}
          onChange={v => onUpdate({ autoTranscribe: v })}
          label="Auto-transcribe after saving"
          description={
            settings.autoTranscribe
              ? 'After each recording is saved, it will automatically be sent to Deepgram for transcription.'
              : 'Transcription is manual. Go to Recordings → ✦ Transcribe to generate a transcript.'
          }
        />
        <div style={{ paddingTop: 14, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.7 }}>
          <strong style={{ color: 'var(--text)' }}>About transcription</strong><br />
          Transcripts are generated by{' '}
          <span style={{ color: 'var(--accent)' }}>Deepgram nova-3</span> with word-level
          timestamps, smart formatting, and punctuation.
        </div>
      </div>

      {/* Storage */}
      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-title">Storage</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.8 }}>
          <div>Recordings are saved on the server as <code style={{ color: 'var(--cyan)' }}>.webm</code> files</div>
          <div>Transcripts are saved as <code style={{ color: 'var(--cyan)' }}>.transcript.json</code> alongside each recording</div>
          <div>Settings and colour scheme are stored locally in your browser</div>
        </div>
      </div>
    </div>
  )
}
