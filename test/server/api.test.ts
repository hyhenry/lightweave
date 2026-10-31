// End-to-end API tests: the real server process talking to fake WLED controllers.

import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { startMockWled, type MockOptions, type MockWled } from '../support/mock-wled.ts';
import { eventually, freeUdpPort, startServer, wait, type TestServer } from '../support/server.ts';

/** A server plus one fake controller (that receives DDP), torn down after the test. */
async function setup(t: TestContext, mockOpts: MockOptions = {}, serverOpts: { data?: unknown } = {}) {
  const ddpPort = await freeUdpPort();
  const mock = await startMockWled({ quiet: true, ddpPort, ...mockOpts });
  const server = await startServer({ ddpPort, ...serverOpts });
  t.after(async () => {
    await server.stop();
    await mock.close();
  });
  return { server, mock };
}

async function addDevice(server: TestServer, mock: MockWled, extra: Record<string, unknown> = {}) {
  const res = await server.send<any>('POST', '/api/devices', { host: mock.host, ...extra });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return res.body;
}

const statePosts = (mock: MockWled) => mock.posts.filter((p) => p.path === '/json/state').map((p) => p.body);
const device = async (server: TestServer, id: string) => (await server.get('/api/devices')).devices.find((d: any) => d.id === id);

test('adding a light reads its LED count from WLED, not the request', async (t) => {
  const { server, mock } = await setup(t, { leds: 78 });
  const d = await addDevice(server, mock, { ledCount: 9999, name: 'Roofline' });
  assert.equal(d.ledCount, 78);
  assert.equal(d.name, 'Roofline');
  assert.equal(d.brightness, 80);
});

test('adding an unreachable light fails with a friendly error', async (t) => {
  const { server } = await setup(t);
  const res = await server.send<any>('POST', '/api/devices', { host: '127.0.0.1:1' });
  assert.equal(res.status, 502);
  assert.match(res.body.error, /No WLED found/);
});

test('LED count changes in WLED are picked up', async (t) => {
  const { server, mock } = await setup(t, { leds: 150 });
  const d = await addDevice(server, mock);
  mock.leds = 300;
  assert.equal((await device(server, d.id)).ledCount, 300);
  await eventually(() => server.data().devices[0].ledCount === 300);
});

test('still patterns are sent once as seg.i ranges at the light’s brightness', async (t) => {
  const { server, mock } = await setup(t, { leds: 12 });
  await addDevice(server, mock);
  await server.send('POST', '/api/play', { patternId: 'builtin-christmas-classic-red-green' });
  const posts = statePosts(mock);
  assert.deepEqual(posts[0], { live: false });
  assert.equal(posts[1].on, true);
  assert.equal(posts[1].bri, 204); // 80% light × 100% pattern
  // 3 red, 3 green, repeating
  assert.deepEqual(posts[1].seg.i, [0, 3, 'FF0000', 3, 6, '00C020', 6, 9, 'FF0000', 9, 12, '00C020']);
  await wait(200);
  assert.equal(mock.ddp.frames, 0, 'still patterns are not streamed');
});

test('animated patterns stream DDP frames covering every LED', async (t) => {
  const { server, mock } = await setup(t, { leds: 600 }); // > 480 px, so frames span two packets
  const d = await addDevice(server, mock);
  await server.send('POST', '/api/play', { patternId: 'builtin-christmas-candy-cane' });
  await eventually(() => mock.ddp.frames > 3);
  assert.equal(mock.ddp.lastFrame!.length, 600 * 3);
  assert.equal((await device(server, d.id)).status.playing.mode, 'stream');
});

test('brightness carries over when switching patterns', async (t) => {
  const { server, mock } = await setup(t);
  const d = await addDevice(server, mock);
  await server.send('POST', '/api/play', { patternId: 'builtin-christmas-candy-cane' });
  await server.send('POST', '/api/brightness', { brightness: 30, deviceIds: [d.id] });
  await server.send('POST', '/api/play', { patternId: 'builtin-christmas-classic-red-green' });
  assert.equal(statePosts(mock).at(-1).bri, 77); // 30%
  assert.equal((await device(server, d.id)).brightness, 30);
});

test('turning off and on brings back the same pattern', async (t) => {
  const { server, mock } = await setup(t);
  const d = await addDevice(server, mock);
  await server.send('POST', '/api/play', { patternId: 'builtin-halloween-witchy' });
  await server.send('POST', '/api/power', { on: false });
  assert.equal(mock.state.on, false);
  assert.equal((await device(server, d.id)).status.playing, undefined);
  const before = mock.ddp.frames;
  await wait(150);
  assert.ok(mock.ddp.frames - before <= 1, 'stream stops when off');
  await server.send('POST', '/api/power', { on: true });
  assert.equal((await device(server, d.id)).status.playing.patternName, 'Witchy');
  await eventually(() => mock.ddp.frames > before + 2);
});

