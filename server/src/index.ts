import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serve } from '@hono/node-server'
import fs from 'node:fs'
import path from 'node:path'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'

const PORT = Number(process.env.PORT) || 3025
const DEEPGRAM_KEY = process.env.DEEPGRAM_API_KEY || '3a11f8fe7e39741fdbe2a6a706bec8dba8d87ac0'
const JWT_SECRET = process.env.JWT_SECRET || 'prayerflow-dev-secret-change-in-prod'

const MUSIC_DIR = path.join(process.cwd(), 'music')
const RECORDINGS_DIR = path.join(process.cwd(), 'data')
const PUBLIC_DIR = path.join(process.cwd(), 'public')
const USERS_FILE = path.join(process.cwd(), 'data', 'users.json')

if (!fs.existsSync(RECORDINGS_DIR)) fs.mkdirSync(RECORDINGS_DIR, { recursive: true })

// ── User store (flat JSON file) ────────────────────────────
interface User { username: string; passwordHash: string }

function loadUsers(): User[] {
  try {
    if (fs.existsSync(USERS_FILE)) return JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'))
  } catch {}
  return []
}

function saveUsers(users: User[]) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2))
}

// ── JWT helpers ────────────────────────────────────────────
function signToken(username: string) {
  return jwt.sign({ username }, JWT_SECRET, { expiresIn: '30d' })
}

function verifyToken(token: string): { username: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { username: string }
  } catch {
    return null
  }
}

// ── Auth middleware ────────────────────────────────────────
function requireAuth(c: any): { username: string } | Response {
  const authHeader = c.req.header('authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '')
  const payload = token ? verifyToken(token) : null
  if (!payload) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    })
  }
  return payload
}

const app = new Hono()

app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Range', 'Authorization'],
  exposeHeaders: ['Content-Range', 'Accept-Ranges', 'Content-Length'],
}))

app.get('/api/health', (c) => c.json({ ok: true }))

// ── Auth: register ─────────────────────────────────────────
app.post('/api/auth/register', async (c) => {
  try {
    const { username, password } = await c.req.json<{ username: string; password: string }>()
    if (!username?.trim() || !password || password.length < 6) {
      return c.json({ error: 'Username required and password must be ≥ 6 characters' }, 400)
    }
    const users = loadUsers()
    if (users.find(u => u.username.toLowerCase() === username.toLowerCase())) {
      return c.json({ error: 'Username already taken' }, 409)
    }
    const passwordHash = await bcrypt.hash(password, 10)
    users.push({ username: username.trim(), passwordHash })
    saveUsers(users)
    const token = signToken(username.trim())
    return c.json({ ok: true, token, username: username.trim() })
  } catch (e) {
    return c.json({ error: String(e) }, 500)
  }
})

// ── Auth: login ────────────────────────────────────────────
app.post('/api/auth/login', async (c) => {
  try {
    const { username, password } = await c.req.json<{ username: string; password: string }>()
    const users = loadUsers()
    const user = users.find(u => u.username.toLowerCase() === username?.toLowerCase())
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return c.json({ error: 'Invalid username or password' }, 401)
    }
    const token = signToken(user.username)
    return c.json({ ok: true, token, username: user.username })
  } catch (e) {
    return c.json({ error: String(e) }, 500)
  }
})

// ── Auth: verify token ─────────────────────────────────────
app.get('/api/auth/me', (c) => {
  const result = requireAuth(c)
  if (result instanceof Response) return result
  return c.json({ ok: true, username: result.username })
})

const AUDIO_EXTS = ['.mp3', '.webm', '.mp4', '.wav', '.ogg', '.m4a']
const isAudio = (name: string) => AUDIO_EXTS.some(ext => name.toLowerCase().endsWith(ext))

