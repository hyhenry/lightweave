// A fake WLED controller for development. Run `npm run mock`, then add
// "127.0.0.1:8090" in the Lights tab.
//   MOCK_PORT=8090  MOCK_LEDS=150  MOCK_AUDIO=mic|sync|none  DDP_PORT=4048

import { startMockWled, type MockAudio } from '../test/support/mock-wled.ts';

const ddpPort = Number(process.env.DDP_PORT ?? 4048);
const mock = await startMockWled({
  httpPort: Number(process.env.MOCK_PORT ?? 8090),
  leds: Number(process.env.MOCK_LEDS ?? 150),
  audio: (process.env.MOCK_AUDIO ?? 'mic') as MockAudio,
  ddpPort,
}).catch(async (e) => {
  console.log(`[ddp] not listening on udp/${ddpPort}: ${e.message}`);
  return startMockWled({ httpPort: Number(process.env.MOCK_PORT ?? 8090), leds: Number(process.env.MOCK_LEDS ?? 150), audio: (process.env.MOCK_AUDIO ?? 'mic') as MockAudio });
});
console.log(`mock WLED on http://${mock.host} with ${mock.leds} LEDs`);

let seen = 0;
setInterval(() => {
  const frames = mock.ddp.frames - seen;
  seen = mock.ddp.frames;
  if (frames) console.log(`[ddp] ${frames} frames/s, ${(mock.ddp.lastFrame?.length ?? 0) / 3} px/frame`);
}, 1000);