test('editing a light keeps its animation running', async (t) => {
  const { server, mock } = await setup(t);
  const d = await addDevice(server, mock);
  await server.send('POST', '/api/play', { patternId: 'builtin-christmas-candy-cane' });
  await server.send('PUT', `/api/devices/${d.id}`, { name: 'Renamed', reverse: true });
  const after = mock.ddp.frames;
  await eventually(() => mock.ddp.frames > after + 3);
  assert.equal((await device(server, d.id)).name, 'Renamed');
});

test('sound patterns run WLED’s own effect, looked up by name', async (t) => {
  const { server, mock } = await setup(t, { audio: 'mic' });
  await addDevice(server, mock);
  const res = await server.send<any>('POST', '/api/play', { patternId: 'builtin-sound-reactive-neon-pulse' });
  assert.equal(res.body.results[0].ok, true);
  const seg = statePosts(mock).at(-1).seg;
  assert.equal(seg.fx, 13); // "PS Sonic Stream" in the mock's effect list
  assert.deepEqual(seg.col[1], [0, 0, 0], 'effects fade to black, not to the second color');
  // Every slider and option is sent, so nothing carries over from the last effect.
  assert.deepEqual([seg.ix, seg.c1, seg.c2, seg.c3, seg.o1, seg.o2, seg.o3], [128, 128, 64, 0, false, true, false]);
});

test('sound patterns with several colors get their own palette on the controller', async (t) => {
  const { server, mock } = await setup(t, { audio: 'mic' });
  await addDevice(server, mock);
  await server.send('POST', '/api/play', { patternId: 'builtin-sound-reactive-neon-pulse' });
  const saved = JSON.parse(mock.files['palette0.json']);
  assert.equal(saved.lightweave, true);
  assert.equal(saved.palette.length, 8, 'three colors and back to the first');
  assert.equal(statePosts(mock).at(-1).seg.pal, 200); // first custom palette on WLED 16

  // The same colors again don't rewrite the file.
  const uploads = () => mock.posts.filter((p) => p.path === '/upload').length;
  await server.send('POST', '/api/play', { patternId: 'builtin-sound-reactive-ocean-ripples' });
  assert.equal(uploads(), 2);
  await server.send('POST', '/api/play', { patternId: 'builtin-sound-reactive-ocean-ripples' });
  assert.equal(uploads(), 2);
});

test('sound patterns leave people’s own palettes alone', async (t) => {
  const { server, mock } = await setup(t, { audio: 'mic' });
  mock.files['palette0.json'] = JSON.stringify({ palette: [0, 'FF0000', 255, '0000FF'] });
  await addDevice(server, mock);
  await server.send('POST', '/api/play', { patternId: 'builtin-sound-reactive-neon-pulse' });
  assert.deepEqual(JSON.parse(mock.files['palette0.json']).palette, [0, 'FF0000', 255, '0000FF']);
  assert.ok(mock.files['palette1.json']);
  assert.equal(statePosts(mock).at(-1).seg.pal, 199);
});

test('sound patterns still play when the controller won’t take a palette', async (t) => {
  const { server, mock } = await setup(t, { audio: 'mic' });
  mock.locked = true;
  await addDevice(server, mock);
  const res = await server.send<any>('POST', '/api/play', { patternId: 'builtin-sound-reactive-neon-pulse' });
  assert.equal(res.body.results[0].ok, true);
  assert.equal(statePosts(mock).at(-1).seg.pal, 2); // "* Color 1"
});

test('sound patterns refuse lights that can’t hear', async (t) => {
  const { server, mock } = await setup(t, { audio: 'none' });
  await addDevice(server, mock);
  const res = await server.send<any>('POST', '/api/play', { patternId: 'builtin-sound-reactive-neon-pulse' });
  assert.equal(res.body.results[0].ok, false);
  assert.match(res.body.results[0].error, /isn’t audio reactive/);
});

