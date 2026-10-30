// A fake WLED controller: answers the JSON API, keeps AudioReactive settings,
// records every POST, and (optionally) receives DDP frames. Used by the tests
// and by `npm run mock` for development.

import { createServer, type Server } from 'node:http';
import dgram from 'node:dgram';
import type { AddressInfo } from 'node:net';

export type MockAudio = 'mic' | 'sync' | 'none';

export interface MockOptions {
  httpPort?: number; // 0 = any free port
  ddpPort?: number; // listen for DDP here; omit to not listen
  leds?: number;
  audio?: MockAudio;
  name?: string;
  quiet?: boolean;
}

export const EFFECTS = ['Solid', 'Blink', 'Gravcenter', 'Gravimeter', 'Pixelwave', 'Puddles', 'Ripple Peak', 'Midnoise', 'Blurz', 'Juggles', 'Freqwave', 'DJ Light', 'Noisefire'];
export const PALETTES = ['Default', '* Random Cycle', '* Color 1', '* Colors 1&2', '* Color Gradient', '* Colors Only', 'Party'];

export interface MockWled {
  host: string; // "127.0.0.1:port", as you'd enter it in the app
  leds: number;
  state: Record<string, any>;
  cfg: Record<string, any>;
  posts: { path: string; body: any }[];
  gets: string[]; // paths of every GET, to count requests
  /** When true, requests are never answered (like a controller that's unplugged). */
  hang: boolean;
  ddp: { frames: number; lastFrame?: Buffer };
  close(): Promise<void>;
}

function initialAudioConfig(audio: MockAudio) {
  if (audio === 'none') return {};
  if (audio === 'mic') {
    return { AudioReactive: { enabled: true, digitalmic: { type: 1, pin: [26, 5, 21, -1] }, analogmic: { pin: -1 }, sync: { port: 11988, mode: 0 } } };
  }
  return { AudioReactive: { enabled: false, sync: { port: 11988, mode: 0 } } };
}

export async function startMockWled(opts: MockOptions = {}): Promise<MockWled> {
  const audio = opts.audio ?? 'mic';
  const log = opts.quiet ? () => {} : (msg: string) => console.log(msg);
  const mock = {
    leds: opts.leds ?? 150,
    state: { on: true, bri: 128, live: false, seg: [{ id: 0, fx: 0 }] } as Record<string, any>,
    cfg: { um: initialAudioConfig(audio) } as Record<string, any>,
    posts: [] as { path: string; body: any }[],
    gets: [] as string[],
    hang: false,
    ddp: { frames: 0, lastFrame: undefined as Buffer | undefined },
  };

  let udp: dgram.Socket | undefined;
  if (opts.ddpPort !== undefined) {
    udp = dgram.createSocket('udp4');
    const frame: Buffer[] = [];
    udp.on('message', (msg) => {
      frame.push(msg.subarray(10, 10 + msg.readUInt16BE(8)));
      if (msg[0] & 0x01) {
        mock.ddp.frames++;
        mock.ddp.lastFrame = Buffer.concat(frame.splice(0));
      }
    });
    await new Promise<void>((resolve, reject) => {
      udp!.once('error', reject);
      udp!.bind(opts.ddpPort, '127.0.0.1', () => resolve());
    });
  }

  const server: Server = createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      if (mock.hang) return;
      res.setHeader('content-type', 'application/json');
      const send = (data: unknown) => res.end(JSON.stringify(data));
      const body = raw ? JSON.parse(raw) : undefined;
      if (req.method === 'POST') mock.posts.push({ path: req.url ?? '', body });
      else mock.gets.push(req.url ?? '');

      switch (req.url) {
        case '/json/info': {
          const u = audio === 'none' ? {} : audio === 'mic' ? { AudioReactive: [], 'Audio Source': ['I2S digital'] } : { AudioReactive: [] };
          return send({ name: opts.name ?? 'Mock Roofline', ver: '0.15.0', leds: { count: mock.leds }, u });
        }
        case '/json/effects':
          return send(EFFECTS);
        case '/json/palettes':
          return send(PALETTES);
        case '/json/cfg': {
          if (req.method !== 'POST') return send(mock.cfg);
          const ar = body?.um?.AudioReactive;
          const cur = mock.cfg.um.AudioReactive;
          if (ar && cur) {
            Object.assign(cur, ar, { sync: { ...cur.sync, ...ar.sync } });
            log(`[http] cfg <- AudioReactive ${JSON.stringify(cur)}`);
          }
          return send({ success: true });
        }
        case '/json/state': {
          if (req.method !== 'POST') return send(mock.state);
          const { seg, ...rest } = body ?? {};
          Object.assign(mock.state, rest);
          const summary = seg?.i ? `seg.i with ${seg.i.length / 3} ranges` : seg?.fx !== undefined ? `effect ${EFFECTS[seg.fx]}` : '';
          log(`[http] state <- ${JSON.stringify(rest)} ${summary}`);
          return send({ success: true });
        }
      }
      res.statusCode = 404;
      res.end('{}');
    });
  });
  await new Promise<void>((resolve) => server.listen(opts.httpPort ?? 0, '127.0.0.1', resolve));
  const port = (server.address() as AddressInfo).port;

  let closed = false;
  return {
    ...mock,
    host: `127.0.0.1:${port}`,
    get leds() {
      return mock.leds;
    },
    set leds(n: number) {
      mock.leds = n;
    },
    get hang() {
      return mock.hang;
    },
    set hang(on: boolean) {
      mock.hang = on;
    },
    async close() {
      if (closed) return;
      closed = true;
      udp?.close();
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}
