# PrayerFlow — VPS Deployment Guide

Target: Ubuntu 22.04 / 24.04 LTS VPS
Stack: Docker + Nginx reverse proxy + Let's Encrypt SSL
Domain example: `prayer.yourdomain.com` (replace throughout)

---

## Architecture on VPS

```
Internet
   │  HTTPS :443
   ▼
Nginx (reverse proxy + SSL termination)
   │  http://localhost:3025
   ▼
Docker container (prayerflow)
   ├── Node.js Hono server  :3025
   ├── Serves React SPA from /public/
   ├── Music library bundled in image
   └── /app/data  ←── bind-mount to /srv/prayerflow/data (recordings + users.json)
```

The app is a **single container** — the server serves both the API and the React
frontend as static files. Nginx sits in front for SSL and domain routing.

---

## Prerequisites

- Ubuntu 22.04 VPS with root / sudo access
- A domain (or subdomain) with an A record pointing to your VPS IP
- Git access to your repo (or you can SCP the built image)
- Ports 80 and 443 open in your firewall / security group

---

## Step 1 — VPS initial setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker

# Install Nginx + Certbot
sudo apt install -y nginx certbot python3-certbot-nginx

# Verify Docker works
docker run hello-world
```

---

## Step 2 — Clone the repo on the VPS

```bash
# Create app directory
sudo mkdir -p /srv/prayerflow
sudo chown $USER:$USER /srv/prayerflow
cd /srv/prayerflow

# Clone (use your actual repo URL)
git clone https://github.com/YOUR_ORG/prayerflow.git .
```

If you don't have the repo on GitHub, SCP the folder from your dev machine:

```bash
# Run this from your Windows dev machine (Git Bash / WSL)
scp -r "c:/Users/User/Documents/Kingdom Business/EFHCI/dev/silverflow/prayerflow/" user@YOUR_VPS_IP:/srv/prayerflow/
```

---

## Step 3 — Create the data directory

This is where recordings and the user database live. It persists across container rebuilds.

```bash
mkdir -p /srv/prayerflow/data
chmod 755 /srv/prayerflow/data
```

---

## Step 4 — Set environment variables

```bash
cat > /srv/prayerflow/.env <<'EOF'
PORT=3025
JWT_SECRET=CHANGE_THIS_TO_A_LONG_RANDOM_STRING_AT_LEAST_64_CHARS
DEEPGRAM_API_KEY=your_deepgram_api_key_here
EOF

chmod 600 /srv/prayerflow/.env
```

Generate a strong JWT secret:
```bash
openssl rand -hex 48
# Copy the output into JWT_SECRET above
```

---

## Step 5 — Build the Docker image

```bash
cd /srv/prayerflow

docker build -t prayerflow:latest .
```

This takes 2–5 minutes on first build (downloads Node, installs deps, compiles TypeScript, builds React).

---

## Step 6 — Run the container

```bash
docker run -d \
  --name prayerflow \
  --restart unless-stopped \
  --env-file /srv/prayerflow/.env \
  -p 127.0.0.1:3025:3025 \
  -v /srv/prayerflow/data:/app/data \
  prayerflow:latest