test('audio passthrough turns on and back off cleanly on both controllers', async (t) => {
  const { server, mock: roof } = await setup(t, { audio: 'sync' });
  const office = await startMockWled({ quiet: true, audio: 'mic', name: 'Office' });
  t.after(() => office.close());
  const r = await addDevice(server, roof);
  const o = await addDevice(server, office);
  const ar = (m: MockWled) => m.cfg.um.AudioReactive;
  const before = { roof: structuredClone(ar(roof)), office: structuredClone(ar(office)) };

  assert.equal((await device(server, r.id)).status.audio, 'capable');
  const blocked = await server.send<any>('POST', '/api/play', { patternId: 'builtin-sound-reactive-neon-pulse', deviceIds: [r.id] });
  assert.match(blocked.body.results[0].error, /Turn it on in Lights/);

  assert.equal((await server.send<any>('PUT', `/api/devices/${r.id}/audio`, { sourceId: o.id })).body.audio, 'receiving');
  assert.equal(ar(roof).sync.mode, 2);
  assert.equal(ar(roof).enabled, true);
  assert.equal(ar(office).sync.mode, 1);
  assert.equal((await device(server, o.id)).status.audio, 'mic');
  assert.equal((await device(server, r.id)).status.audio, 'receiving', 'the list shows the change right away');

  assert.equal((await server.send<any>('PUT', `/api/devices/${r.id}/audio`, { sourceId: null })).body.audio, 'capable');
  assert.deepEqual(ar(roof), before.roof);
  assert.deepEqual(ar(office), before.office);
  assert.equal((await device(server, r.id)).status.audio, 'capable');
});

test('a controller’s own microphone turns off and back on', async (t) => {
  const { server, mock } = await setup(t, { audio: 'mic' });
  const d = await addDevice(server, mock);
  const ar = () => mock.cfg.um.AudioReactive;
  const sync = structuredClone(ar().sync);
  const lastAudioState = () => statePosts(mock).filter((b: any) => b.AudioReactive).at(-1).AudioReactive;

  assert.equal((await server.send<any>('PUT', `/api/devices/${d.id}/mic`, { enabled: false })).body.audio, 'mic-off');
  assert.equal(ar().enabled, false);
  assert.equal(lastAudioState().enabled, false);
  assert.deepEqual(ar().sync, sync, 'sound sharing is left alone');
  assert.equal((await device(server, d.id)).status.audio, 'mic-off', 'the list shows the change right away');
  const blocked = await server.send<any>('POST', '/api/play', { patternId: 'builtin-sound-reactive-neon-pulse' });
  assert.match(blocked.body.results[0].error, /Turn it on in Lights/);

  assert.equal((await server.send<any>('PUT', `/api/devices/${d.id}/mic`, { enabled: true })).body.audio, 'mic');
  assert.equal(ar().enabled, true);
  assert.equal(lastAudioState().enabled, true);
  assert.equal((await device(server, d.id)).status.audio, 'mic');
});

test('the microphone toggle refuses controllers without one', async (t) => {
  const { server, mock } = await setup(t, { audio: 'sync' });
  const d = await addDevice(server, mock);
  const res = await server.send<any>('PUT', `/api/devices/${d.id}/mic`, { enabled: true });
  assert.equal(res.status, 400);
  assert.equal(mock.cfg.um.AudioReactive.enabled, false);
});

test('patterns: create, edit, favorite, delete; built-ins are protected', async (t) => {
  const { server } = await setup(t);
  const created = (await server.send<any>('POST', '/api/patterns', { name: 'Porch', blocks: [{ color: '#ff5a00', count: 2 }], animation: 'bogus', speed: 99 })).body;
  assert.equal(created.animation, 'static');
  assert.equal(created.speed, 10);
  assert.equal(created.blocks[0].color, '#FF5A00');
  assert.equal(created.brightness, 100);

  const copy = (await server.send<any>('PUT', '/api/patterns/builtin-halloween-witchy', { name: 'My Witchy', blocks: [{ color: '#000000', count: 1 }] })).body;
  assert.notEqual(copy.id, 'builtin-halloween-witchy', 'editing a built-in saves a copy');

  await server.send('PUT', `/api/patterns/${created.id}/favorite`, { favorite: true });
  assert.deepEqual((await server.get('/api/patterns')).favorites, [created.id]);
  assert.equal((await server.send('DELETE', '/api/patterns/builtin-halloween-witchy')).status, 400);
  await server.send('DELETE', `/api/patterns/${created.id}`);
  const after = await server.get('/api/patterns');
  assert.ok(!after.patterns.some((p: any) => p.id === created.id));
  assert.deepEqual(after.favorites, []);
});

