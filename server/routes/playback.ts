import type { FastifyInstance } from 'fastify';
import type { Pattern } from '../../shared/types.ts';
import { store } from '../store.ts';
import { selectDevices } from '../devices.ts';
import { cleanBrightness, cleanPattern } from '../validate.ts';
import * as player from '../player.ts';

export function playbackRoutes(app: FastifyInstance) {
  /** Show a saved pattern (patternId) or an unsaved one from the editor (pattern). */
  app.post<{ Body: { patternId?: string; pattern?: Pattern; deviceIds?: string[] } }>('/api/play', async (req, reply) => {
    const body = req.body ?? {};
    const pattern: Pattern | undefined = body.pattern
      ? ({ ...cleanPattern(body.pattern), id: body.pattern.id ?? 'preview' } as Pattern)
      : store.pattern(body.patternId ?? '');
    if (!pattern) return reply.code(404).send({ error: 'Pattern not found' });
    const devices = selectDevices(body.deviceIds);
    if (!devices.length) return reply.code(400).send({ error: 'Add your lights first (Lights tab)' });
    return { results: await player.play(pattern, devices) };
  });

  app.post<{ Body: { deviceIds?: string[]; on?: boolean } }>('/api/power', async (req) => {
    const on = Boolean(req.body?.on);
    const results = await Promise.all(
      selectDevices(req.body?.deviceIds).map((d) =>
        player.power(d, on).then(
          () => ({ deviceId: d.id, ok: true }),
          (e) => ({ deviceId: d.id, ok: false, error: (e as Error).message }),
        ),
      ),
    );
    return { results };
  });

  app.post<{ Body: { deviceIds?: string[]; brightness?: number } }>('/api/brightness', async (req) => {
    const brightness = cleanBrightness(req.body?.brightness);
    await Promise.allSettled(selectDevices(req.body?.deviceIds).map((d) => player.setBrightness(d, brightness)));
    return { brightness };
  });

  /** Stop Lightweave patterns and hand the lights back to the WLED app. */
  app.post<{ Body: { deviceIds?: string[] } }>('/api/release', async (req) => {
    await Promise.allSettled(selectDevices(req.body?.deviceIds).map((d) => player.release(d)));
    return { ok: true };
  });
}
