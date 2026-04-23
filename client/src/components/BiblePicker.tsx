// ── Bible verse picker — book → chapter → verse(s) ───────────
// Fetches verse text from bible-api.com (WEB translation, no key)

import { useState, useEffect, useRef } from 'react'
import { BIBLE_BOOKS, getVerseCount, fmtRef } from '../lib/bibleBooks'

export interface VerseRef {
  book:      string
  chapter:   number
  verse:     number
  endVerse?: number
  text?:     string   // fetched from API
}

interface Props {
  onAdd:    (ref: VerseRef) => void
  onClose:  () => void
}

type Step = 'book' | 'chapter' | 'verse'

const OT = BIBLE_BOOKS.filter(b => b.testament === 'OT')
const NT = BIBLE_BOOKS.filter(b => b.testament === 'NT')

async function fetchVerseText(book: string, chapter: number, verse: number, endVerse?: number): Promise<string> {
  const range = endVerse && endVerse !== verse ? `-${endVerse}` : ''
  const ref = `${encodeURIComponent(book)}+${chapter}:${verse}${range}`
  try {
    const res = await fetch(`https://bible-api.com/${ref}?translation=web`)
    if (!res.ok) return ''
    const data = await res.json() as { text?: string; verses?: Array<{ text: string }> }
    return (data.text ?? data.verses?.map(v => v.text).join(' ') ?? '').replace(/\n/g, ' ').trim()
  } catch {
    return ''
  }
}

