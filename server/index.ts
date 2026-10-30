import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Device, Pattern } from '../shared/types.ts';
import { ANIMATIONS } from '../shared/types.ts';
import { store } from './store.ts';
import { getInfo, getState } from './wled.ts';
import * as player from './player.ts';

const PORT = Number(process.env.PORT ?? 8787);
const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'info' } });

class BadRequest extends Error {
  statusCode = 400;
}

/** Validate and normalize a pattern coming from the browser. */
function cleanPattern(body: any): Omit<Pattern, 'id'> & { id?: string } {
  if (!body || typeof body !== 'object') throw new BadRequest('Missing pattern');
  const blocks = Array.isArray(body.blocks) ? body.blocks : [];
  if (!blocks.length) throw new BadRequest('A pattern needs at least one color');
  const clamp = (n: unknown, lo: number, hi: number, d: number) =>
    Number.isFinite(Number(n)) ? Math.min(hi, Math.max(lo, Number(n))) : d;
  return {
    id: typeof body.id === 'string' ? body.id : undefined,
    name: String(body.name ?? 'My Pattern').slice(0, 60) || 'My Pattern',
    category: String(body.category ?? 'My Patterns').slice(0, 40),
    blocks: blocks.slice(0, 64).map((b: any) => ({
      color: /^#[0-9a-f]{6}$/i.test(b?.color) ? b.color.toUpperCase() : '#FFFFFF',
      count: Math.round(clamp(b?.count, 1, 100, 1)),
    })),
    animation: ANIMATIONS.includes(body.animation) ? body.animation : 'static',
    speed: clamp(body.speed, 1, 10, 4),
    direction: body.direction === 'reverse' ? 'reverse' : 'forward',
    brightness: Math.round(clamp(body.brightness, 1, 100, 80)),
    blend: Boolean(body.blend),
  };
}

function pickDevices(ids: unknown): Device[] {
  const all = store.devices();
  if (!Array.isArray(ids) || !ids.length) return all;
  return all.filter((d) => ids.includes(d.id));
}

// ---- Patterns -------------------------------------------------------------

app.get('/api/patterns', async () => ({ patterns: store.patterns(), favorites: store.favorites() }));

app.post('/api/patterns', async (req) => {
  const p = cleanPattern(req.body);
  delete p.id;
  return store.savePattern(p);
});

app.put<{ Params: { id: string } }>('/api/patterns/:id', async (req, reply) => {
  const existing = store.pattern(req.params.id);
  if (!existing) return reply.code(404).send({ error: 'Pattern not found' });
  const p = cleanPattern(req.body);
  // Editing a built-in theme saves a personal copy.
  if (existing.builtIn) {
    delete p.id;
    return store.savePattern(p);
  }
  return store.savePattern({ ...p, id: existing.id, createdAt: existing.createdAt });
});

app.delete<{ Params: { id: string } }>('/api/patterns/:id', async (req, reply) => {
  const p = store.pattern(req.params.id);
  if (!p) return reply.code(404).send({ error: 'Pattern not found' });
  if (p.builtIn) return reply.code(400).send({ error: 'Built-in themes can’t be deleted' });
  store.removePattern(p.id);
  return { ok: true };
});

app.put<{ Params: { id: string }; Body: { favorite: boolean } }>('/api/patterns/:id/favorite', async (req) => {
  store.setFavorite(req.params.id, Boolean(req.body?.favorite));
  return { favorites: store.favorites() };
});

// ---- Devices --------------------------------------------------------------

/**
 * WLED is the source of truth for how many lights a controller has. Pick up
 * changes made in WLED's LED settings and re-send the current pattern to fit.
 */
async function syncLedCount(d: Device, ledCount: number) {
  if (!ledCount || ledCount === d.ledCount) return;
  const updated = store.updateDevice(d.id, { ledCount });
  if (updated) await player.refresh(updated).catch(() => {});
}

async function withStatus(d: Device) {
  try {
    const [s, info] = await Promise.all([getState(d.host, 1500), getInfo(d.host, 1500)]);
    await syncLedCount(d, info.ledCount);
    return { ...d, ledCount: info.ledCount || d.ledCount, status: { online: true, power: s.on, playing: player.playing(d.id), error: player.errorFor(d.id) } };
  } catch {
    return { ...d, status: { online: false, playing: player.playing(d.id), error: player.errorFor(d.id) } };
  }
}

app.get('/api/devices', async () => ({ devices: await Promise.all(store.devices().map(withStatus)) }));

