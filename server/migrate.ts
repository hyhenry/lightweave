// Upgrades data saved by older versions. Pure, so it's easy to test.

import type { Pattern } from '../shared/types.ts';
import type { Data } from './store.ts';

export const DATA_VERSION = 2;

/** Brings `data` up to DATA_VERSION in place. Returns true if anything changed. */
export function migrate(data: Data, builtIns: Pattern[]): boolean {
  if ((data.version ?? 1) >= DATA_VERSION) return false;

  // v1 → v2: v1 stored the "Now showing" brightness inside the playing pattern, and
  // 80% was every pattern's default. Now brightness lives on the device and a
  // pattern's own brightness is relative to it, with 100% as normal.
  for (const p of data.patterns) if (p.brightness === 80) p.brightness = 100;
  for (const d of data.devices) {
    const active = data.active[d.id];
    d.brightness ??= active?.brightness ?? 80;
    if (active) {
      const saved = data.patterns.find((p) => p.id === active.id) ?? builtIns.find((p) => p.id === active.id);
      active.brightness = saved?.brightness ?? 100;
    }
  }

  data.version = DATA_VERSION;
  return true;
}
