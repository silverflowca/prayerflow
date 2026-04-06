import { AppSettings, COLOR_SCHEMES, ColorScheme, RecBitrate, RecordingQuality, estimateFileSizeMB } from '../hooks/useSettings'

interface Props {
  settings: AppSettings
  onUpdate: (patch: Partial<AppSettings>) => void
  username: string
  onLogout: () => void
}

// ── iOS-style Toggle ──────────────────────────────────────
function Toggle({ on, onChange, label, description }: {
  on: boolean
  onChange: (v: boolean) => void
  label: string
  description?: string
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
      gap: 16, padding: '13px 16px',
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 15, color: 'var(--text)', marginBottom: description ? 2 : 0 }}>{label}</div>
        {description && <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>{description}</div>}
      </div>
      <button
        onClick={() => onChange(!on)}
        style={{
          flexShrink: 0, width: 51, height: 31, borderRadius: 16,
          background: on ? 'var(--success)' : 'var(--surface2)',
          border: 'none', cursor: 'pointer', position: 'relative',
          transition: 'background 0.2s', padding: 0,
        }}
      >
        <span style={{
          position: 'absolute', top: 3, left: on ? 23 : 3,
          width: 25, height: 25, borderRadius: '50%', background: '#fff',
          transition: 'left 0.18s cubic-bezier(.4,0,.2,1)',
          boxShadow: '0 2px 6px rgba(0,0,0,.25)',
        }} />
      </button>
    </div>
  )
}

// ── iOS-style grouped list divider ────────────────────────
function Divider() {
  return <div style={{ height: 1, background: 'var(--border)', marginLeft: 16 }} />
}

// ── Section header ─────────────────────────────────────────
function SectionHeader({ title }: { title: string }) {
  return (
    <div style={{
      fontSize: 12, fontWeight: 600, color: 'var(--text-muted)',
      textTransform: 'uppercase', letterSpacing: '0.06em',
      padding: '20px 4px 6px',
    }}>
      {title}
    </div>
  )
}

// ── iOS-style grouped card ─────────────────────────────────
function GroupCard({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--surface)',
      borderRadius: 12,
      overflow: 'hidden',
      border: '1px solid var(--border)',
      boxShadow: '0 1px 3px rgba(0,0,0,.06)',
    }}>
      {children}
    </div>
  )
}

// ── Colour swatch ─────────────────────────────────────────
function SchemePreview({ scheme }: { scheme: ColorScheme }) {
  const vars = COLOR_SCHEMES[scheme].vars
  return (
    <div style={{ width: 44, height: 28, borderRadius: 8, overflow: 'hidden', display: 'flex', flexShrink: 0, border: '1px solid var(--border)' }}>
      <div style={{ flex: 1, background: vars['--bg'] }} />
      <div style={{ flex: 1, background: vars['--accent'] }} />
      <div style={{ flex: 1, background: vars['--success'] }} />
      <div style={{ flex: 1, background: vars['--danger'] }} />
    </div>
  )
}

// ── File size estimate pill ────────────────────────────────
function SizePill({ q }: { q: RecordingQuality }) {
  const sizes = [1, 2, 5].map(min => {
    const mb = estimateFileSizeMB(min * 60, q)
    return `${min}min ≈ ${mb.toFixed(1)} MB`
  })
  return (
    <div style={{
      display: 'flex', gap: 6, flexWrap: 'wrap', padding: '10px 16px 14px',
    }}>
      {sizes.map(s => (
        <span key={s} style={{
          fontSize: 11, padding: '3px 10px', borderRadius: 20,
          background: 'var(--surface2)', color: 'var(--text-muted)',
          border: '1px solid var(--border)',
        }}>{s}</span>
      ))}
    </div>
  )
}

// ── Segmented control ─────────────────────────────────────
function Segmented<T extends string | number>({ options, value, onChange, format }: {
  options: T[]
  value: T
  onChange: (v: T) => void
  format?: (v: T) => string
}) {
  return (
    <div style={{
      display: 'flex', gap: 0,
      background: 'var(--surface2)',
      borderRadius: 9, padding: 2,
    }}>
      {options.map(opt => (
        <button
          key={String(opt)}
          onClick={() => onChange(opt)}
          style={{
            flex: 1, border: 'none', padding: '6px 0', fontSize: 13,
            fontFamily: 'var(--font)', cursor: 'pointer', borderRadius: 7,
            background: value === opt ? 'var(--surface)' : 'transparent',
            color: value === opt ? 'var(--text)' : 'var(--text-muted)',
            fontWeight: value === opt ? 600 : 400,
            boxShadow: value === opt ? '0 1px 4px rgba(0,0,0,.12)' : 'none',
            transition: 'all 0.15s',
          }}
        >
          {format ? format(opt) : String(opt)}
        </button>
      ))}
    </div>
  )
}

