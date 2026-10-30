// Release bookkeeping: Home Assistant only offers an update when the app's
// version changes, so it must always match package.json.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..', '..');
const read = (f: string) => readFileSync(join(ROOT, f), 'utf8');

test('Home Assistant app version matches package.json', () => {
  const pkg = JSON.parse(read('package.json')).version;
  const app = read('homeassistant/lightweave/config.yaml').match(/^version: "([^"]+)"$/m)?.[1];
  assert.equal(app, pkg, 'run `npm run release <version>` to keep them together');
});

test('the app repository is laid out the way Home Assistant expects', () => {
  assert.match(read('repository.yaml'), /^name: Lightweave$/m);
  const config = read('homeassistant/lightweave/config.yaml');
  for (const key of ['name', 'version', 'slug', 'description', 'arch', 'image']) assert.match(config, new RegExp(`^${key}:`, 'm'), key);
  assert.match(config, /^image: ghcr\.io\/[a-z0-9_.-]+\/lightweave$/im);
  assert.match(config, /^ingress: true$/m);
  assert.match(config, /^ingress_port: 8787$/m);
});
