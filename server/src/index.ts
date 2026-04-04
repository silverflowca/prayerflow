import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serve } from '@hono/node-server'
import fs from 'node:fs'
import path from 'node:path'

const PORT = Number(process.env.PORT) || 3025
const DEEPGRAM_KEY = process.env.DEEPGRAM_API_KEY || ''

const MUSIC_DIR = path.join(process.cwd(), 'music')
const RECORDINGS_DIR = path.join(process.cwd(), 'data')
const PUBLIC_DIR = path.join(process.cwd(), 'public')
if (!fs.existsSync(RECORDINGS_DIR)) fs.mkdirSync(RECORDINGS_DIR, { recursive: true })

const app = new Hono()

app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Range'],
  exposeHeaders: ['Content-Range', 'Accept-Ranges', 'Content-Length'],
}))

app.get('/api/health', (c) => c.json({ ok: true }))

// ── List tracks (grouped by folder) ───────────────────────
app.get('/api/tracks', (c) => {
  try {
    // Returns: { tracks: [{ id: 'folder/file.mp3', folder: 'folder', name: 'file.mp3' }, ...] }
    const result: { id: string; folder: string; name: string }[] = []

    const entries = fs.readdirSync(MUSIC_DIR, { withFileTypes: true })

    // Root-level mp3s → folder ''
    for (const e of entries) {
      if (e.isFile() && e.name.toLowerCase().endsWith('.mp3')) {
        result.push({ id: e.name, folder: '', name: e.name })
      }
    }

    // Subdirectory mp3s → folder = dir name
    for (const e of entries) {
      if (e.isDirectory()) {
        try {
          const sub = fs.readdirSync(path.join(MUSIC_DIR, e.name))
            .filter(f => f.toLowerCase().endsWith('.mp3'))
            .sort()
          for (const f of sub) {
            result.push({ id: `${e.name}/${f}`, folder: e.name, name: f })
          }
        } catch {}
      }
    }

    result.sort((a, b) => {
      if (a.folder !== b.folder) return a.folder.localeCompare(b.folder)
      return a.name.localeCompare(b.name)
    })

    return c.json({ tracks: result })
  } catch (e) {
    return c.json({ error: 'Cannot read music directory', tracks: [] }, 500)
  }
})

// ── Serve a track — id may be 'folder/file.mp3' or 'file.mp3' ──
app.get('/api/tracks/*', (c) => {
  // Grab everything after /api/tracks/
  const raw = c.req.path.replace(/^\/api\/tracks\//, '')
  const trackId = decodeURIComponent(raw)
  if (trackId.includes('..')) return c.json({ error: 'Invalid' }, 400)
  const filePath = path.join(MUSIC_DIR, trackId)
  if (!fs.existsSync(filePath)) return c.json({ error: 'Not found' }, 404)

  const stat = fs.statSync(filePath)
  const total = stat.size
  const rangeHeader = c.req.header('range')

  if (rangeHeader) {
    const [, rangeValue] = rangeHeader.split('=')
    const [startStr, endStr] = rangeValue.split('-')
    const start = parseInt(startStr, 10)
    const end = Math.min(endStr ? parseInt(endStr, 10) : start + 1024 * 512, total - 1)
    const chunkSize = end - start + 1

    const buf = Buffer.alloc(chunkSize)
    const fd = fs.openSync(filePath, 'r')
    fs.readSync(fd, buf, 0, chunkSize, start)
    fs.closeSync(fd)

    return new Response(buf, {
      status: 206,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Range': `bytes ${start}-${end}/${total}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': String(chunkSize),
        'Cache-Control': 'no-cache',
      },
    })
  }

  // Full file
  const buf = fs.readFileSync(filePath)
  return new Response(buf, {
    status: 200,
    headers: {
      'Content-Type': 'audio/mpeg',
      'Accept-Ranges': 'bytes',
      'Content-Length': String(total),
      'Cache-Control': 'no-cache',
    },
  })
})

