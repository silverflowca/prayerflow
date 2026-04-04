# ── Build server ──────────────────────────────────────────
FROM node:22-alpine AS server-builder
WORKDIR /app
COPY server/package.json ./
RUN npm install
COPY server/tsconfig.json ./
COPY server/src/ ./src/
RUN npm run build

# ── Build client ──────────────────────────────────────────
FROM node:22-alpine AS client-builder
WORKDIR /app
COPY client/package.json ./
RUN npm install
COPY client/tsconfig.json ./
COPY client/vite.config.ts ./
COPY client/index.html ./
COPY client/src/ ./src/
RUN npm run build

# ── Production stage ──────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

COPY server/package.json ./
RUN npm install --omit=dev

# Server compiled output
COPY --from=server-builder /app/dist ./dist

# Client built files served as static assets
COPY --from=client-builder /app/dist ./public

# Music library bundled into image
COPY server/music/ ./music/

# Recordings dir — mount a Railway Volume here for persistence
RUN mkdir -p /app/data

EXPOSE 3025

CMD ["node", "dist/index.js"]
