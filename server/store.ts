// Tiny JSON-file store. Everything lives in $DATA_DIR/lightweave.json so a single
// Docker volume holds all of a household's devices and patterns.

import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Device, Pattern, Schedule, Settings } from '../shared/types.ts';
import { BUILT_IN_THEMES } from '../shared/themes.ts';
import { config } from './config.ts';
import { migrate } from './migrate.ts';

export interface Data {
  version?: number;
  devices: Device[];
  patterns: Pattern[]; // user-made only; built-ins come from code
  favorites: string[];
  /** What each device was showing, so it can come back after "off" or a restart. */
  active: Record<string, Pattern>;
  /** Devices switched off from Lightweave; their active pattern returns when turned on. */
  off: string[];
  schedules: Schedule[];
  settings: Settings;
}

const SAVE_DELAY_MS = 500;

type New<T extends { id: string }> = Omit<T, 'id'> & { id?: string };

export function createStore(dataDir: string) {
  const file = join(dataDir, 'lightweave.json');
  const empty: Data = { devices: [], patterns: [], favorites: [], active: {}, off: [], schedules: [], settings: {} };

  let data: Data;
  try {
    data = { ...empty, ...JSON.parse(readFileSync(file, 'utf8')) };
  } catch {
    data = empty;
  }

  // Changes are written at most every SAVE_DELAY_MS (a dragged brightness slider
  // would otherwise rewrite the file several times a second). flush() writes now.
  let pending: NodeJS.Timeout | undefined;
  function flush() {
    clearTimeout(pending);
    pending = undefined;
    mkdirSync(dataDir, { recursive: true });
    const tmp = `${file}.tmp`;
    writeFileSync(tmp, JSON.stringify(data, null, 2));
    renameSync(tmp, file);
  }
  function save() {
    pending ??= setTimeout(flush, SAVE_DELAY_MS);
  }

  if (migrate(data, BUILT_IN_THEMES) && (data.devices.length || data.patterns.length)) flush();

  return {
    /** Write any unsaved changes now (on shutdown). */
    flush: () => pending && flush(),

    // ---- Devices
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

    // ---- Patterns and favorites
    patterns: (): Pattern[] => [...data.patterns, ...BUILT_IN_THEMES],
    pattern: (id: string) => data.patterns.find((p) => p.id === id) ?? BUILT_IN_THEMES.find((p) => p.id === id),
    savePattern(p: New<Pattern>): Pattern {
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

    // ---- What's showing
    active: () => data.active,
    /** Setting (or clearing) what a device shows also means it's no longer "off". */
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

    // ---- Schedules and settings
    schedules: () => data.schedules,
    saveSchedule(s: New<Schedule>): Schedule {
      const existing = s.id ? data.schedules.find((x) => x.id === s.id) : undefined;
      const saved = existing ? Object.assign(existing, s) : { ...s, id: randomUUID() };
      if (!existing) data.schedules.push(saved);
      save();
      return saved;
    },
    removeSchedule(id: string) {
      data.schedules = data.schedules.filter((s) => s.id !== id);
      save();
    },
    settings: () => data.settings,
    updateSettings(patch: Partial<Settings>) {
      Object.assign(data.settings, patch);
      save();
      return data.settings;
    },
  };
}

export type Store = ReturnType<typeof createStore>;

export const store = createStore(config.dataDir);
