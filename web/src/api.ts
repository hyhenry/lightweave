import type { Device, DeviceStatus, Pattern } from '../../shared/types.ts';

export type DeviceWithStatus = Device & { status: DeviceStatus };
type Result = { deviceId: string; ok: boolean; error?: string };

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Something went wrong (${res.status})`);
  return data as T;
}

export const api = {
  patterns: () => call<{ patterns: Pattern[]; favorites: string[] }>('GET', '/patterns'),
  createPattern: (p: Partial<Pattern>) => call<Pattern>('POST', '/patterns', p),
  updatePattern: (id: string, p: Partial<Pattern>) => call<Pattern>('PUT', `/patterns/${id}`, p),
  deletePattern: (id: string) => call('DELETE', `/patterns/${id}`),
  favorite: (id: string, favorite: boolean) => call<{ favorites: string[] }>('PUT', `/patterns/${id}/favorite`, { favorite }),

  devices: () => call<{ devices: DeviceWithStatus[] }>('GET', '/devices'),
  probe: (host: string) => call<{ name: string; ledCount: number; version: string }>('POST', '/devices/probe', { host }),
  addDevice: (d: Partial<Device>) => call<Device>('POST', '/devices', d),
  updateDevice: (id: string, d: Partial<Device>) => call<Device>('PUT', `/devices/${id}`, d),
  deleteDevice: (id: string) => call('DELETE', `/devices/${id}`),

  play: (body: { patternId?: string; pattern?: Pattern; deviceIds?: string[] }) =>
    call<{ results: Result[] }>('POST', '/play', body),
  power: (on: boolean, deviceIds?: string[]) => call<{ results: Result[] }>('POST', '/power', { on, deviceIds }),
  release: (deviceIds?: string[]) => call('POST', '/release', { deviceIds }),
};
