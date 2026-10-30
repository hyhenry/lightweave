// Streaming animation frames to WLED over DDP (UDP).

import dgram from 'node:dgram';
import { config } from '../config.ts';

const HEADER = 10;
const MAX_DATA = 1440; // 480 RGB pixels per packet
const TYPE_RGB24 = 0x0b;

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

/** Send one RGB frame, split across packets with the push flag on the last. */
export function sendDdpFrame(host: string, frame: Uint8Array) {
  const seq = ((sequence.get(host) ?? 0) % 15) + 1; // 1..15, 0 means "unused"
  sequence.set(host, seq);
  for (let offset = 0; offset < frame.length; offset += MAX_DATA) {
    const len = Math.min(MAX_DATA, frame.length - offset);
    const last = offset + len >= frame.length;
    const pkt = Buffer.alloc(HEADER + len);
    pkt[0] = 0x40 | (last ? 0x01 : 0); // version 1, push on last packet
    pkt[1] = seq;
    pkt[2] = TYPE_RGB24;
    pkt[3] = 0x01; // default output device
    pkt.writeUInt32BE(offset, 4);
    pkt.writeUInt16BE(len, 8);
    pkt.set(frame.subarray(offset, offset + len), HEADER);
    udp().send(pkt, config.ddpPort, host);
  }
}
