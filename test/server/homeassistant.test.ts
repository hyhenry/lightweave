// Running as a Home Assistant app: Ingress paths, importing WLED from HA, HA's location.

import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { startMockWled } from '../support/mock-wled.ts';
import { INGRESS_PATH, TEST_TOKEN, startIngressProxy, startMockHa, type MockHa } from '../support/mock-ha.ts';
import { eventually, startServer } from '../support/server.ts';

async function inHomeAssistant(t: TestContext, data?: unknown, setup?: (ha: MockHa) => void) {
  const ha = await startMockHa();
  setup?.(ha);
  const server = await startServer({ data, env: { SUPERVISOR_TOKEN: TEST_TOKEN, HA_CORE_API: ha.api } });
  t.after(async () => {
    await server.stop();
    await ha.close();
  });
  return { ha, server };
}

test('outside Home Assistant the HA features stay off', async (t) => {
  const server = await startServer();
  t.after(() => server.stop());
  assert.deepEqual(await server.get('/api/info'), { homeAssistant: false });
  assert.deepEqual(await server.get('/api/homeassistant/wled'), { devices: [] });
});

test('lists WLED controllers from Home Assistant, marking ones already added', async (t) => {
  const roof = await startMockWled({ quiet: true });
  t.after(() => roof.close());
  const { ha, server } = await inHomeAssistant(t, undefined, (ha) => {
    ha.wled = [
      { name: 'Roofline', url: `http://${roof.host}` },
      { name: 'Porch', url: 'http://10.9.9.9' },
    ];
  });
  assert.deepEqual(await server.get('/api/info'), { homeAssistant: true });
  // Added the way the app stores a typed address, e.g. "http://192.168.2.20/".
  await server.send('POST', '/api/devices', { host: `http://${roof.host}/`, name: 'Roofline' });

  const { devices } = await server.get('/api/homeassistant/wled');
  assert.deepEqual(devices, [
    { name: 'Roofline', host: roof.host, added: true },
    { name: 'Porch', host: '10.9.9.9', added: false },
  ]);
  assert.match(ha.templates[0], /integration_entities\('wled'\)/);
  assert.match(ha.templates[0], /configuration_url/);
});

test('if Home Assistant can’t be asked, the import list is just empty', async (t) => {
  const { server } = await inHomeAssistant(t, undefined, (ha) => (ha.fail = true));
  assert.deepEqual(await server.get('/api/homeassistant/wled'), { devices: [] });
  assert.deepEqual(await server.get('/api/health'), { ok: true });
});

test('sunrise/sunset use Home Assistant’s location until a city is picked', async (t) => {
  const { server } = await inHomeAssistant(t);
  const loc = await eventually(async () => (await server.get('/api/schedules')).settings.location);
  assert.deepEqual(loc, { name: 'Home (Home Assistant)', lat: 51.05, lon: -114.07 });
});

test('a city picked in the app is never overwritten', async (t) => {
  const picked = { name: 'Edmonton, AB', lat: 53.55, lon: -113.49 };
  const { server } = await inHomeAssistant(t, { devices: [], patterns: [], favorites: [], active: {}, off: [], schedules: [], settings: { location: picked }, version: 2 });
  await new Promise((r) => setTimeout(r, 300));
  assert.deepEqual((await server.get('/api/schedules')).settings.location, picked);
});

test('the whole app works under an Ingress path', async (t) => {
  const server = await startServer();
  const proxy = await startIngressProxy(server.url);
  t.after(async () => {
    await proxy.close();
    await server.stop();
  });
  const html = await (await fetch(proxy.url)).text();
  const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(refs.length >= 4);
  for (const ref of refs) {
    assert.ok(!ref.startsWith('/'), `absolute URL in index.html: ${ref}`);
    assert.equal((await fetch(new URL(ref, proxy.url))).status, 200, ref);
  }
  // The JS bundle and the API, as the browser would reach them.
  const js = refs.find((r) => r.endsWith('.js'))!;
  const bundle = await (await fetch(new URL(js, proxy.url))).text();
  assert.ok(!/fetch\(`\/api/.test(bundle), 'API calls must be relative');
  assert.equal((await fetch(new URL('api/patterns', proxy.url))).status, 200);
  assert.equal((await fetch(new URL('/assets/x.js', proxy.url))).status, 404, 'outside the ingress path is unreachable');
  assert.ok(INGRESS_PATH.startsWith('/api/hassio_ingress/'));
});
