// Starts the real Lightweave server as a child process with its own temporary
// data folder and ports, so tests never touch ./data, port 8787 or real lights.

import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import net from 'node:net';
import dgram from 'node:dgram';

const ROOT = join(import.meta.dirname, '..', '..');

export async function freeTcpPort(): Promise<number> {
  const srv = net.createServer();
  await new Promise<void>((r) => srv.listen(0, '127.0.0.1', r));
  const { port } = srv.address() as net.AddressInfo;
  await new Promise((r) => srv.close(r));
  return port;
}

export async function freeUdpPort(): Promise<number> {
  const sock = dgram.createSocket('udp4');
  await new Promise<void>((r) => sock.bind(0, '127.0.0.1', r));
  const { port } = sock.address();
  sock.close();
  return port;
}

export interface TestServer {
  url: string;
  dataDir: string;
  ddpPort: number;
  logs: () => string;
  data: () => any;
  get: <T = any>(path: string) => Promise<T>;
  send: <T = any>(method: string, path: string, body?: unknown) => Promise<{ status: number; body: T }>;
  /** Shut the server down the way Docker does (SIGTERM), keeping its data folder. */
  kill: () => Promise<void>;
  stop: () => Promise<void>;
}

export async function startServer(opts: { data?: unknown; ddpPort?: number; env?: Record<string, string> } = {}): Promise<TestServer> {
  const dataDir = mkdtempSync(join(tmpdir(), 'lightweave-test-'));
  if (opts.data) writeFileSync(join(dataDir, 'lightweave.json'), JSON.stringify(opts.data));
  const port = await freeTcpPort();
  const ddpPort = opts.ddpPort ?? (await freeUdpPort());
  let output = '';
  const child: ChildProcess = spawn(process.execPath, [join(ROOT, 'server', 'index.ts')], {
    cwd: ROOT,
    // Never inherit a real Home Assistant token; HA tests pass their own via `env`.
    env: { ...process.env, SUPERVISOR_TOKEN: '', HA_CORE_API: '', PORT: String(port), DATA_DIR: dataDir, DDP_PORT: String(ddpPort), LOG_LEVEL: 'warn', ...opts.env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout!.on('data', (d) => (output += d));
  child.stderr!.on('data', (d) => (output += d));

  const url = `http://127.0.0.1:${port}`;
  const send = async <T>(method: string, path: string, body?: unknown) => {
    const res = await fetch(url + path, {
      method,
      headers: body !== undefined ? { 'content-type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, body: (await res.json()) as T };
  };

  for (let i = 0; ; i++) {
    try {
      if ((await fetch(`${url}/api/health`)).ok) break;
    } catch {}
    if (i > 100 || child.exitCode !== null) throw new Error(`server didn't start:\n${output}`);
    await new Promise((r) => setTimeout(r, 50));
  }

  async function kill() {
    if (child.exitCode !== null || child.signalCode !== null) return;
    child.kill('SIGTERM');
    await new Promise((r) => child.once('exit', r));
  }

  return {
    url,
    dataDir,
    ddpPort,
    logs: () => output,
    data: () => JSON.parse(readFileSync(join(dataDir, 'lightweave.json'), 'utf8')),
    get: async (path) => (await send<any>('GET', path)).body,
    send,
    kill,
    async stop() {
      await kill();
      rmSync(dataDir, { recursive: true, force: true });
    },
  };
}

export const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Poll until `check` returns truthy (or fail after `ms`). Errors count as "not yet". */
export async function eventually<T>(check: () => T | Promise<T>, ms = 2000): Promise<T> {
  const end = Date.now() + ms;
  for (;;) {
    let last: unknown;
    try {
      const v = await check();
      if (v) return v;
    } catch (e) {
      last = e;
    }
    if (Date.now() > end) throw new Error(`condition not met in time${last ? `: ${last}` : ''}`);
    await wait(25);
  }
}
