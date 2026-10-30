import { useMemo, useState } from 'react';
import type { DeviceWithStatus } from '../api.ts';

const KEY = 'lightweave.targets';

function load(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]');
  } catch {
    return [];
  }
}

/**
 * Which lights "Show on the lights" sends to. Remembered on this phone; defaults to
 * all lights, and never lets you deselect the last one.
 */
export function useTargets(devices: DeviceWithStatus[]) {
  const [saved, setSaved] = useState<string[]>(load);

  const targets = useMemo(() => {
    const valid = saved.filter((id) => devices.some((d) => d.id === id));
    return valid.length ? valid : devices.map((d) => d.id);
  }, [saved, devices]);

  const toggle = (id: string) => {
    const next = targets.includes(id) ? targets.filter((x) => x !== id) : [...targets, id];
    if (!next.length) return;
    setSaved(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {}
  };

  return { targets, toggle };
}
