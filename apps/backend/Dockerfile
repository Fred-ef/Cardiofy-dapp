# syntax=docker/dockerfile:1.7
#
# Multi-stage Dockerfile per il backend Cardiofy (modulo blockchain).
# - Stage `builder`: installa TUTTE le deps (incluse dev), builda TypeScript + tsc-alias,
#   poi compatta in /app/dist + node_modules pruned.
# - Stage `runtime`: copia solo il necessario, gira come utente non-root `node`,
#   espone 3001, ha HEALTHCHECK su /api/v1/health/live.
#
# Build dal root del monorepo per onorare i workspace npm:
#   docker build -f apps/backend/Dockerfile -t cardiofy-backend .

# ─── Stage 1: builder ────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /repo

# Copia i manifest del workspace per sfruttare la cache di docker layer.
COPY package.json package-lock.json turbo.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/backend/package.json    apps/backend/
COPY apps/notary/package.json     apps/notary/

# Installa tutte le deps del workspace (npm gestisce i symlink fra workspace).
# `--ignore-scripts` evita postinstall hooks pesanti / non necessari per il build.
RUN npm ci --workspaces --include-workspace-root --ignore-scripts

# Copia i sorgenti necessari al build.
COPY packages/shared packages/shared
COPY apps/backend    apps/backend

# Build di shared prima (dipendenza), poi backend.
RUN npm run build -w @cardiofy/shared \
 && npm run build -w backend

# Prune delle deps di produzione del solo backend, in un'area separata.
RUN mkdir -p /out/node_modules \
 && cp -R apps/backend/dist                            /out/dist           \
 && cp    apps/backend/package.json                    /out/package.json   \
 && cp    apps/backend/db                              /out/db -r          \
 && npm prune --omit=dev -w backend                                        \
 && cp -R apps/backend/node_modules                    /out/node_modules-app

# ─── Stage 2: runtime ────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime
WORKDIR /app

# Tini per signal handling pulito (graceful SIGTERM).
RUN apk add --no-cache tini wget

# Copia gli artefatti del build dal builder.
COPY --from=builder /out/dist           ./dist
COPY --from=builder /out/db             ./db
COPY --from=builder /out/package.json   ./package.json
# I node_modules del workspace includono i symlink ad altri pacchetti del monorepo;
# per il runtime in container li copiamo dereferenziando (pure copy, no symlink dangling).
COPY --from=builder /out/node_modules-app/ ./node_modules
# Risolvi eventuali symlink workspace (es. @cardiofy/shared) dereferenziando i loro dist.
COPY --from=builder /repo/packages/shared/dist ./node_modules/@cardiofy/shared/dist
COPY --from=builder /repo/packages/shared/package.json ./node_modules/@cardiofy/shared/package.json

# Utente non-root: l'immagine `node` lo fornisce già di default.
USER node

ENV NODE_ENV=production \
    PORT=3001

EXPOSE 3001

HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3001/api/v1/health/live || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/index.js"]
