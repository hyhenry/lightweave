# Built on the Home Assistant device by the Supervisor. `app/` is bundled by
# `npm run build:ha`, with the web app already built.
FROM node:24-alpine
RUN apk add --no-cache tzdata
WORKDIR /app
ENV NODE_ENV=production PORT=8787 DATA_DIR=/data
COPY app/package.json app/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY app/ ./
CMD ["node", "server/index.ts"]
