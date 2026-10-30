# Lightweave

A phone-friendly companion app for [WLED](https://kno.wled.ge) exterior lights. It brings back the parts of apps like Gemstone that WLED lacks: a library of holiday themes, and a simple editor for building your own patterns ("3 orange, 2 purple, 1 off, repeat") with motion like chase, twinkle and breathe.

## Run it

With Docker:

```bash
docker compose up -d --build
```

Then open `http://<server-ip>:8787` on your phone. On iPhone, use **Share → Add to Home Screen** so it opens like an app.

For development:

```bash
npm install
npm run mock        # fake WLED controller on 127.0.0.1:8090 (UDP 4048)
npm run dev         # API on :8787, web app with hot reload on :5173
```

## How it drives the lights

- **Still patterns** go to WLED once through the JSON API (`seg.i` per-LED colors on segment 0). After that the server isn't needed. WLED doesn't keep these across a power cycle, so after a power loss the controller comes back to its own last preset.
- **Animated patterns** are rendered by Lightweave and streamed to WLED at 30 fps over DDP (UDP port 4048). The same renderer draws the previews in the app, so what you see is what goes on the house. This means **the container has to keep running for animations**. If it stops, WLED returns to its own state after its realtime timeout (2.5s by default). Animations pick back up when the container restarts.
- **Return to WLED** (Lights tab) stops everything Lightweave is doing so the normal WLED app takes over again.

Tips:
- Add controllers by IP address, not `wled-xxxx.local`, and give each one a fixed IP (a DHCP reservation in your router).
- WLED's own timers and schedules don't know about Lightweave. A timer that applies a preset will paint over a still pattern, and a timer that turns the lights off won't stop an animation Lightweave is streaming. Turn lights on and off from Lightweave, or disable WLED timers that clash.
- If WLED splits your strip into several segments, Lightweave's still patterns only paint segment 0. Streaming covers every LED.
- On a strip wired from the "wrong" end, turn on **Run patterns the other way** for that controller.

## Layout

```
shared/   pattern types, the render engine, built-in themes (used by server and browser)
server/   Fastify API, JSON storage in $DATA_DIR, WLED JSON + DDP client, playback manager
web/      React app (Vite), phone-first
scripts/  mock WLED controller for development
```

Data lives in `$DATA_DIR/lightweave.json` (`/data` in Docker).
