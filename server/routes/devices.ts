import type { FastifyInstance, FastifyReply } from 'fastify';
import type { Device } from '../../shared/types.ts';
import { getInfo } from '../wled/client.ts';
import { store } from '../store.ts';
import { forgetAudio, setAudioSource, setOwnMic, withStatus } from '../devices.ts';
import { cleanDeviceName } from '../validate.ts';
import * as player from '../player.ts';

const notFound = (reply: FastifyReply) => reply.code(404).send({ error: 'Device not found' });

/** Look a controller up, or reply with a friendly error. */
async function probe(host: string, reply: FastifyReply) {
  try {
    return await getInfo(host);
  } catch (e) {
    reply.code(502).send({ error: `No WLED found at ${host} (${(e as Error).message})` });
  }
}

export function deviceRoutes(app: FastifyInstance) {
  app.get('/api/devices', async () => ({ devices: await Promise.all(store.devices().map(withStatus)) }));

  app.post<{ Body: { host?: string } }>('/api/devices/probe', async (req, reply) => {
    const host = String(req.body?.host ?? '').trim();
    if (!host) return reply.code(400).send({ error: 'Enter an IP address' });
    return (await probe(host, reply)) ?? reply;
  });

  app.post<{ Body: Partial<Device> }>('/api/devices', async (req, reply) => {
    const host = String(req.body?.host ?? '').trim();
    if (!host) return reply.code(400).send({ error: 'Enter an IP address' });
    const info = await probe(host, reply);
    if (!info) return reply;
    return store.addDevice({
      host,
      name: cleanDeviceName(req.body?.name || info.name),
      ledCount: info.ledCount, // always from WLED
      reverse: Boolean(req.body?.reverse),
      brightness: 80,
    });
  });

  app.put<{ Params: { id: string }; Body: Partial<Device> }>('/api/devices/:id', async (req, reply) => {
    const current = store.device(req.params.id);
    if (!current) return notFound(reply);
    const b = req.body ?? {};
    const patch: Partial<Device> = {};
    if (b.name !== undefined) patch.name = cleanDeviceName(b.name);
    if (b.reverse !== undefined) patch.reverse = Boolean(b.reverse);
    const host = b.host === undefined ? undefined : String(b.host).trim();
    if (host && host !== current.host) {
      const info = await probe(host, reply);
      if (!info) return reply;
      Object.assign(patch, { host, ledCount: info.ledCount });
      forgetAudio(current.id);
    }
    const d = store.updateDevice(current.id, patch)!;
    await player.refresh(d);
    return d;
  });

  /** Turn sound passthrough from another WLED on (sourceId) or off (null). */
  app.put<{ Params: { id: string }; Body: { sourceId?: string | null } }>('/api/devices/:id/audio', async (req, reply) => {
    const target = store.device(req.params.id);
    if (!target) return notFound(reply);
    return { audio: await setAudioSource(target, req.body?.sourceId ?? null) };
  });

  /** Turn a controller's own microphone on or off. */
  app.put<{ Params: { id: string }; Body: { enabled?: boolean } }>('/api/devices/:id/mic', async (req, reply) => {
    const target = store.device(req.params.id);
    if (!target) return notFound(reply);
    return { audio: await setOwnMic(target, Boolean(req.body?.enabled)) };
  });

  app.delete<{ Params: { id: string } }>('/api/devices/:id', async (req) => {
    player.forget(req.params.id);
    forgetAudio(req.params.id);
    store.removeDevice(req.params.id);
    return { ok: true };
  });
}
