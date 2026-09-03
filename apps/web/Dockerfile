# bb.q Chicken South Africa — ordering website.
#
# Multi-stage, and the stages are not decoration: the build needs the whole
# toolchain and sharp's native binaries, and the thing that runs in production
# should carry neither. What ships is the standalone output, node_modules for
# runtime only, and the generated image derivatives.
#
# Built from the repository root, because the app depends on packages/ and
# infra/ through path aliases and a build that cannot see them fails:
#
#   docker build -f apps/web/Dockerfile -t bbq-web .

# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS deps
# Pinned to a major rather than latest. A base image that moves under a
# deployment is a deployment that changes without a commit.

WORKDIR /repo

# Manifests first, so a change to source does not invalidate the install layer.
COPY apps/web/package*.json apps/web/
COPY packages/types/package*.json packages/types/
COPY infra/package*.json infra/

RUN --mount=type=cache,target=/root/.npm \
    cd apps/web && npm ci --no-audit --no-fund \
    && cd ../packages/types && npm ci --no-audit --no-fund \
    && cd ../../infra && npm ci --no-audit --no-fund

# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS build

WORKDIR /repo
COPY --from=deps /repo/apps/web/node_modules apps/web/node_modules
COPY --from=deps /repo/packages/types/node_modules packages/types/node_modules
COPY --from=deps /repo/infra/node_modules infra/node_modules
COPY . .

# The build derives the image and brand assets from the masters first, so the
# derivatives in the image are the ones the masters currently imply rather than
# whatever was last committed.
ENV NEXT_TELEMETRY_DISABLED=1
RUN cd apps/web && npm run build

# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS run

# Not root. A process that only has to read its own bundle and write one state
# file has no business being able to rewrite itself.
RUN useradd --system --create-home --uid 10001 bbq

WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    # A path outside the image, so orders survive a redeploy. Mount a volume
    # here or the state file goes with the container.
    BBQ_STATE_FILE=/var/lib/bbq/state.json

COPY --from=build --chown=bbq:bbq /repo/apps/web/.next/standalone ./
COPY --from=build --chown=bbq:bbq /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=bbq:bbq /repo/apps/web/public ./apps/web/public

RUN mkdir -p /var/lib/bbq && chown bbq:bbq /var/lib/bbq
VOLUME /var/lib/bbq

USER bbq
EXPOSE 3000

# The endpoint reports storage as well as liveness, so a container whose volume
# has gone read-only is reported unhealthy rather than quietly losing writes.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "apps/web/server.js"]
