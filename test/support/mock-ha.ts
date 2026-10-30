// A fake Home Assistant Core API (as seen through the Supervisor proxy), and a
// fake Ingress proxy that serves an app only under a path prefix.

import { createServer, request, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

export const TEST_TOKEN = 'test-supervisor-token';

async function listen(server: Server) {
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  return (server.address() as AddressInfo).port;
}

async function close(server: Server) {
  server.closeAllConnections();
  await new Promise((r) => server.close(r));
}

export interface MockHa {
  /** Base URL to pass as HA_CORE_API. */
  api: string;
  /** What the WLED template "renders" to: devices with a configuration_url. */
  wled: { name: string; url: string }[];
  config: { latitude: number; longitude: number; location_name: string };
  templates: string[];
  fail: boolean;
  close(): Promise<void>;
}

export async function startMockHa(): Promise<MockHa> {
  const ha = {
    wled: [] as { name: string; url: string }[],
    config: { latitude: 51.05, longitude: -114.07, location_name: 'Home' },
    templates: [] as string[],
    fail: false,
  };
  const server = createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      if (req.headers.authorization !== `Bearer ${TEST_TOKEN}`) return res.writeHead(401).end('401: Unauthorized');
      if (ha.fail) return res.writeHead(500).end('500: Internal Server Error');
      if (req.method === 'POST' && req.url === '/api/template') {
        ha.templates.push(JSON.parse(raw).template);
        return res.writeHead(200, { 'content-type': 'text/plain' }).end(JSON.stringify(ha.wled)); // rendered text
      }
      if (req.url === '/api/config') return res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(ha.config));
      res.writeHead(404).end('404: Not Found');
    });
  });
  const port = await listen(server);
  return Object.assign(ha, { api: `http://127.0.0.1:${port}/api`, close: () => close(server) });
}

export const INGRESS_PATH = '/api/hassio_ingress/TEST';

/** Serves `target` only under INGRESS_PATH, like Home Assistant Ingress. Anything else is 404. */
export async function startIngressProxy(target: string) {
  const { hostname, port: targetPort } = new URL(target);
  const server = createServer((req, res) => {
    if (!req.url?.startsWith(`${INGRESS_PATH}/`)) return res.writeHead(404).end('not under the ingress path');
    const upstream = request(
      { hostname, port: targetPort, method: req.method, path: req.url.slice(INGRESS_PATH.length), headers: { ...req.headers, 'x-ingress-path': INGRESS_PATH } },
      (up) => {
        res.writeHead(up.statusCode ?? 502, up.headers);
        up.pipe(res);
      },
    );
    req.pipe(upstream);
  });
  const port = await listen(server);
  return { url: `http://127.0.0.1:${port}${INGRESS_PATH}/`, close: () => close(server) };
}