// ── Row with label + control ───────────────────────────────
function SettingRow({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div>
        <div style={{ fontSize: 15, color: 'var(--text)' }}>{label}</div>
        {sub && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>{sub}</div>}
      </div>
      {children}
    </div>
  )
}

export function SettingsTab({ settings, onUpdate, username, onLogout }: Props) {
  const q = settings.recQuality

  const updateQ = (patch: Partial<RecordingQuality>) =>
    onUpdate({ recQuality: { ...q, ...patch } })

  const bitrateOptions: RecBitrate[] = [64, 128, 192, 256, 320]

  return (
    <div style={{ padding: '0 0 32px' }}>

      {/* ── Account ──────────────────────────────────── */}
      <SectionHeader title="Account" />
      <GroupCard>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px' }}>
          <div style={{
            width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg, var(--info), var(--accent))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 17, fontWeight: 700, color: '#fff',
          }}>
            {username[0]?.toUpperCase() ?? '?'}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{username}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Signed in</div>
          </div>
          <button
            className="btn btn-ghost btn-sm"
            onClick={onLogout}
            style={{ color: 'var(--danger)', borderColor: 'transparent' }}
          >
            Sign Out
          </button>
        </div>
      </GroupCard>

      {/* ── Appearance ───────────────────────────────── */}
      <SectionHeader title="Appearance" />
      <GroupCard>
        {(Object.keys(COLOR_SCHEMES) as ColorScheme[]).map((scheme, i) => (
          <div key={scheme}>
            {i > 0 && <Divider />}
            <div
              onClick={() => onUpdate({ colorScheme: scheme })}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 16px', cursor: 'pointer',
              }}
            >
              <SchemePreview scheme={scheme} />
              <span style={{ flex: 1, fontSize: 15, color: 'var(--text)' }}>
                {COLOR_SCHEMES[scheme].label}
              </span>
              {settings.colorScheme === scheme && (
                <span style={{ fontSize: 16, color: 'var(--accent)' }}>✓</span>
              )}
            </div>
          </div>
        ))}
      </GroupCard>

      {/* ── Transcription ────────────────────────────── */}
      <SectionHeader title="Transcription" />
      <GroupCard>
        <Toggle
          on={settings.autoTranscribe}
          onChange={v => onUpdate({ autoTranscribe: v })}
          label="Auto-transcribe after saving"
          description="Send each recording to Deepgram nova-3 automatically after saving."
        />
      </GroupCard>

      {/* ── Recording Quality ────────────────────────── */}
      <SectionHeader title="Recording Quality" />
      <GroupCard>

        {/* Bitrate */}
        <SettingRow
          label="Bitrate"
          sub="Higher = better quality, larger file"
        >
          <Segmented<RecBitrate>
            options={bitrateOptions}
            value={q.bitrate}
            onChange={v => updateQ({ bitrate: v })}
            format={v => `${v}k`}
          />
        </SettingRow>

        <Divider />

        {/* Channels */}
        <SettingRow
          label="Channels"
          sub="Mono is half the size with no audible difference for voice"
        >
          <Segmented<1 | 2>
            options={[1, 2]}
            value={q.channels}
            onChange={v => updateQ({ channels: v })}
            format={v => v === 1 ? 'Mono' : 'Stereo'}
          />
        </SettingRow>

        <Divider />

        {/* Sample rate */}
        <SettingRow
          label="Sample Rate"
          sub="44.1 kHz = CD quality · 48 kHz = studio standard"
        >
          <Segmented<44100 | 48000>
            options={[44100, 48000]}
            value={q.sampleRate}
            onChange={v => updateQ({ sampleRate: v })}
            format={v => v === 44100 ? '44.1 kHz' : '48 kHz'}
          />
        </SettingRow>

        <Divider />

        {/* File size estimate */}
        <div style={{ padding: '10px 16px 4px' }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
            Estimated file size at current settings
          </div>
        </div>
        <SizePill q={q} />

      </GroupCard>

      {/* ── Storage info ─────────────────────────────── */}
      <SectionHeader title="Storage" />
      <GroupCard>
        <div style={{ padding: '14px 16px', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.9 }}>
          <div>Recordings saved as <span style={{ color: 'var(--accent)' }}>.webm</span> or <span style={{ color: 'var(--accent)' }}>.mp4</span> on the server</div>
          <div>Transcripts saved as <span style={{ color: 'var(--accent)' }}>.transcript.json</span></div>
          <div>App settings stored locally in your browser</div>
        </div>
      </GroupCard>

    </div>
  )
}
