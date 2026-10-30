// The HTTP app: API routes plus the built web app.

import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { config } from './config.ts';
import { patternRoutes } from './routes/patterns.ts';
import { deviceRoutes } from './routes/devices.ts';
import { playbackRoutes } from './routes/playback.ts';
import { scheduleRoutes } from './routes/schedules.ts';
import { homeAssistantRoutes } from './routes/homeassistant.ts';

const WEB_DIST = join(import.meta.dirname, '..', 'web', 'dist');

export async function buildApp() {
  const app = Fastify({ logger: { level: config.logLevel } });

  // The app shows `error` to the user, so every failure replies { error: message }.
  // Errors without a status code are bugs: log them and keep the message generic.
  app.setErrorHandler((err: Error & { statusCode?: number }, req, reply) => {
    if (!err.statusCode) req.log.error(err);
    reply.code(err.statusCode ?? 500).send({ error: err.statusCode ? err.message : 'Something went wrong' });
  });

  patternRoutes(app);
  deviceRoutes(app);
  playbackRoutes(app);
  scheduleRoutes(app);
  homeAssistantRoutes(app);
  app.get('/api/health', async () => ({ ok: true }));

  if (existsSync(WEB_DIST)) {
    await app.register(fastifyStatic, { root: WEB_DIST });
    // Anything that isn't an API call or a file is a page of the single-page app.
    app.setNotFoundHandler((req, reply) =>
      req.url.startsWith('/api/') ? reply.code(404).send({ error: 'Not found' }) : reply.sendFile('index.html'),
    );
  }
  return app;
}
