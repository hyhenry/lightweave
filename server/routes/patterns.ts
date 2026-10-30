import type { FastifyInstance } from 'fastify';
import { store } from '../store.ts';
import { cleanPattern } from '../validate.ts';

export function patternRoutes(app: FastifyInstance) {
  app.get('/api/patterns', async () => ({ patterns: store.patterns(), favorites: store.favorites() }));

  app.post('/api/patterns', async (req) => {
    const { id: _ignored, ...p } = cleanPattern(req.body);
    return store.savePattern(p);
  });

  app.put<{ Params: { id: string } }>('/api/patterns/:id', async (req, reply) => {
    const existing = store.pattern(req.params.id);
    if (!existing) return reply.code(404).send({ error: 'Pattern not found' });
    const { id: _ignored, ...p } = cleanPattern(req.body);
    // Editing a built-in theme saves a personal copy.
    if (existing.builtIn) return store.savePattern(p);
    return store.savePattern({ ...p, id: existing.id, createdAt: existing.createdAt });
  });

  app.delete<{ Params: { id: string } }>('/api/patterns/:id', async (req, reply) => {
    const p = store.pattern(req.params.id);
    if (!p) return reply.code(404).send({ error: 'Pattern not found' });
    if (p.builtIn) return reply.code(400).send({ error: 'Built-in themes can’t be deleted' });
    store.removePattern(p.id);
    return { ok: true };
  });

  app.put<{ Params: { id: string }; Body: { favorite?: boolean } }>('/api/patterns/:id/favorite', async (req) => {
    store.setFavorite(req.params.id, Boolean(req.body?.favorite));
    return { favorites: store.favorites() };
  });
}