test('schedules are validated and report their next run', async (t) => {
  const { server, mock } = await setup(t);
  await addDevice(server, mock);
  const s = (await server.send<any>('POST', '/api/schedules', { patternId: 'nope', on: { kind: 'time', time: '18:30' }, off: { kind: 'sunrise', offset: 999 } })).body;
  assert.equal(s.patternId, 'autopilot', 'unknown patterns fall back to autopilot');
  assert.deepEqual(s.days, [0, 1, 2, 3, 4, 5, 6]);
  assert.equal(s.off.offset, 180, 'offsets are clamped');
  assert.ok(s.next.on, 'time-based schedules know their next run');
  assert.equal(s.next.off, undefined, 'sunrise needs a location');

  await server.send('PUT', '/api/settings', { location: { name: 'Edmonton, AB', lat: 53.55, lon: -113.49 } });
  const listed = await server.get('/api/schedules');
  assert.ok(listed.schedules[0].next.off);
  assert.equal(listed.settings.location.name, 'Edmonton, AB');

  const last = (await server.send<any>('POST', '/api/schedules', { patternId: 'last', on: { kind: 'sunset', offset: 0 } })).body;
  assert.equal(last.patternId, 'last');
  assert.equal(last.off, undefined);
  await server.send('DELETE', `/api/schedules/${last.id}`);
  assert.equal((await server.get('/api/schedules')).schedules.length, 1);
});

test('v1 data migrates brightness from the playing pattern onto the light', async (t) => {
  const pattern = { id: 'mine', name: 'Mine', category: 'My Patterns', blocks: [{ color: '#FF0000', count: 1 }], animation: 'static', speed: 4, direction: 'forward', brightness: 80, blend: false };
  const mock = await startMockWled({ quiet: true });
  t.after(() => mock.close());
  const server = await startServer({
    data: {
      devices: [{ id: 'd1', name: 'Roof', host: mock.host, ledCount: 150, reverse: false }],
      patterns: [pattern],
      favorites: [],
      active: { d1: { ...pattern, brightness: 35 } }, // v1 kept the slider value here
      off: [],
    },
  });
  t.after(() => server.stop());
  const data = server.data();
  assert.equal(data.version, 2);
  assert.equal(data.devices[0].brightness, 35);
  assert.equal(data.active.d1.brightness, 100);
  assert.equal(data.patterns[0].brightness, 100, 'the old 80% default becomes "normal"');
});

test('errors reach the app as friendly { error } messages', async (t) => {
  const { server, mock: roof } = await setup(t, { audio: 'sync' });
  const deaf = await startMockWled({ quiet: true, audio: 'none', name: 'Garage' });
  t.after(() => deaf.close());
  const r = await addDevice(server, roof);
  const g = await addDevice(server, deaf);

  const noMic = await server.send<any>('PUT', `/api/devices/${r.id}/audio`, { sourceId: g.id });
  assert.equal(noMic.status, 400);
  assert.equal(noMic.body.error, 'Garage has no microphone');

  await roof.close(); // the roofline drops off the network
  const unreachable = await server.send<any>('PUT', `/api/devices/${r.id}/audio`, { sourceId: null });
  assert.equal(unreachable.status, 502);
  assert.match(unreachable.body.error, /^Couldn’t update Mock Roofline:/);

  const empty = await server.send<any>('POST', '/api/patterns', { name: 'Nothing', blocks: [] });
  assert.equal(empty.status, 400);
  assert.equal(empty.body.error, 'A pattern needs at least one color');
});

test('audio settings are read once, not on every refresh', async (t) => {
  const { server, mock } = await setup(t, { audio: 'mic' });
  await addDevice(server, mock);
  for (let i = 0; i < 3; i++) assert.equal((await server.get('/api/devices')).devices[0].status.audio, 'mic');
  assert.equal(mock.gets.filter((p) => p === '/json/cfg').length, 1);
});

test('an unresponsive light doesn’t hold up the others', async (t) => {
  const { server, mock } = await setup(t);
  const garage = await startMockWled({ quiet: true, name: 'Garage' });
  t.after(() => garage.close());
  await addDevice(server, mock);
  const g = await addDevice(server, garage);
  await server.get('/api/devices');

  garage.hang = true; // unplugged: requests just time out
  const started = Date.now();
  const list = await server.get('/api/devices');
  assert.ok(Date.now() - started < 1000, `took ${Date.now() - started}ms`);
  assert.equal(list.devices.length, 2);
  await eventually(async () => (await device(server, g.id)).status.online === false, 5000);
});

test('rapid changes are saved, including right before shutdown', async (t) => {
  const { server, mock } = await setup(t);
  const d = await addDevice(server, mock);
  for (let b = 10; b <= 60; b += 10) await server.send('POST', '/api/brightness', { brightness: b, deviceIds: [d.id] });
  await server.kill();
  assert.equal(server.data().devices[0].brightness, 60);
});
