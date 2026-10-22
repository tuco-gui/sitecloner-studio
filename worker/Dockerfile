FROM node:24-bookworm-slim
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium ca-certificates fonts-liberation tini \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund \
    && npm install -g --no-audit --no-fund rea-agents@6.7.0
COPY worker/server.js /app/worker/server.js
ENV CHROMIUM_PATH=/usr/bin/chromium PORT=8790 HOST=0.0.0.0 HOME=/tmp
USER node
EXPOSE 8790
ENTRYPOINT ["/usr/bin/tini","--"]
CMD ["node","worker/server.js"]
