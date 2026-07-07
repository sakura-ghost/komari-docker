FROM node:24-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    SERVER_PORT= \
    FILE_PATH=/app/.runtime \
    KOMARI_ENDPOINT= \
    KOMARI_TOKEN= \
    DISABLE_WEB_SSH=true \
    DISABLE_AUTO_UPDATE=false \
    MONTH_ROTATE=1 \
    USE_SUDO=false \
    STARTUP_INSTALL=true \
    FORCE_REINSTALL_ON_START=true \
    AUTO_ACCESS=false \
    PROJECT_URL=

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
      bash \
      ca-certificates \
      curl \
      procps \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./

RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi \
    && npm cache clean --force

COPY index.js index.html ./

RUN mkdir -p /app/.runtime

EXPOSE 3000/tcp

STOPSIGNAL SIGTERM

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.SERVER_PORT || process.env.PORT || 3000) + '/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "index.js"]
