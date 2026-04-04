# ── Build stage ───────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json ./
RUN npm install

COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# ── Production stage ──────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist

# Bundle music library into the image (static content, ships with the deploy)
COPY music/ ./music/

# Recordings dir — mount a Railway Volume here for persistence
RUN mkdir -p /app/data

EXPOSE 3025

CMD ["node", "dist/index.js"]
