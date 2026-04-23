// ── Scripture Recording tab ────────────────────────────────────

import { useState, useEffect, useCallback } from 'react'
import { BiblePicker, type VerseRef } from './BiblePicker'
import { VerseRecorder } from './VerseRecorder'
import { fmtRef } from '../lib/bibleBooks'

interface VerseSet {
  id:        string
  name:      string
  verses:    VerseRef[]
  createdAt: string
  updatedAt: string
}

interface Props {
  apiFetch: (url: string, opts?: RequestInit) => Promise<Response>
}

export function ScriptureTab({ apiFetch }: Props) {
  const [sets,          setSets]          = useState<VerseSet[]>([])
  const [loading,       setLoading]       = useState(true)
  const [activeSetId,   setActiveSetId]   = useState<string | null>(null)
  const [showPicker,    setShowPicker]    = useState(false)
  const [showNewSet,    setShowNewSet]    = useState(false)
  const [newSetName,    setNewSetName]    = useState('')
  const [creating,      setCreating]      = useState(false)
  const [editingSetId,  setEditingSetId]  = useState<string | null>(null)
  const [editName,      setEditName]      = useState('')

  const loadSets = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await apiFetch('/api/scripture/sets')
      const data = await res.json() as { sets: VerseSet[] }
      setSets(data.sets ?? [])
      if (data.sets.length > 0 && !activeSetId) setActiveSetId(data.sets[0].id)
    } catch {}
    finally { setLoading(false) }
  }, [apiFetch, activeSetId])

  useEffect(() => { loadSets() }, [loadSets])

  const activeSet = sets.find(s => s.id === activeSetId) ?? null

  const createSet = async () => {
    if (!newSetName.trim()) return
    setCreating(true)
    try {
      const res = await apiFetch('/api/scripture/sets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newSetName.trim(), verses: [] }),
      })
      const data = await res.json() as { set: VerseSet }
      setSets(prev => [...prev, data.set])
      setActiveSetId(data.set.id)
      setNewSetName('')
      setShowNewSet(false)
    } catch {}
    finally { setCreating(false) }
  }

  const deleteSet = async (id: string) => {
    const s = sets.find(x => x.id === id)
    if (!confirm(`Delete "${s?.name ?? 'this set'}" and all its recordings?`)) return
    await apiFetch(`/api/scripture/sets/${id}`, { method: 'DELETE' })
    setSets(prev => prev.filter(x => x.id !== id))
    if (activeSetId === id) setActiveSetId(sets.find(x => x.id !== id)?.id ?? null)
  }

  const renameSet = async (id: string) => {
    if (!editName.trim()) return
    await apiFetch(`/api/scripture/sets/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editName.trim() }),
    })
    setSets(prev => prev.map(s => s.id === id ? { ...s, name: editName.trim() } : s))
    setEditingSetId(null)
  }

  const addVerse = async (ref: VerseRef) => {
    if (!activeSet) return
    setShowPicker(false)
    const updated = [...activeSet.verses, ref]
    await apiFetch(`/api/scripture/sets/${activeSet.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ verses: updated }),
    })
    setSets(prev => prev.map(s => s.id === activeSet.id ? { ...s, verses: updated } : s))
  }

  const removeVerse = async (idx: number) => {
    if (!activeSet) return
    const updated = activeSet.verses.filter((_, i) => i !== idx)
    await apiFetch(`/api/scripture/sets/${activeSet.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ verses: updated }),
    })
    setSets(prev => prev.map(s => s.id === activeSet.id ? { ...s, verses: updated } : s))
  }

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>

      {/* ── Left sidebar ── */}
      <div style={{
        width: 260, flexShrink: 0,
        borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column',
        background: 'var(--surface)',
        overflowY: 'auto',
      }}>
        {/* Sidebar header */}
        <div style={{
          padding: '16px 16px 12px',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Verse Sets
          </span>
          <button
            onClick={() => setShowNewSet(true)}
            title="New set"
            style={{
              background: 'var(--accent)', border: 'none',
              borderRadius: 8, width: 32, height: 32,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: '#fff', fontSize: 20, lineHeight: 1,
            }}
          >＋</button>
        </div>

        {/* New set input */}
        {showNewSet && (
          <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', background: 'var(--surface2)', flexShrink: 0 }}>
            <input
              autoFocus
              value={newSetName}
              onChange={e => setNewSetName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') createSet(); if (e.key === 'Escape') { setShowNewSet(false); setNewSetName('') } }}
              placeholder="Set name…"
              style={{
                width: '100%', padding: '9px 12px',
                background: 'var(--surface)', border: '1px solid var(--accent)',
                borderRadius: 8, color: 'var(--text)', fontSize: 15, outline: 'none',
                fontFamily: 'var(--font)', boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button
                onClick={() => { setShowNewSet(false); setNewSetName('') }}
                className="btn btn-ghost"
                style={{ flex: 1, fontSize: 14 }}
              >Cancel</button>
              <button
                onClick={createSet}
                disabled={creating || !newSetName.trim()}
                className="btn btn-primary"
                style={{ flex: 1, fontSize: 14 }}
              >
                {creating ? '…' : 'Create'}
              </button>
            </div>
          </div>
        )}

        {loading && (
          <div style={{ padding: 24, fontSize: 14, color: 'var(--text-muted)', textAlign: 'center' }}>Loading…</div>
        )}

        {!loading && sets.length === 0 && (
          <div style={{ padding: '28px 16px', fontSize: 14, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.7 }}>
            No verse sets yet.<br />Click ＋ to create one.
          </div>
        )}

        {/* Set list */}
        {sets.map(s => (
          <div key={s.id} style={{ flexShrink: 0 }}>
            {editingSetId === s.id ? (
              <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
                <input
                  autoFocus
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') renameSet(s.id); if (e.key === 'Escape') setEditingSetId(null) }}
                  style={{
                    width: '100%', padding: '8px 10px',
                    background: 'var(--surface)', border: '1px solid var(--accent)',
                    borderRadius: 8, color: 'var(--text)', fontSize: 15, outline: 'none',
                    fontFamily: 'var(--font)', boxSizing: 'border-box',
                  }}
                />
              </div>
            ) : (
              <div
                onClick={() => setActiveSetId(s.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '12px 16px', cursor: 'pointer',
                  background: activeSetId === s.id ? 'rgba(122,162,247,.12)' : 'transparent',
                  borderLeft: `4px solid ${activeSetId === s.id ? 'var(--accent)' : 'transparent'}`,
                  borderBottom: '1px solid var(--border)',
                  transition: 'all 0.12s',
                }}
              >
                <span style={{ fontSize: 22, flexShrink: 0 }}>📖</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 14, fontWeight: 600,
                    color: activeSetId === s.id ? 'var(--accent)' : 'var(--text)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {s.name}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    {s.verses.length} verse{s.verses.length !== 1 ? 's' : ''}
                  </div>
                </div>
                <div
                  style={{ display: 'flex', gap: 4, flexShrink: 0, opacity: 0.4 }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '0.4')}
                >
                  <button
                    onClick={e => { e.stopPropagation(); setEditingSetId(s.id); setEditName(s.name) }}
                    title="Rename"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 16, padding: '2px 4px' }}
                  >✏</button>
                  <button
                    onClick={e => { e.stopPropagation(); deleteSet(s.id) }}
                    title="Delete"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: 16, padding: '2px 4px' }}
                  >🗑</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Right panel ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {!activeSet ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, color: 'var(--text-muted)', padding: 40 }}>
            <div style={{ fontSize: 64 }}>📖</div>
            <div style={{ fontSize: 16, textAlign: 'center', lineHeight: 1.8, maxWidth: 360 }}>
              Create a verse set to start recording.<br />
              Choose specific Bible verses to read and record.
            </div>
            <button onClick={() => setShowNewSet(true)} className="btn btn-primary" style={{ fontSize: 16, padding: '12px 28px' }}>
              ＋ New Verse Set
            </button>
          </div>
        ) : (
          <>
            {/* Set header */}
            <div style={{
              padding: '16px 22px', borderBottom: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0,
              background: 'var(--surface)',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  📖 {activeSet.name}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                  {activeSet.verses.length === 0
                    ? 'No verses yet — click Add Verse to begin'
                    : activeSet.verses.map(v => fmtRef(v.book, v.chapter, v.verse, v.endVerse)).join(' · ')
                  }
                </div>
              </div>
              <button
                onClick={() => setShowPicker(true)}
                className="btn btn-primary"
                style={{ flexShrink: 0, fontSize: 15, padding: '10px 20px' }}
              >
                ＋ Add Verse
              </button>
            </div>

            {/* Verse list */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '18px 22px' }}>
              {activeSet.verses.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
                  <div style={{ fontSize: 52, marginBottom: 16 }}>✝️</div>
                  <div style={{ fontSize: 15, lineHeight: 1.8 }}>
                    Add Bible verses to this set.<br />
                    Each verse gets its own recording section.
                  </div>
                  <button
                    onClick={() => setShowPicker(true)}
                    className="btn btn-primary"
                    style={{ marginTop: 24, fontSize: 15, padding: '11px 28px' }}
                  >
                    ＋ Add First Verse
                  </button>
                </div>
              ) : (
                <>
                  {activeSet.verses.map((ref, idx) => (
                    <VerseRecorder
                      key={`${ref.book}-${ref.chapter}-${ref.verse}-${ref.endVerse ?? ''}-${idx}`}
                      setId={activeSet.id}
                      ref_={ref}
                      apiFetch={apiFetch}
                      onRemoveRef={() => removeVerse(idx)}
                    />
                  ))}

                  <button
                    onClick={() => setShowPicker(true)}
                    className="btn btn-ghost"
                    style={{ width: '100%', marginTop: 8, fontSize: 15, padding: '11px 0' }}
                  >
                    ＋ Add Another Verse
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>

      {showPicker && (
        <BiblePicker
          onAdd={addVerse}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  )
}
