import type { FastifyInstance } from 'fastify';
import { store } from '../store.ts';
import { sameHost } from '../wled/client.ts';
import { inHomeAssistant, wledFromHomeAssistant } from '../homeassistant.ts';

export function homeAssistantRoutes(app: FastifyInstance) {
  app.get('/api/info', async () => ({ homeAssistant: inHomeAssistant }));

  /** WLED controllers Home Assistant knows about, marking the ones already added here. */
  app.get('/api/homeassistant/wled', async () => {
    const devices = store.devices();
    const found = await wledFromHomeAssistant();
    return { devices: found.map((w) => ({ ...w, added: devices.some((d) => sameHost(d.host, w.host)) })) };
  });
}
