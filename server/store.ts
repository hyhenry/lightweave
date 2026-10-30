// Tiny JSON-file store. Everything lives in $DATA_DIR/lightweave.json so a single
// Docker volume holds all of a household's devices and patterns.

import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Device, Pattern } from '../shared/types.ts';
import { BUILT_IN_THEMES } from '../shared/themes.ts';

interface Data {
  devices: Device[];
  patterns: Pattern[]; // user-made only; built-ins come from code
  favorites: string[];
  /** What each device was showing, so animations resume after a restart. */
  active: Record<string, Pattern>;
  /** Devices switched off from Lightweave; their active pattern comes back on "Turn on". */
  off: string[];
}

const DATA_DIR = process.env.DATA_DIR ?? join(process.cwd(), 'data');
const FILE = join(DATA_DIR, 'lightweave.json');

function load(): Data {
  const empty: Data = { devices: [], patterns: [], favorites: [], active: {}, off: [] };
  try {
    return { ...empty, ...JSON.parse(readFileSync(FILE, 'utf8')) };
  } catch {
    return empty;
  }
}

let data = load();

function save() {
  mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${FILE}.tmp`;
  writeFileSync(tmp, JSON.stringify(data, null, 2));
  renameSync(tmp, FILE);
}

export const store = {
  devices: () => data.devices,
  device: (id: string) => data.devices.find((d) => d.id === id),
  addDevice(d: Omit<Device, 'id'>): Device {
    const dev = { ...d, id: randomUUID() };
    data.devices.push(dev);
    save();
    return dev;
  },
  updateDevice(id: string, patch: Partial<Device>): Device | undefined {
    const d = data.devices.find((x) => x.id === id);
    if (!d) return;
    Object.assign(d, patch, { id });
    save();
    return d;
  },
  removeDevice(id: string) {
    data.devices = data.devices.filter((d) => d.id !== id);
    delete data.active[id];
    data.off = data.off.filter((x) => x !== id);
    save();
  },

  patterns: (): Pattern[] => [...data.patterns, ...BUILT_IN_THEMES],
  pattern: (id: string) => data.patterns.find((p) => p.id === id) ?? BUILT_IN_THEMES.find((p) => p.id === id),
  savePattern(p: Omit<Pattern, 'id'> & { id?: string }): Pattern {
    const now = Date.now();
    const existing = p.id ? data.patterns.find((x) => x.id === p.id) : undefined;
    if (existing) {
      Object.assign(existing, p, { builtIn: false, updatedAt: now });
      save();
      return existing;
    }
    const created: Pattern = { ...p, id: randomUUID(), builtIn: false, createdAt: now, updatedAt: now };
    data.patterns.unshift(created);
    save();
    return created;
  },
  removePattern(id: string) {
    data.patterns = data.patterns.filter((p) => p.id !== id);
    data.favorites = data.favorites.filter((f) => f !== id);
    save();
  },

  favorites: () => data.favorites,
  setFavorite(id: string, on: boolean) {
    data.favorites = data.favorites.filter((f) => f !== id);
    if (on) data.favorites.unshift(id);
    save();
  },

  active: () => data.active,
  setActive(deviceId: string, p: Pattern | undefined) {
    if (p) data.active[deviceId] = p;
    else delete data.active[deviceId];
    data.off = data.off.filter((x) => x !== deviceId);
    save();
  },
  isOff: (deviceId: string) => data.off.includes(deviceId),
  setOff(deviceId: string, off: boolean) {
    data.off = data.off.filter((x) => x !== deviceId);
    if (off) data.off.push(deviceId);
    save();
  },
};
