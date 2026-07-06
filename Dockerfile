FROM node:24-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV FILE_PATH=/app/.runtime
ENV KOMARI_ENDPOINT=
ENV KOMARI_TOKEN=
ENV DISABLE_WEB_SSH=true
ENV MONTH_ROTATE=1
ENV DISABLE_AUTO_UPDATE=true

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
      bash \
      ca-certificates \
      curl \
      procps \
    && rm -rf /var/lib/apt/lists/*

COPY package.json ./
RUN npm install --omit=dev

COPY index.js ./
COPY index.html ./

EXPOSE 3000

CMD ["node", "index.js"]
