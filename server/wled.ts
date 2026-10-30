// Talking to WLED: the JSON HTTP API for info/static patterns, and DDP (UDP 4048)
// for streaming animation frames.

import dgram from 'node:dgram';

const DDP_PORT = 4048;
const DDP_HEADER = 10;
const DDP_MAX_DATA = 1440; // 480 RGB pixels per packet
const DDP_TYPE_RGB24 = 0x0b;

export interface WledInfo {
  name: string;
  ledCount: number;
  version: string;
}

function baseUrl(host: string) {
  return host.startsWith('http') ? host.replace(/\/$/, '') : `http://${host}`;
}

/** Hostname without any ":port" so DDP can target the device. */
export function hostOnly(host: string) {
  return new URL(baseUrl(host)).hostname;
}

async function request(host: string, path: string, body?: unknown, timeoutMs = 4000) {
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
  return { name: info.name ?? 'WLED', ledCount: info.leds?.count ?? 0, version: info.ver ?? '' };
}

export async function getState(host: string, timeoutMs?: number): Promise<{ on: boolean; bri: number }> {
  return request(host, '/json/state', undefined, timeoutMs);
}

export function setState(host: string, state: Record<string, unknown>) {
  return request(host, '/json/state', state);
}

/**
 * Show a still pattern using per-LED control on segment 0. Chunks are sent one
 * after another (never in parallel) since ESP JSON buffers are small.
 */
export async function sendStatic(host: string, chunks: (number | string)[][], brightness: number) {
  // Leave realtime mode in case we were streaming to this device.
  await setState(host, { live: false });
  const bri = Math.max(1, Math.round((brightness / 100) * 255));
  for (let i = 0; i < chunks.length; i++) {
    const seg = i === 0 ? { id: 0, fx: 0, i: chunks[i] } : { id: 0, i: chunks[i] };
    await setState(host, i === 0 ? { on: true, bri, seg } : { seg });
  }
}

let socket: dgram.Socket | undefined;
const sequence = new Map<string, number>();

function udp() {
  if (!socket) {
    socket = dgram.createSocket('udp4');
    socket.on('error', (e) => console.error('[ddp] socket error', e.message));
    socket.unref();
  }
  return socket;
}

/** Send one RGB frame over DDP, split across packets with the push flag on the last. */
export function sendDdpFrame(host: string, frame: Uint8Array) {
  const seq = ((sequence.get(host) ?? 0) % 15) + 1; // 1..15, 0 means "unused"
  sequence.set(host, seq);
  for (let offset = 0; offset < frame.length; offset += DDP_MAX_DATA) {
    const len = Math.min(DDP_MAX_DATA, frame.length - offset);
    const last = offset + len >= frame.length;
    const pkt = Buffer.alloc(DDP_HEADER + len);
    pkt[0] = 0x40 | (last ? 0x01 : 0); // version 1, push on last packet
    pkt[1] = seq;
    pkt[2] = DDP_TYPE_RGB24;
    pkt[3] = 0x01; // default output device
    pkt.writeUInt32BE(offset, 4);
    pkt.writeUInt16BE(len, 8);
    pkt.set(frame.subarray(offset, offset + len), DDP_HEADER);
    udp().send(pkt, DDP_PORT, host);
  }
}
