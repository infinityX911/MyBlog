# syntax=docker/dockerfile:1
# ─────────────────────────────────────────────────────────────────────────────
# Multi-stage build for the Next.js 16 app (custom Socket.io server + Prisma).
# Goals: small final image, fast, secure (non-root), production-only runtime deps.
#
#   builder → installs ALL deps, generates Prisma client, runs `next build`
#   runner  → installs PROD-only deps, copies the built output, runs server.js
#
# We run the project's OWN server.js (not `next start`) because it attaches
# Socket.io for real-time comments/notifications on the same port.
# ─────────────────────────────────────────────────────────────────────────────

# ---- Stage 1: build ---------------------------------------------------------
FROM node:22-alpine AS builder
WORKDIR /app

# libc6-compat: needed by sharp's musl (Alpine) prebuilt binaries.
RUN apk add --no-cache libc6-compat

# Install ALL deps (incl. dev) using only the lockfile first, for layer caching.
COPY package.json package-lock.json ./
RUN npm ci

# Copy the source and build.
COPY . .
# Generate the Prisma client, then build. NEXT_TELEMETRY_DISABLED keeps builds
# quiet + offline-friendly. The build tolerates the known pre-existing TS errors
# (next.config.ts sets typescript.ignoreBuildErrors).
ENV NEXT_TELEMETRY_DISABLED=1
# prisma.config.ts's env('DATABASE_URL') throws if the var is unset. `prisma
# generate` never connects, so we pass a dummy value INLINE (only for that
# command). `next build` then runs WITHOUT it. The REAL DATABASE_URL is supplied
# at runtime by compose env_file.
RUN DATABASE_URL="mysql://build:build@localhost:3306/build" npx prisma generate && npm run build

# ---- Stage 2: runtime -------------------------------------------------------
FROM node:22-alpine AS runner
WORKDIR /app

RUN apk add --no-cache libc6-compat

# ── YouTube downloader engine ────────────────────────────────────────────────
# /api/yt/* spawns these two binaries; without them every request returns 501.
#   ffmpeg  — merges the separate video+audio (DASH) streams YouTube serves for
#             anything above ~720p, and converts audio extractions.
#   yt-dlp  — the extractor itself.
# yt-dlp is installed from PyPI rather than Alpine's package, because YouTube
# changes its player often and the distro package lags behind by months — a
# stale extractor is exactly what silently caps downloads at 360p. A rebuild
# therefore also refreshes yt-dlp.
#   bgutil-ytdlp-pot-provider — the yt-dlp PLUGIN half of the proof-of-origin
#             token setup. The generator half runs as its own compose service
#             (see docker-compose.yml); this plugin is what asks it for a token
#             and hands it to YouTube. Together they replace the "sign in and
#             give yt-dlp your cookies" workaround, so no Google account is
#             needed to get past the bot check from a datacentre IP.
#   yt-dlp-ejs — the JavaScript that yt-dlp runs to solve YouTube's player
#             challenges. Without it yt-dlp reports every JS runtime as
#             "unavailable" (even though node is right here in this image) and
#             the web client — the only one that can use a PO token — is
#             effectively unusable. node itself comes with the base image.
RUN apk add --no-cache ffmpeg python3 py3-pip \
 && pip install --break-system-packages --no-cache-dir -U \
      yt-dlp yt-dlp-ejs bgutil-ytdlp-pot-provider \
 && yt-dlp --version && ffmpeg -version | head -n 1 && node --version

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Install ONLY production deps (prisma CLI is a runtime dep now, for db push).
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Prisma schema + config, then regenerate the client against the pruned deps.
COPY prisma ./prisma
COPY prisma.config.ts ./
# Inline dummy DATABASE_URL just so `prisma generate` can load the config; the
# real value comes from the runtime env_file.
RUN DATABASE_URL="mysql://build:build@localhost:3306/build" npx prisma generate

# The built app + everything server.js needs at runtime.
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
# scheduler.js is imported by server.js (scheduled publishing) — it MUST be
# copied too, or the container dies at boot on a missing module.
COPY server.js scheduler.js next.config.ts ./
# Boot-time permission sync (see docker-entrypoint.sh). Plain JS so it runs
# without ts-node, which production does not install.
COPY scripts ./scripts
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# Uploads are written here at runtime; make it owned by the non-root user and
# mount a volume over it (see docker-compose.yml) so images survive restarts.
RUN mkdir -p public/uploads && chown -R node:node public/uploads

# Drop root.
USER node

EXPOSE 3000

# Basic liveness check the orchestrator can read.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/robots.txt').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]
