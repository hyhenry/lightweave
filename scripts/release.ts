// Prepares a release: sets the version in package.json and the Home Assistant
// app's config.yaml, and points the app at this repository's GitHub images.
//   npm run release 0.3.0
// Then commit and push; the "Publish" workflow builds and publishes the image,
// and Home Assistant offers the update.

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const version = process.argv[2];
if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  console.error('Usage: npm run release <version>   e.g. npm run release 0.3.0');
  process.exit(1);
}

// github.com/<owner>/<repo> from the "origin" remote (https or ssh form).
let remote = '';
try {
  remote = execSync('git remote get-url origin', { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
} catch {}
const match = remote.match(/github\.com[:/]([^/]+)\/([^/]+?)(\.git)?$/);
if (!match) {
  console.error(`No GitHub "origin" remote found (${remote || 'none'}). Add one first:\n  git remote add origin https://github.com/<you>/lightweave.git`);
  process.exit(1);
}
const [, owner, repo] = match;
const url = `https://github.com/${owner}/${repo}`;
const image = `ghcr.io/${owner.toLowerCase()}/lightweave`; // registry names must be lowercase

const edit = (file: string, change: (text: string) => string) => {
  const path = join(ROOT, file);
  writeFileSync(path, change(readFileSync(path, 'utf8')));
};

edit('package.json', (t) => t.replace(/"version": "[^"]*"/, `"version": "${version}"`));
edit('homeassistant/lightweave/config.yaml', (t) =>
  t
    .replace(/^version: .*$/m, `version: "${version}"`)
    .replace(/^url: .*$/m, `url: ${url}`)
    .replace(/^image: .*$/m, `image: ${image}`),
);
edit('repository.yaml', (t) => t.replace(/^url: .*$/m, `url: ${url}`));

console.log(`
Lightweave ${version} is ready to release from ${url}.

  1. Add a line for ${version} to homeassistant/lightweave/CHANGELOG.md
  2. git commit -am "Release ${version}" && git push
  3. Watch the "Publish" workflow on GitHub (Actions tab). When it's done,
     Home Assistant shows the update (Settings → Apps → Lightweave), and the
     release appears on GitHub with the changelog notes.
`);