// ── Save a recording ──────────────────────────────────────
app.post('/api/recordings', async (c) => {
  try {
    const formData = await c.req.formData()
    const file = formData.get('audio') as File | null
    const name = formData.get('name') as string | null
    if (!file) return c.json({ error: 'No audio file' }, 400)

    const safeName = (name || 'recording').replace(/[^a-zA-Z0-9_-]/g, '_')
    const filename = `${safeName}_${Date.now()}.webm`
    const filepath = path.join(RECORDINGS_DIR, filename)
    const buffer = Buffer.from(await file.arrayBuffer())
    fs.writeFileSync(filepath, buffer)
    return c.json({ ok: true, filename, size: buffer.length })
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})

// ── List recordings ───────────────────────────────────────
app.get('/api/recordings', (c) => {
  try {
    const files = fs.readdirSync(RECORDINGS_DIR)
      .filter(f => f.endsWith('.webm') || f.endsWith('.wav') || f.endsWith('.mp3'))
      .map(f => {
        const stat = fs.statSync(path.join(RECORDINGS_DIR, f))
        return { name: f, size: stat.size, createdAt: stat.birthtime.toISOString() }
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    return c.json({ recordings: files })
  } catch {
    return c.json({ recordings: [] })
  }
})

// ── Serve a recording ─────────────────────────────────────
app.get('/api/recordings/:filename', (c) => {
  const filename = decodeURIComponent(c.req.param('filename'))
  if (filename.includes('..')) return c.json({ error: 'Invalid' }, 400)
  const filePath = path.join(RECORDINGS_DIR, filename)
  if (!fs.existsSync(filePath)) return c.json({ error: 'Not found' }, 404)
  const buf = fs.readFileSync(filePath)
  return new Response(buf, {
    headers: {
      'Content-Type': 'audio/webm',
      'Content-Length': String(buf.length),
      'Accept-Ranges': 'bytes',
    },
  })
})

// ── Delete a recording ────────────────────────────────────
app.delete('/api/recordings/:filename', (c) => {
  const filename = decodeURIComponent(c.req.param('filename'))
  if (filename.includes('..')) return c.json({ error: 'Invalid' }, 400)
  const filePath = path.join(RECORDINGS_DIR, filename)
  if (!fs.existsSync(filePath)) return c.json({ error: 'Not found' }, 404)
  fs.unlinkSync(filePath)
  return c.json({ ok: true })
})

// ── Get saved transcript ──────────────────────────────────
app.get('/api/transcripts/:filename', (c) => {
  const filename = decodeURIComponent(c.req.param('filename'))
  if (filename.includes('..')) return c.json({ error: 'Invalid' }, 400)
  const jsonPath = path.join(RECORDINGS_DIR, filename.replace(/\.[^.]+$/, '') + '.transcript.json')
  if (!fs.existsSync(jsonPath)) return c.json({ error: 'No transcript yet' }, 404)
  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'))
  return c.json(data)
})

// ── Transcribe a recording via Deepgram ───────────────────
app.post('/api/transcripts/:filename', async (c) => {
  const filename = decodeURIComponent(c.req.param('filename'))
  if (filename.includes('..')) return c.json({ error: 'Invalid' }, 400)
  const filePath = path.join(RECORDINGS_DIR, filename)
  if (!fs.existsSync(filePath)) return c.json({ error: 'Recording not found' }, 404)

  try {
    console.log(`[transcribe] Sending ${filename} to Deepgram…`)
    const audioBuffer = fs.readFileSync(filePath)

    // Determine MIME type
    const ext = path.extname(filename).toLowerCase()
    const mime = ext === '.mp3' ? 'audio/mpeg'
               : ext === '.wav' ? 'audio/wav'
               : 'audio/webm'

    // Call Deepgram — word-level timestamps, smart formatting, utterances
    const url = 'https://api.deepgram.com/v1/listen' +
      '?model=nova-3' +
      '&smart_format=true' +
      '&punctuate=true' +
      '&utterances=true' +
      '&words=true' +
      '&diarize=false'

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${DEEPGRAM_KEY}`,
        'Content-Type': mime,
      },
      body: audioBuffer,
    })

    if (!resp.ok) {
      const errText = await resp.text()
      console.error('[transcribe] Deepgram error:', resp.status, errText)
      return c.json({ error: `Deepgram error ${resp.status}: ${errText}` }, 502)
    }

    const raw = await resp.json() as any

    // Flatten to a clean format the client can use directly
    const channel = raw?.results?.channels?.[0]?.alternatives?.[0]
    if (!channel) return c.json({ error: 'No transcript in response' }, 502)

    const words: Array<{ word: string; start: number; end: number; confidence: number; punctuated_word: string }> =
      (channel.words || []).map((w: any) => ({
        word: w.word,
        punctuated_word: w.punctuated_word || w.word,
        start: w.start,
        end: w.end,
        confidence: w.confidence,
      }))

    const utterances = (raw?.results?.utterances || []).map((u: any) => ({
      start: u.start,
      end: u.end,
      transcript: u.transcript,
      words: (u.words || []).map((w: any) => ({
        word: w.word,
        punctuated_word: w.punctuated_word || w.word,
        start: w.start,
        end: w.end,
        confidence: w.confidence,
      })),
    }))

    const transcript = {
      filename,
      transcript: channel.transcript,
      duration: raw?.metadata?.duration || 0,
      words,
      utterances,
      createdAt: new Date().toISOString(),
    }

    // Save alongside the recording
    const jsonPath = path.join(RECORDINGS_DIR, filename.replace(/\.[^.]+$/, '') + '.transcript.json')
    fs.writeFileSync(jsonPath, JSON.stringify(transcript, null, 2))
    console.log(`[transcribe] Saved ${words.length} words to ${jsonPath}`)

    return c.json(transcript)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[transcribe] error:', msg)
    return c.json({ error: msg }, 500)
  }
})

// ── Serve React client (static files + SPA fallback) ──────
app.get('*', (c) => {
  const reqPath = c.req.path

  // Try to serve exact file from public dir
  const filePath = path.join(PUBLIC_DIR, reqPath)
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const buf = fs.readFileSync(filePath)
    const ext = path.extname(filePath).toLowerCase()
    const mime: Record<string, string> = {
      '.html': 'text/html',
      '.js': 'application/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon',
      '.woff': 'font/woff',
      '.woff2': 'font/woff2',
      '.ttf': 'font/ttf',
    }
    return new Response(buf, {
      headers: { 'Content-Type': mime[ext] || 'application/octet-stream' },
    })
  }

  // SPA fallback — serve index.html for all unmatched routes
  const index = path.join(PUBLIC_DIR, 'index.html')
  if (fs.existsSync(index)) {
    return new Response(fs.readFileSync(index), {
      headers: { 'Content-Type': 'text/html' },
    })
  }

  return c.text('Not found', 404)
})

serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(`PrayerFlow server  http://localhost:${PORT}`)
  console.log(`Music:      ${MUSIC_DIR}`)
  console.log(`Recordings: ${RECORDINGS_DIR}`)
  console.log(`Client:     ${PUBLIC_DIR}`)
})
