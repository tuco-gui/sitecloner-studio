FROM node:24-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund
COPY lib/ai-builder ./lib/ai-builder
COPY worker/builder-server.js ./worker/builder-server.js
RUN mkdir -p /data/sitecloner-builder && chown -R node:node /data
USER node
ENV PORT=8791 HOST=0.0.0.0 BUILDER_DATA_DIR=/data/sitecloner-builder
VOLUME ["/data"]
EXPOSE 8791
CMD ["node","worker/builder-server.js"]
