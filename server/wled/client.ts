// WLED's JSON HTTP API: info, state, and settings.

export interface WledInfo {
  name: string;
  ledCount: number;
  version: string;
  /** Whether the AudioReactive usermod is installed (see audio.ts for the details). */
  audio: 'ar' | 'none';
}

function baseUrl(host: string) {
  return host.startsWith('http') ? host.replace(/\/$/, '') : `http://${host}`;
}

/** Hostname without any ":port", for sending DDP to the device. */
export function hostOnly(host: string) {
  return new URL(baseUrl(host)).hostname;
}

/** "http://192.168.2.20/" and "192.168.2.20:80" are the same controller. */
export function sameHost(a: string, b: string) {
  const norm = (h: string) => new URL(baseUrl(h.trim())).host.toLowerCase();
  try {
    return norm(a) === norm(b);
  } catch {
    return false;
  }
}

/** Percent (1–100) to WLED's 1–255 brightness. */
export function toWledBri(percent: number) {
  return Math.max(1, Math.round((percent / 100) * 255));
}

export async function request(host: string, path: string, body?: unknown, timeoutMs = 4000) {
  const res = await fetch(`${baseUrl(host)}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`WLED replied ${res.status}`);
  return res.json();
}

export async function getInfo(host: string, timeoutMs?: number): Promise<WledInfo> {
  const info = await request(host, '/json/info', undefined, timeoutMs);
  return {
    name: info.name ?? 'WLED',
    ledCount: info.leds?.count ?? 0,
    version: info.ver ?? '',
    audio: info.u?.AudioReactive ? 'ar' : 'none',
  };
}

export async function getState(host: string, timeoutMs?: number): Promise<{ on: boolean; bri: number }> {
  return request(host, '/json/state', undefined, timeoutMs);
}

export function setState(host: string, state: Record<string, unknown>) {
  return request(host, '/json/state', state);
}
