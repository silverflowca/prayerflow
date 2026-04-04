# ── Build stage ───────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json ./
RUN npm install

COPY tsconfig.json tsconfig.node.json* vite.config.ts index.html ./
COPY src/ ./src/
COPY public/ ./public/ 2>/dev/null || true

ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# ── Production stage ──────────────────────────────────────
FROM nginx:1.27-alpine AS runner

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