// ── List tracks (grouped by folder) — public ──────────────
app.get('/api/tracks', (c) => {
  try {
    const result: { id: string; folder: string; name: string }[] = []
    const entries = fs.readdirSync(MUSIC_DIR, { withFileTypes: true })

    for (const e of entries) {
      if (e.isFile() && isAudio(e.name)) {
        result.push({ id: e.name, folder: '', name: e.name })
      }
    }
    for (const e of entries) {
      if (e.isDirectory()) {
        try {
          const sub = fs.readdirSync(path.join(MUSIC_DIR, e.name))
            .filter(isAudio)
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
  } catch {
    return c.json({ error: 'Cannot read music directory', tracks: [] }, 500)
  }
})

// ── Serve a track — public ────────────────────────────────
app.get('/api/tracks/*', (c) => {
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

// ── Save a recording — auth required ──────────────────────
app.post('/api/recordings', async (c) => {
  const auth = requireAuth(c)
  if (auth instanceof Response) return auth
  try {
    const formData = await c.req.formData()
    const file = formData.get('audio') as File | null
    const name = formData.get('name') as string | null
    if (!file) return c.json({ error: 'No audio file' }, 400)

    // Store under username subfolder
    const userDir = path.join(RECORDINGS_DIR, auth.username)
    if (!fs.existsSync(userDir)) fs.mkdirSync(userDir, { recursive: true })

    const safeName = (name || 'recording').replace(/[^a-zA-Z0-9_-]/g, '_')
    // Preserve actual container format so browsers serve correct MIME type
    const uploadedName = (file as File).name || ''
    const ext = uploadedName.endsWith('.mp4') ? '.mp4' : '.webm'
    const filename = `${safeName}_${Date.now()}${ext}`
    const filepath = path.join(userDir, filename)
    const buffer = Buffer.from(await file.arrayBuffer())
    fs.writeFileSync(filepath, buffer)
    return c.json({ ok: true, filename, size: buffer.length })
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})

function audioMime(filename: string): string {
  const ext = path.extname(filename).toLowerCase()
  if (ext === '.mp4') return 'audio/mp4'
  if (ext === '.mp3') return 'audio/mpeg'
  if (ext === '.wav') return 'audio/wav'
  return 'audio/webm'
}

// ── List recordings — auth required ───────────────────────
app.get('/api/recordings', (c) => {
  const auth = requireAuth(c)
  if (auth instanceof Response) return auth
  try {
    const userDir = path.join(RECORDINGS_DIR, auth.username)
    if (!fs.existsSync(userDir)) return c.json({ recordings: [] })
    const files = fs.readdirSync(userDir)
      .filter(f => f.endsWith('.webm') || f.endsWith('.mp4') || f.endsWith('.wav') || f.endsWith('.mp3'))
      .map(f => {
        const stat = fs.statSync(path.join(userDir, f))
        return { name: f, size: stat.size, createdAt: stat.birthtime.toISOString() }
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    return c.json({ recordings: files })
  } catch {
    return c.json({ recordings: [] })
  }
})

// ── Serve a recording — auth required ─────────────────────
app.get('/api/recordings/:filename', (c) => {
  const auth = requireAuth(c)
  if (auth instanceof Response) return auth
  const filename = decodeURIComponent(c.req.param('filename'))
  if (filename.includes('..')) return c.json({ error: 'Invalid' }, 400)
  const filePath = path.join(RECORDINGS_DIR, auth.username, filename)
  if (!fs.existsSync(filePath)) return c.json({ error: 'Not found' }, 404)
  const buf = fs.readFileSync(filePath)
  return new Response(buf, {
    headers: { 'Content-Type': audioMime(filename), 'Content-Length': String(buf.length), 'Accept-Ranges': 'bytes' },
  })
})

// ── Delete a recording — auth required ────────────────────
app.delete('/api/recordings/:filename', (c) => {
  const auth = requireAuth(c)
  if (auth instanceof Response) return auth
  const filename = decodeURIComponent(c.req.param('filename'))
  if (filename.includes('..')) return c.json({ error: 'Invalid' }, 400)
  const filePath = path.join(RECORDINGS_DIR, auth.username, filename)
  if (!fs.existsSync(filePath)) return c.json({ error: 'Not found' }, 404)
  fs.unlinkSync(filePath)
  return c.json({ ok: true })
})

// ── Rename a recording — auth required ────────────────────
app.patch('/api/recordings/:filename', async (c) => {
  const auth = requireAuth(c)
  if (auth instanceof Response) return auth
  const oldFilename = decodeURIComponent(c.req.param('filename'))
  if (oldFilename.includes('..')) return c.json({ error: 'Invalid' }, 400)

  const body = await c.req.json().catch(() => ({}))
  let newName: string = (body.name ?? '').trim()
  if (!newName) return c.json({ error: 'name is required' }, 400)

  // Preserve original extension
  const ext = path.extname(oldFilename)
  // Strip extension from newName if user typed it, then re-add
  const baseName = newName.replace(/\.(webm|mp4|mp3|wav)$/i, '')
  const newFilename = baseName + ext

  if (newFilename.includes('..') || newFilename.includes('/')) return c.json({ error: 'Invalid name' }, 400)

  const userDir = path.join(RECORDINGS_DIR, auth.username)
  const oldPath = path.join(userDir, oldFilename)
  const newPath = path.join(userDir, newFilename)

  if (!fs.existsSync(oldPath)) return c.json({ error: 'Not found' }, 404)
  if (oldPath !== newPath && fs.existsSync(newPath)) return c.json({ error: 'A file with that name already exists' }, 409)

  fs.renameSync(oldPath, newPath)

  // Also rename the transcript if one exists
  const oldTranscript = path.join(userDir, oldFilename.replace(/\.[^.]+$/, '') + '.transcript.json')
  const newTranscript = path.join(userDir, newFilename.replace(/\.[^.]+$/, '') + '.transcript.json')
  if (fs.existsSync(oldTranscript)) {
    fs.renameSync(oldTranscript, newTranscript)
  }

  return c.json({ ok: true, filename: newFilename })
})

// ── Copy recording into Music Library — auth required ─────
app.post('/api/recordings/:filename/add-to-library', async (c) => {
  const auth = requireAuth(c)
  if (auth instanceof Response) return auth

  const filename = decodeURIComponent(c.req.param('filename'))
  if (filename.includes('..') || filename.includes('/')) return c.json({ error: 'Invalid' }, 400)

  const body = await c.req.json().catch(() => ({}))
  // Optional target folder name inside MUSIC_DIR (defaults to 'My Recordings')
  const folder: string = ((body.folder ?? 'My Recordings') as string).replace(/[^a-zA-Z0-9 _-]/g, '').trim() || 'My Recordings'

  const userDir = path.join(RECORDINGS_DIR, auth.username)
  const srcPath = path.join(userDir, filename)
  if (!fs.existsSync(srcPath)) return c.json({ error: 'Recording not found' }, 404)

  const destDir = path.join(MUSIC_DIR, folder)
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true })

  // Use original filename but avoid collisions
  let destName = filename
  let destPath = path.join(destDir, destName)
  if (fs.existsSync(destPath)) {
    const base = path.basename(filename, path.extname(filename))
    const ext  = path.extname(filename)
    destName = `${base}_${Date.now()}${ext}`
    destPath = path.join(destDir, destName)
  }

  fs.copyFileSync(srcPath, destPath)
  return c.json({ ok: true, trackId: `${folder}/${destName}`, folder, name: destName })
})

// ── Public share: audio stream (no auth) ──────────────────
app.get('/api/share/audio/:filename', (c) => {
  const filename = decodeURIComponent(c.req.param('filename'))
  if (filename.includes('..')) return c.json({ error: 'Invalid' }, 400)
  // Search all user dirs for the file
  const userDirs = fs.existsSync(RECORDINGS_DIR)
    ? fs.readdirSync(RECORDINGS_DIR, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name)
    : []
  for (const user of userDirs) {
    const filePath = path.join(RECORDINGS_DIR, user, filename)
    if (fs.existsSync(filePath)) {
      const buf = fs.readFileSync(filePath)
      return new Response(buf, { headers: { 'Content-Type': audioMime(filename), 'Content-Length': String(buf.length), 'Accept-Ranges': 'bytes' } })
    }
  }
  return c.json({ error: 'Not found' }, 404)
})

// ── Public share: transcript (no auth) ────────────────────
app.get('/api/share/transcript/:filename', (c) => {
  const filename = decodeURIComponent(c.req.param('filename'))
  if (filename.includes('..')) return c.json({ error: 'Invalid' }, 400)
  const userDirs = fs.existsSync(RECORDINGS_DIR)
    ? fs.readdirSync(RECORDINGS_DIR, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name)
    : []
  for (const user of userDirs) {
    const jsonPath = path.join(RECORDINGS_DIR, user, filename.replace(/\.[^.]+$/, '') + '.transcript.json')
    if (fs.existsSync(jsonPath)) {
      return c.json(JSON.parse(fs.readFileSync(jsonPath, 'utf-8')))
    }
  }
  return c.json({ error: 'No transcript' }, 404)
})

// ── Get saved transcript — auth required ──────────────────
app.get('/api/transcripts/:filename', (c) => {
  const auth = requireAuth(c)
  if (auth instanceof Response) return auth
  const filename = decodeURIComponent(c.req.param('filename'))
  if (filename.includes('..')) return c.json({ error: 'Invalid' }, 400)
  const jsonPath = path.join(RECORDINGS_DIR, auth.username, filename.replace(/\.[^.]+$/, '') + '.transcript.json')
  if (!fs.existsSync(jsonPath)) return c.json({ error: 'No transcript yet' }, 404)
  return c.json(JSON.parse(fs.readFileSync(jsonPath, 'utf-8')))
})

// ── Transcribe — auth optional (falls back to searching all user dirs) ────
app.post('/api/transcripts/:filename', async (c) => {
  const filename = decodeURIComponent(c.req.param('filename'))
  if (filename.includes('..')) return c.json({ error: 'Invalid' }, 400)
  // Try auth first, then search all dirs
  const authResult = requireAuth(c)
  let filePath: string | null = null
  let saveDir: string
  if (!(authResult instanceof Response)) {
    const candidate = path.join(RECORDINGS_DIR, authResult.username, filename)
    if (fs.existsSync(candidate)) { filePath = candidate; saveDir = path.join(RECORDINGS_DIR, authResult.username) }
  }
  if (!filePath) {
    const userDirs = fs.existsSync(RECORDINGS_DIR)
      ? fs.readdirSync(RECORDINGS_DIR, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name)
      : []
    for (const user of userDirs) {
      const candidate = path.join(RECORDINGS_DIR, user, filename)
      if (fs.existsSync(candidate)) { filePath = candidate; saveDir = path.join(RECORDINGS_DIR, user); break }
    }
  }
  if (!filePath!) return c.json({ error: 'Recording not found' }, 404)

  try {
    const audioBuffer = fs.readFileSync(filePath)
    const ext = path.extname(filename).toLowerCase()
    const mime = audioMime(filename)

    const url = 'https://api.deepgram.com/v1/listen?model=nova-3&smart_format=true&punctuate=true&utterances=true&words=true&diarize=false'
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Token ${DEEPGRAM_KEY}`, 'Content-Type': mime },
      body: audioBuffer,
    })

    if (!resp.ok) {
      const errText = await resp.text()
      return c.json({ error: `Deepgram error ${resp.status}: ${errText}` }, 502)
    }

    const raw = await resp.json() as any
    const channel = raw?.results?.channels?.[0]?.alternatives?.[0]
    if (!channel) return c.json({ error: 'No transcript in response' }, 502)

    const words = (channel.words || []).map((w: any) => ({
      word: w.word, punctuated_word: w.punctuated_word || w.word,
      start: w.start, end: w.end, confidence: w.confidence,
    }))
    const utterances = (raw?.results?.utterances || []).map((u: any) => ({
      start: u.start, end: u.end, transcript: u.transcript,
      words: (u.words || []).map((w: any) => ({
        word: w.word, punctuated_word: w.punctuated_word || w.word,
        start: w.start, end: w.end, confidence: w.confidence,
      })),
    }))

    const transcript = {
      filename, transcript: channel.transcript,
      duration: raw?.metadata?.duration || 0,
      words, utterances, createdAt: new Date().toISOString(),
    }

    const jsonPath = path.join(saveDir!, filename.replace(/\.[^.]+$/, '') + '.transcript.json')
    fs.writeFileSync(jsonPath, JSON.stringify(transcript, null, 2))
    return c.json(transcript)
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})

// ── Share route — public, serves a specific user's recording ──
// URL: /api/share/:username/:filename
app.get('/api/share/:username/:filename', (c) => {
  const username = decodeURIComponent(c.req.param('username'))
  const filename = decodeURIComponent(c.req.param('filename'))
  if (username.includes('..') || filename.includes('..')) return c.json({ error: 'Invalid' }, 400)
  const filePath = path.join(RECORDINGS_DIR, username, filename)
  if (!fs.existsSync(filePath)) return c.json({ error: 'Not found' }, 404)
  const buf = fs.readFileSync(filePath)
  return new Response(buf, {
    headers: { 'Content-Type': audioMime(filename), 'Content-Length': String(buf.length), 'Accept-Ranges': 'bytes' },
  })
})

// ── Admin: bulk upload a file into a user's data dir (authenticated) ──
// POST /api/admin/upload?username=X&filename=Y  body=raw file bytes
// Used once to seed the Railway volume from local dev data.
app.post('/api/admin/upload', async (c) => {
  const auth = requireAuth(c)
  if (auth instanceof Response) return auth
  const username = c.req.query('username') || auth.username
  const filename = c.req.query('filename') || ''
  if (!filename || filename.includes('..') || username.includes('..'))
    return c.json({ error: 'Invalid params' }, 400)
  const userDir = path.join(RECORDINGS_DIR, username)
  if (!fs.existsSync(userDir)) fs.mkdirSync(userDir, { recursive: true })
  const buf = Buffer.from(await c.req.arrayBuffer())
  fs.writeFileSync(path.join(userDir, filename), buf)
  return c.json({ ok: true, path: `${username}/${filename}`, bytes: buf.length })
})

// ── Serve React client (static files + SPA fallback) ──────
app.get('*', (c) => {
  const reqPath = c.req.path
  const filePath = path.join(PUBLIC_DIR, reqPath)
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const buf = fs.readFileSync(filePath)
    const ext = path.extname(filePath).toLowerCase()
    const mimeMap: Record<string, string> = {
      '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
      '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
      '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
    }
    return new Response(buf, { headers: { 'Content-Type': mimeMap[ext] || 'application/octet-stream' } })
  }

  const index = path.join(PUBLIC_DIR, 'index.html')
  if (fs.existsSync(index)) {
    return new Response(fs.readFileSync(index), { headers: { 'Content-Type': 'text/html' } })
  }
  return c.text('Not found', 404)
})

serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(`PrayerFlow server  http://localhost:${PORT}`)
  console.log(`Music:      ${MUSIC_DIR}`)
  console.log(`Recordings: ${RECORDINGS_DIR}`)
  console.log(`Client:     ${PUBLIC_DIR}`)
})
