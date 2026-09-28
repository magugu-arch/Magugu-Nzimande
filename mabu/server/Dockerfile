# The Mábu API server. Build from the mabu/ folder:
#   docker build -f server/Dockerfile -t mabu-api .
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY tsconfig.json ./
COPY src ./src
COPY server ./server
RUN npm run server:build

FROM node:22-slim
ENV NODE_ENV=production PORT=8787 MABU_MIGRATIONS_DIR=/app/server/migrations
WORKDIR /app
# Only the two runtime dependencies the bundle leaves external.
RUN npm init -y >/dev/null && npm install --omit=dev --no-audit --no-fund pg@8 nodemailer@10
COPY --from=build /app/server/dist ./server/dist
COPY server/migrations ./server/migrations
USER node
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server/dist/main.mjs"]