```

**Key flags:**
- `-p 127.0.0.1:3025:3025` — binds only to localhost (Nginx proxies; not exposed publicly)
- `-v /srv/prayerflow/data:/app/data` — recordings and users.json survive container restarts
- `--restart unless-stopped` — auto-restarts on crash or reboot

Verify it's running:
```bash
docker ps
docker logs prayerflow
# Should see: PrayerFlow server running on :3025
```

Quick smoke test:
```bash
curl http://localhost:3025/api/tracks
# Should return {"tracks":[...]}
```

---

## Step 7 — Configure Nginx

```bash
sudo nano /etc/nginx/sites-available/prayerflow
```

Paste this configuration (replace `prayer.yourdomain.com`):

```nginx
server {
    listen 80;
    server_name prayer.yourdomain.com;

    # Certbot will add SSL config below this block automatically.
    # For now just proxy everything so we can get the cert.

    location / {
        proxy_pass         http://127.0.0.1:3025;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection keep-alive;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Allow large audio file uploads (recordings)
        client_max_body_size 200M;

        # Timeout for long transcription requests
        proxy_read_timeout 120s;
        proxy_send_timeout 120s;
    }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/prayerflow /etc/nginx/sites-enabled/
sudo nginx -t        # should say "syntax is ok"
sudo systemctl reload nginx
```

---

## Step 8 — SSL certificate (Let's Encrypt)

Make sure your domain A record is already pointing to the VPS before this step.

```bash
sudo certbot --nginx -d prayer.yourdomain.com
```

Follow the prompts. Certbot automatically:
- Obtains the certificate
- Updates your Nginx config with HTTPS
- Sets up auto-renewal (via systemd timer)

Verify auto-renewal:
```bash
sudo certbot renew --dry-run
```

After Certbot runs, your Nginx config will look something like:

```nginx
server {
    listen 443 ssl;
    server_name prayer.yourdomain.com;

    ssl_certificate     /etc/letsencrypt/live/prayer.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/prayer.yourdomain.com/privkey.pem;
    include             /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam         /etc/letsencrypt/ssl-dhparams.pem;

    client_max_body_size 200M;

    location / {
        proxy_pass         http://127.0.0.1:3025;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection keep-alive;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 120s;
        proxy_send_timeout 120s;
    }
}

server {
    listen 80;
    server_name prayer.yourdomain.com;
    return 301 https://$host$request_uri;
}
```

---

## Step 9 — Open firewall

```bash
sudo ufw allow 'Nginx Full'
sudo ufw allow OpenSSH
sudo ufw enable
sudo ufw status
```

---

## Step 10 — Verify the deployment

```bash
# Check container is running
docker ps

# Check logs (no errors)
docker logs prayerflow --tail 20

# Hit the app
curl -I https://prayer.yourdomain.com/api/tracks
# Expect: HTTP/2 200

# Open in browser
# https://prayer.yourdomain.com
```

Register your first user account from the UI — that's it, you're live.

---

## Updating the app (redeploy)

```bash
cd /srv/prayerflow

# Pull latest code
git pull

# Rebuild image
docker build -t prayerflow:latest .

# Stop old container, start new one
docker stop prayerflow
docker rm prayerflow

docker run -d \
  --name prayerflow \
  --restart unless-stopped \
  --env-file /srv/prayerflow/.env \
  -p 127.0.0.1:3025:3025 \
  -v /srv/prayerflow/data:/app/data \
  prayerflow:latest

# Verify
docker logs prayerflow --tail 10
```

Recordings and user accounts in `/srv/prayerflow/data/` are untouched by rebuilds.

---

## Adding music tracks

Music is bundled into the Docker image. To add new tracks:

1. Add MP3 files to `server/music/` locally (in the correct sub-folder or root)
2. Rebuild and redeploy:

```bash
cd /srv/prayerflow
git pull   # or scp new files
docker build -t prayerflow:latest .
docker stop prayerflow && docker rm prayerflow
docker run -d --name prayerflow --restart unless-stopped \
  --env-file /srv/prayerflow/.env \
  -p 127.0.0.1:3025:3025 \
  -v /srv/prayerflow/data:/app/data \
  prayerflow:latest
```

---

## Backup recordings

Recordings live in `/srv/prayerflow/data/` on the VPS host. Back them up with:

```bash
# On VPS: create a dated archive
tar -czf ~/prayerflow-backup-$(date +%Y%m%d).tar.gz /srv/prayerflow/data/

# From your local machine: pull the backup down
scp user@YOUR_VPS_IP:~/prayerflow-backup-*.tar.gz ./
```

Set up a cron job for automated daily backups:
```bash
crontab -e
# Add this line (runs at 2am daily, keeps 30 days):
0 2 * * * tar -czf ~/prayerflow-backup-$(date +\%Y\%m\%d).tar.gz /srv/prayerflow/data/ && find ~ -name "prayerflow-backup-*.tar.gz" -mtime +30 -delete
```

---

## Environment variables reference

| Variable | Required | Description |
|---|---|---|
| `PORT` | No | Server port (default 3025) |
| `JWT_SECRET` | **Yes** | Secret for signing auth tokens — use a long random string |
| `DEEPGRAM_API_KEY` | No | Deepgram API key for transcription. Without it, transcription returns an error but recording still works. |

---

## Troubleshooting

**Container won't start**
```bash
docker logs prayerflow
# Look for: "Cannot find module", permission errors, port conflicts
```

**502 Bad Gateway from Nginx**
```bash
# Check container is actually running
docker ps
# Check it's listening
curl http://localhost:3025/api/tracks
```

**Recordings not saving after redeploy**
```bash
# Verify the bind mount exists on host
ls /srv/prayerflow/data/
# If empty, recordings were going inside the old container — re-run with -v flag
```

**SSL certificate issues**
```bash
sudo certbot certificates          # list certs
sudo systemctl status certbot.timer  # auto-renewal status
```

**Upload too large error**
```bash
# Increase client_max_body_size in Nginx config (currently 200M)
sudo nano /etc/nginx/sites-available/prayerflow
# Change: client_max_body_size 500M;
sudo systemctl reload nginx
```

**Check disk space (recordings accumulate)**
```bash
df -h /srv/prayerflow/data/
du -sh /srv/prayerflow/data/*/   # per-user usage
```