app.post<{ Body: { host: string } }>('/api/devices/probe', async (req, reply) => {
  const host = String(req.body?.host ?? '').trim();
  if (!host) return reply.code(400).send({ error: 'Enter an IP address' });
  try {
    return await getInfo(host);
  } catch (e) {
    return reply.code(502).send({ error: `No WLED found at ${host} (${(e as Error).message})` });
  }
});

app.post<{ Body: Partial<Device> }>('/api/devices', async (req, reply) => {
  const host = String(req.body?.host ?? '').trim();
  if (!host) return reply.code(400).send({ error: 'Enter an IP address' });
  let info;
  try {
    info = await getInfo(host);
  } catch (e) {
    return reply.code(502).send({ error: `No WLED found at ${host} (${(e as Error).message})` });
  }
  return store.addDevice({
    host,
    name: String(req.body?.name || info.name).slice(0, 40),
    ledCount: info.ledCount,
    reverse: Boolean(req.body?.reverse),
  });
});

app.put<{ Params: { id: string }; Body: Partial<Device> }>('/api/devices/:id', async (req, reply) => {
  const b = req.body ?? {};
  const patch: Partial<Device> = {};
  if (b.name !== undefined) patch.name = String(b.name).slice(0, 40);
  if (b.host !== undefined && b.host.trim() !== store.device(req.params.id)?.host) {
    patch.host = String(b.host).trim();
    try {
      patch.ledCount = (await getInfo(patch.host)).ledCount;
    } catch (e) {
      return reply.code(502).send({ error: `No WLED found at ${patch.host} (${(e as Error).message})` });
    }
  }
  if (b.reverse !== undefined) patch.reverse = Boolean(b.reverse);
  const d = store.updateDevice(req.params.id, patch);
  if (!d) return reply.code(404).send({ error: 'Device not found' });
  await player.refresh(d);
  return d;
});

app.delete<{ Params: { id: string } }>('/api/devices/:id', async (req) => {
  player.forget(req.params.id);
  store.removeDevice(req.params.id);
  return { ok: true };
});

// ---- Playback -------------------------------------------------------------

app.post<{ Body: { patternId?: string; pattern?: Pattern; deviceIds?: string[] } }>('/api/play', async (req, reply) => {
  const body = req.body ?? {};
  let pattern: Pattern | undefined;
  if (body.pattern) pattern = { id: body.pattern.id ?? 'preview', ...cleanPattern(body.pattern) } as Pattern;
  else if (body.patternId) pattern = store.pattern(body.patternId);
  if (!pattern) return reply.code(404).send({ error: 'Pattern not found' });
  const devices = pickDevices(body.deviceIds);
  if (!devices.length) return reply.code(400).send({ error: 'Add your lights first (Lights tab)' });
  return { results: await player.play(pattern, devices) };
});

app.post<{ Body: { deviceIds?: string[]; on?: boolean } }>('/api/power', async (req) => {
  const devices = pickDevices(req.body?.deviceIds);
  const on = Boolean(req.body?.on);
  const results = await Promise.all(
    devices.map((d) =>
      player.power(d, on).then(
        () => ({ deviceId: d.id, ok: true }),
        (e) => ({ deviceId: d.id, ok: false, error: (e as Error).message }),
      ),
    ),
  );
  return { results };
});

app.post<{ Body: { deviceIds?: string[] } }>('/api/release', async (req) => {
  const devices = pickDevices(req.body?.deviceIds);
  await Promise.allSettled(devices.map((d) => player.release(d)));
  return { ok: true };
});

app.get('/api/health', async () => ({ ok: true }));

// ---- Web app --------------------------------------------------------------

const webDist = join(import.meta.dirname, '..', 'web', 'dist');
if (existsSync(webDist)) {
  await app.register(fastifyStatic, { root: webDist });
  app.setNotFoundHandler((req, reply) =>
    req.url.startsWith('/api/') ? reply.code(404).send({ error: 'Not found' }) : reply.sendFile('index.html'),
  );
}

await app.listen({ port: PORT, host: '0.0.0.0' });
// Keep LED counts in step with WLED even when nobody has the app open.
setInterval(() => {
  for (const d of store.devices()) getInfo(d.host, 3000).then((i) => syncLedCount(d, i.ledCount), () => {});
}, 60_000).unref();
player.resume().catch((e) => app.log.warn(`Couldn't resume patterns: ${e.message}`));
