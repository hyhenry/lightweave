# Releasing Lightweave

Notes for maintaining the Home Assistant app. Users don't need any of this.

## Releasing an update

```bash
npm run release 0.3.0
git commit -am "Release 0.3.0" && git push
```

`npm run release` sets the version in `package.json` and `homeassistant/lightweave/config.yaml` and points the app at this repository's images. Pushing the new version starts the **Publish** workflow (GitHub → Actions), which runs the tests, builds the image for both architectures from the root `Dockerfile` and publishes it to `ghcr.io/hyhenry/lightweave`, then creates a GitHub release `v<version>` with that version's notes from `homeassistant/lightweave/CHANGELOG.md`. When it finishes, Home Assistant shows **Update** on the Lightweave app (it checks periodically; **⋮ → Check for updates** in the app store checks now). The **CI** workflow runs the tests on every push.

**One-time setup:** the repository must be public, and after the first Publish run, the image must be made public too: GitHub → your profile → **Packages → lightweave → Package settings → Change visibility → Public**. Otherwise Home Assistant can't download it.

## Trying changes before a release

`npm run build:ha` bundles a local copy in `build/homeassistant/lightweave` that Home Assistant builds on the device. Copy it into the `local_apps` share (Samba share or Terminal & SSH app), then **Check for updates** and install it from **Local apps**. Uninstall it again before using the repository version, since both would run.