export function BiblePicker({ onAdd, onClose }: Props) {
  const [step,     setStep]     = useState<Step>('book')
  const [bookSearch, setBookSearch] = useState('')
  const [book,     setBook]     = useState('')
  const [chapter,  setChapter]  = useState(0)
  const [verse,    setVerse]    = useState(0)
  const [endVerse, setEndVerse] = useState(0)
  const [verseText, setVerseText] = useState('')
  const [loadingText, setLoadingText] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  const selectedBook = BIBLE_BOOKS.find(b => b.id === book)

  // Auto-fetch verse text when verse is selected
  useEffect(() => {
    if (!book || !chapter || !verse) return
    setLoadingText(true)
    fetchVerseText(book, chapter, verse, endVerse || undefined)
      .then(t => { setVerseText(t); setLoadingText(false) })
  }, [book, chapter, verse, endVerse])

  // Focus search on open
  useEffect(() => {
    if (step === 'book') setTimeout(() => searchRef.current?.focus(), 60)
  }, [step])

  const filteredOT = OT.filter(b => b.name.toLowerCase().includes(bookSearch.toLowerCase()) || b.abbr.toLowerCase().includes(bookSearch.toLowerCase()))
  const filteredNT = NT.filter(b => b.name.toLowerCase().includes(bookSearch.toLowerCase()) || b.abbr.toLowerCase().includes(bookSearch.toLowerCase()))

  const selectBook = (id: string) => { setBook(id); setChapter(0); setVerse(0); setEndVerse(0); setVerseText(''); setStep('chapter') }
  const selectChapter = (ch: number) => { setChapter(ch); setVerse(0); setEndVerse(0); setVerseText(''); setStep('verse') }

  const verseCount = selectedBook && chapter ? getVerseCount(selectedBook.id, chapter) : 0
  const refLabel = verse ? fmtRef(book, chapter, verse, endVerse || undefined) : ''

  const handleAdd = () => {
    if (!book || !chapter || !verse) return
    onAdd({ book, chapter, verse, endVerse: endVerse || undefined, text: verseText || undefined })
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 400,
      background: 'rgba(0,0,0,0.65)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(4px)',
    }} onClick={onClose}>
      <div
        style={{
          width: '94%', maxWidth: 620, maxHeight: '90vh',
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 16, overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '16px 18px 12px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          {step !== 'book' && (
            <button
              onClick={() => { if (step === 'verse') setStep('chapter'); else setStep('book') }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: 22, padding: '0 6px', lineHeight: 1 }}
            >←</button>
          )}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
              {step === 'book'    ? '📖 Choose Book'    : ''}
              {step === 'chapter' ? `${book} — Choose Chapter` : ''}
              {step === 'verse'   ? `${book} ${chapter} — Choose Verse` : ''}
            </div>
            {refLabel && (
              <div style={{ fontSize: 14, color: 'var(--accent)', marginTop: 3 }}>{refLabel}</div>
            )}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 24, lineHeight: 1 }}>×</button>
        </div>

        {/* Book search */}
        {step === 'book' && (
          <div style={{ padding: '12px 16px 8px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            <input
              ref={searchRef}
              value={bookSearch}
              onChange={e => setBookSearch(e.target.value)}
              placeholder="Search book…"
              style={{
                width: '100%', padding: '10px 14px',
                background: 'var(--surface2)', border: '1px solid var(--border)',
                borderRadius: 9, color: 'var(--text)', fontSize: 15, outline: 'none',
                fontFamily: 'var(--font)', boxSizing: 'border-box',
              }}
            />
          </div>
        )}

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>

          {/* Book list */}
          {step === 'book' && (
            <>
              {filteredOT.length > 0 && (
                <>
                  <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-muted)', textTransform: 'uppercase', padding: '4px 4px 8px' }}>
                    Old Testament
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 7, marginBottom: 14 }}>
                    {filteredOT.map(b => (
                      <button key={b.id} onClick={() => selectBook(b.id)} style={{
                        padding: '10px 8px', borderRadius: 9, border: '1px solid var(--border)',
                        background: 'var(--surface2)', cursor: 'pointer', textAlign: 'left',
                        fontSize: 14, fontFamily: 'var(--font)',
                        color: 'var(--text)', transition: 'all 0.1s',
                      }}
                        onMouseEnter={e => { (e.target as HTMLButtonElement).style.borderColor = 'var(--accent)'; (e.target as HTMLButtonElement).style.color = 'var(--accent)' }}
                        onMouseLeave={e => { (e.target as HTMLButtonElement).style.borderColor = 'var(--border)'; (e.target as HTMLButtonElement).style.color = 'var(--text)' }}
                      >
                        <div style={{ fontWeight: 700 }}>{b.abbr}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.name}</div>
                      </button>
                    ))}
                  </div>
                </>
              )}
              {filteredNT.length > 0 && (
                <>
                  <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-muted)', textTransform: 'uppercase', padding: '4px 4px 8px' }}>
                    New Testament
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 7 }}>
                    {filteredNT.map(b => (
                      <button key={b.id} onClick={() => selectBook(b.id)} style={{
                        padding: '10px 8px', borderRadius: 9, border: '1px solid var(--border)',
                        background: 'var(--surface2)', cursor: 'pointer', textAlign: 'left',
                        fontSize: 14, fontFamily: 'var(--font)',
                        color: 'var(--text)', transition: 'all 0.1s',
                      }}
                        onMouseEnter={e => { (e.target as HTMLButtonElement).style.borderColor = 'var(--accent)'; (e.target as HTMLButtonElement).style.color = 'var(--accent)' }}
                        onMouseLeave={e => { (e.target as HTMLButtonElement).style.borderColor = 'var(--border)'; (e.target as HTMLButtonElement).style.color = 'var(--text)' }}
                      >
                        <div style={{ fontWeight: 700 }}>{b.abbr}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.name}</div>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          {/* Chapter grid */}
          {step === 'chapter' && selectedBook && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8 }}>
              {Array.from({ length: selectedBook.chapters }, (_, i) => i + 1).map(ch => (
                <button key={ch} onClick={() => selectChapter(ch)} style={{
                  padding: '12px 4px', borderRadius: 9,
                  border: `1px solid ${chapter === ch ? 'var(--accent)' : 'var(--border)'}`,
                  background: chapter === ch ? 'rgba(122,162,247,.15)' : 'var(--surface2)',
                  color: chapter === ch ? 'var(--accent)' : 'var(--text)',
                  cursor: 'pointer', fontSize: 15, fontWeight: 700,
                  fontFamily: 'var(--font)',
                }}>
                  {ch}
                </button>
              ))}
            </div>
          )}

          {/* Verse grid + range + preview */}
          {step === 'verse' && (
            <>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 10 }}>Start verse:</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 6, marginBottom: 18 }}>
                {Array.from({ length: verseCount }, (_, i) => i + 1).map(v => (
                  <button key={v} onClick={() => { setVerse(v); setEndVerse(v) }} style={{
                    padding: '9px 2px', borderRadius: 8,
                    border: `1px solid ${verse === v ? 'var(--accent)' : 'var(--border)'}`,
                    background: verse === v ? 'rgba(122,162,247,.15)' : 'var(--surface2)',
                    color: verse === v ? 'var(--accent)' : 'var(--text)',
                    cursor: 'pointer', fontSize: 14, fontWeight: 700,
                    fontFamily: 'var(--font)',
                  }}>
                    {v}
                  </button>
                ))}
              </div>

              {verse > 0 && (
                <>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 10 }}>End verse (for a range):</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 6, marginBottom: 18 }}>
                    {Array.from({ length: verseCount - verse + 1 }, (_, i) => verse + i).map(v => (
                      <button key={v} onClick={() => setEndVerse(v)} style={{
                        padding: '9px 2px', borderRadius: 8,
                        border: `1px solid ${endVerse === v ? 'var(--cyan)' : 'var(--border)'}`,
                        background: endVerse >= verse && v <= endVerse && v >= verse ? 'rgba(125,207,255,.1)' : 'var(--surface2)',
                        color: endVerse === v ? 'var(--cyan)' : (v <= endVerse && v >= verse ? 'var(--text)' : 'var(--text-muted)'),
                        cursor: 'pointer', fontSize: 14, fontWeight: endVerse === v ? 700 : 400,
                        fontFamily: 'var(--font)',
                      }}>
                        {v}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {/* Verse text preview */}
              {verse > 0 && (
                <div style={{
                  background: 'var(--surface2)', border: '1px solid var(--border)',
                  borderRadius: 12, padding: '14px 16px', marginBottom: 14,
                  minHeight: 70,
                }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', marginBottom: 8, letterSpacing: '0.04em' }}>
                    {fmtRef(book, chapter, verse, endVerse || undefined)} (WEB)
                  </div>
                  {loadingText
                    ? <div style={{ fontSize: 15, color: 'var(--text-muted)', fontStyle: 'italic' }}>Loading…</div>
                    : verseText
                      ? <div style={{ fontSize: 15, color: 'var(--text)', lineHeight: 1.75, fontStyle: 'italic' }}>"{verseText}"</div>
                      : <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>—</div>
                  }
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer — only shown on verse step with a selection */}
        {step === 'verse' && verse > 0 && (
          <div style={{
            padding: '14px 18px', borderTop: '1px solid var(--border)',
            display: 'flex', gap: 12, flexShrink: 0,
          }}>
            <button onClick={onClose} className="btn btn-ghost" style={{ flex: 1, fontSize: 15, padding: '11px 0' }}>Cancel</button>
            <button onClick={handleAdd} className="btn btn-primary" style={{ flex: 2, fontSize: 15, padding: '11px 0' }}>
              ＋ Add {fmtRef(book, chapter, verse, endVerse || undefined)}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
