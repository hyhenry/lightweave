// Entry point: start the web server and the background jobs.

import { buildApp } from './app.ts';
import { config } from './config.ts';
import { startLedSync } from './devices.ts';
import * as player from './player.ts';
import * as scheduler from './scheduler.ts';
import { store } from './store.ts';
import { homeLocation, inHomeAssistant } from './homeassistant.ts';

const app = await buildApp();
await app.listen({ port: config.port, host: '0.0.0.0' });

startLedSync();
// In Home Assistant, sunrise/sunset use HA's home location unless a city was picked.
if (inHomeAssistant && !store.settings().location) {
  homeLocation()
    .then((location) => location && store.updateSettings({ location }))
    .catch((e) => app.log.warn(`Couldn't read Home Assistant's location: ${e.message}`));
}
player.resume().catch((e) => app.log.warn(`Couldn't resume patterns: ${e.message}`));
scheduler.start();

// Save before exiting. (Inside Docker, Node is PID 1 and won't stop on SIGTERM unless handled.)
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => {
    store.flush();
    process.exit(0);
  });
}
