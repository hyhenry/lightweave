// Bundles Lightweave as a *local* Home Assistant app in build/homeassistant/lightweave/:
// the app definition from homeassistant/lightweave/ plus the built app in app/, which
// Home Assistant builds on the device. For testing changes before a release; normally
// Home Assistant installs the published image from the app repository instead.

import { execSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const OUT = join(ROOT, 'build', 'homeassistant');
const APP = join(OUT, 'lightweave');

const { version } = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));

execSync('npm run build', { cwd: ROOT, stdio: 'inherit' });

rmSync(OUT, { recursive: true, force: true });
cpSync(join(ROOT, 'homeassistant', 'lightweave'), APP, { recursive: true });

// Home Assistant only rebuilds an app when its version changes. Without `image`,
// it builds this folder on the device instead of downloading the published image.
const configPath = join(APP, 'config.yaml');
const appConfig = readFileSync(configPath, 'utf8')
  .replace(/^version: .*$/m, `version: "${version}"`)
  .replace(/^# Prebuilt by GitHub Actions.*\n^image: .*\n/m, '');
writeFileSync(configPath, appConfig);

// Just what the server needs at runtime; dependencies are installed during the image build.
mkdirSync(join(APP, 'app', 'web'), { recursive: true });
for (const file of ['package.json', 'package-lock.json']) cpSync(join(ROOT, file), join(APP, 'app', file));
for (const dir of ['shared', 'server']) cpSync(join(ROOT, dir), join(APP, 'app', dir), { recursive: true });
cpSync(join(ROOT, 'web', 'dist'), join(APP, 'app', 'web', 'dist'), { recursive: true });


console.log(`
Built Lightweave ${version} for Home Assistant: ${APP}

To install:
  1. Copy the "lightweave" folder into Home Assistant's "local_apps" share
     (Samba share or the Terminal & SSH app).
  2. Settings → Apps → App store → ⋮ → Check for updates.
  3. Open Lightweave under "Local apps" and install it.
To update later: bump "version" in package.json, run this again, copy the
folder over the old one, then Check for updates and Update (or Rebuild).
`);
