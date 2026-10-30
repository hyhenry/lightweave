import type { Device, DeviceStatus, Pattern, Schedule, Settings } from '../../shared/types.ts';

export type DeviceWithStatus = Device & { status: DeviceStatus };
export type ScheduleWithNext = Schedule & { next: { on?: string; off?: string }; showing?: string };
type Result = { deviceId: string; ok: boolean; error?: string };

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  // Relative (no leading slash) so it works under Home Assistant's Ingress path too.
  const res = await fetch(`api${path}`, {
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
  setAudioSource: (id: string, sourceId: string | null) => call<{ audio: string }>('PUT', `/devices/${id}/audio`, { sourceId }),
  setMic: (id: string, enabled: boolean) => call<{ audio: string }>('PUT', `/devices/${id}/mic`, { enabled }),

  play: (body: { patternId?: string; pattern?: Pattern; deviceIds?: string[] }) =>
    call<{ results: Result[] }>('POST', '/play', body),
  power: (on: boolean, deviceIds?: string[]) => call<{ results: Result[] }>('POST', '/power', { on, deviceIds }),
  brightness: (brightness: number, deviceIds?: string[]) => call('POST', '/brightness', { brightness, deviceIds }),
  schedules: () => call<{ schedules: ScheduleWithNext[]; settings: Settings; timeZone: string }>('GET', '/schedules'),
  createSchedule: (s: Partial<Schedule>) => call<ScheduleWithNext>('POST', '/schedules', s),
  updateSchedule: (id: string, s: Partial<Schedule>) => call<ScheduleWithNext>('PUT', `/schedules/${id}`, s),
  deleteSchedule: (id: string) => call('DELETE', `/schedules/${id}`),
  setLocation: (location: Settings['location'] | null) => call<Settings>('PUT', '/settings', { location }),
  info: () => call<{ homeAssistant: boolean }>('GET', '/info'),
  homeAssistantWled: () => call<{ devices: { name: string; host: string; added: boolean }[] }>('GET', '/homeassistant/wled'),
  release: (deviceIds?: string[]) => call('POST', '/release', { deviceIds }),
};
