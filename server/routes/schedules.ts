import type { FastifyInstance } from 'fastify';
import type { Schedule } from '../../shared/types.ts';
import { nextEvents } from '../../shared/schedule.ts';
import { store } from '../store.ts';
import { resolvePattern } from '../scheduler.ts';
import { cleanLocation, cleanSchedule } from '../validate.ts';

/** A schedule plus when it next runs and what it would show, for the app's list. */
function withNext(s: Schedule) {
  const next = nextEvents(s, new Date(), store.settings());
  return { ...s, next: { on: next.on?.toISOString(), off: next.off?.toISOString() }, showing: resolvePattern(s)?.name };
}

const clean = (body: unknown) => cleanSchedule(body, { pattern: (id) => !!store.pattern(id), device: (id) => !!store.device(id) });

export function scheduleRoutes(app: FastifyInstance) {
  app.get('/api/schedules', async () => ({
    schedules: store.schedules().map(withNext),
    settings: store.settings(),
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  }));

  app.post('/api/schedules', async (req) => withNext(store.saveSchedule(clean(req.body))));

  app.put<{ Params: { id: string } }>('/api/schedules/:id', async (req, reply) => {
    if (!store.schedules().some((s) => s.id === req.params.id)) return reply.code(404).send({ error: 'Schedule not found' });
    return withNext(store.saveSchedule({ ...clean(req.body), id: req.params.id }));
  });

  app.delete<{ Params: { id: string } }>('/api/schedules/:id', async (req) => {
    store.removeSchedule(req.params.id);
    return { ok: true };
  });

  app.put<{ Body: { location?: unknown } }>('/api/settings', async (req) => store.updateSettings({ location: cleanLocation(req.body?.location) }));
}
