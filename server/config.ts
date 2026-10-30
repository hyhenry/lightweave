// Settings from the environment (see docker-compose.yml).

import { join } from 'node:path';

export const config = {
  port: Number(process.env.PORT ?? 8787),
  dataDir: process.env.DATA_DIR ?? join(process.cwd(), 'data'),
  /** WLED listens for DDP on 4048; tests point this at a fake controller. */
  ddpPort: Number(process.env.DDP_PORT ?? 4048),
  logLevel: process.env.LOG_LEVEL ?? 'info',
};
