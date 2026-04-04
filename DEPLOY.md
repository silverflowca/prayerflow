# PrayerFlow — Railway Deployment

## Architecture

Two Railway services in the same project:
- **prayerflow-server** — Hono API, music library bundled in image, recordings on a volume
- **prayerflow-client** — nginx + React SPA, proxies `/api` to server via internal DNS

## How it works automatically

- **Music library** — bundled directly into the Docker image at build time. No uploads or volumes needed. Just deploy and it works.
- **Recordings** — stored on a Railway Volume at `/app/data`. Persists across deploys. Railway creates this volume automatically from the `railway.json` config.

---

## Step 1 — Deploy the Server

1. In Railway, create a new project → **Add Service → GitHub Repo** → select this repo
2. **CRITICAL — Set Root Directory:** In the service settings → **Source** → set **Root Directory** to `server`
   - This tells Railway to build from `server/` and use `server/Dockerfile`
   - Without this, Railway reads the root `package.json` and fails to detect the start command
3. Set **one** environment variable:

| Variable | Value |
|----------|-------|
| `DEEPGRAM_API_KEY` | Your Deepgram API key |

Railway auto-creates the `/app/data` volume from `railway.json`. Music is bundled in the image.

---

## Step 2 — Deploy the Client

1. In the same Railway project → **Add Service → GitHub Repo** → select this repo again
2. **CRITICAL — Set Root Directory:** In the service settings → **Source** → set **Root Directory** to `client`
3. No environment variables needed
4. The nginx `/api` proxy resolves `prayerflow-server` via Railway's internal DNS automatically (same project = internal hostname works)

---

## Environment Variables

### Server
| Variable | Required | Description |
|----------|----------|-------------|
| `DEEPGRAM_API_KEY` | Yes | Deepgram API key for transcription |
| `PORT` | Auto (Railway sets it) | Server port, defaults to 3025 |

### Client
None.

---

## Adding New Music

To add MP3s, add files to `server/music/` and redeploy the server service. Railway rebuilds the image with the new tracks included.

Folder structure:
```
server/music/
├── track.mp3           # root-level tracks (no folder)
├── brave/
│   └── song.mp3
├── calm/
│   └── track.mp3
└── ...
```

---

## Local Build Test

```bash
# Server
cd prayerflow/server
npm install
npm run build
DEEPGRAM_API_KEY=your_key node dist/index.js

# Client
cd prayerflow/client
npm install
npm run build
npx serve dist
```

---

## Troubleshooting

**"No start command detected" / Railpack error** — Railway is building from the wrong directory. Go to service settings → Source → set **Root Directory** to `server` (for the server service) or `client` (for the client service). This is the most common setup mistake.

**No tracks appear** — Check that `server/music/` contains `.mp3` files. They're bundled at build time so a redeploy is needed after adding files.

**Transcription fails** — Verify `DEEPGRAM_API_KEY` is set in Railway server service env vars.

**`/share/:filename` returns 404 on refresh** — nginx `try_files` handles SPA routing. If seeing 404s, verify the client deployed successfully.

**API calls fail from client** — Both services must be in the same Railway project for internal DNS (`prayerflow-server`) to resolve. Check service names match.

**Recordings lost after redeploy** — The `/app/data` volume must be mounted. Verify it appears in Railway service → Volumes tab.
