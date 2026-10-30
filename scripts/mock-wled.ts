// A fake WLED controller for development: answers the JSON API and counts DDP
// frames. Run `npm run mock`, then add "127.0.0.1:8090" in the Lights tab.

import { createServer } from 'node:http';
import dgram from 'node:dgram';

const HTTP_PORT = Number(process.env.MOCK_PORT ?? 8090);
const LEDS = Number(process.env.MOCK_LEDS ?? 150);
const state: Record<string, any> = { on: true, bri: 128, live: false, seg: [{ id: 0, fx: 0 }] };

createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    res.setHeader('content-type', 'application/json');
    if (req.url === '/json/info') {
      return res.end(JSON.stringify({ name: 'Mock Roofline', ver: '0.15.0', leds: { count: LEDS } }));
    }
    if (req.url === '/json/state') {
      if (req.method === 'POST') {
        const s = JSON.parse(body || '{}');
        const { seg, ...rest } = s;
        Object.assign(state, rest);
        const summary = seg?.i ? `seg.i with ${seg.i.length / 3} ranges` : '';
        console.log(`[http] state <- ${JSON.stringify(rest)} ${summary}`);
        return res.end(JSON.stringify({ success: true }));
      }
      return res.end(JSON.stringify(state));
    }
    res.statusCode = 404;
    res.end('{}');
  });
}).listen(HTTP_PORT, () => console.log(`mock WLED on http://127.0.0.1:${HTTP_PORT} with ${LEDS} LEDs`));

let frames = 0;
let bytes = 0;
const udp = dgram.createSocket('udp4');
udp.on('message', (msg) => {
  const push = msg[0] & 0x01;
  bytes += msg.readUInt16BE(8);
  if (push) frames++;
});
udp.bind(4048, () => console.log('listening for DDP on udp/4048'));
setInterval(() => {
  if (frames) console.log(`[ddp] ${frames} frames/s, ${Math.round(bytes / frames / 3)} px/frame`);
  frames = 0;
  bytes = 0;
}, 1000);
