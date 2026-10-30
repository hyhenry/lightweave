import { useEffect, useRef } from 'react';
import type { Pattern } from '../../../shared/types.ts';
import { isStatic, render } from '../../../shared/engine.ts';

// One shared animation loop (~30fps) for every visible preview on the page.
const subscribers = new Set<(t: number) => void>();
let raf = 0;
let last = 0;
function loop(now: number) {
  if (now - last > 30) {
    last = now;
    const t = now / 1000;
    subscribers.forEach((fn) => fn(t));
  }
  raf = subscribers.size ? requestAnimationFrame(loop) : 0;
}
function subscribe(fn: (t: number) => void) {
  subscribers.add(fn);
  if (!raf) raf = requestAnimationFrame(loop);
  return () => void subscribers.delete(fn);
}

interface Props {
  pattern: Pattern;
  leds?: number;
  rows?: number;
  dot?: number; // LED spacing in CSS px
  className?: string;
}

/** Glowing row(s) of LEDs rendered with the same engine that drives the real lights. */
export function StripPreview({ pattern, leds, rows = 1, dot = 10, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const patternRef = useRef(pattern);
  patternRef.current = pattern;

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    let visible = false;
    let unsub: (() => void) | undefined;
    let width = 0;
    let height = 0;
    let count = 0;
    let buf = new Uint8Array(0);

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      count = leds ?? Math.max(8, Math.floor(width / dot)) * rows;
      buf = new Uint8Array(count * 3);
    };

    const draw = (t: number) => {
      if (!width) return;
      const frame = render(patternRef.current, count, t, buf);
      ctx.clearRect(0, 0, width, height);
      const perRow = Math.ceil(count / rows);
      const gap = width / perRow;
      const rowH = height / rows;
      const r = Math.max(1.6, Math.min(gap, rowH) * 0.22);
      for (let i = 0; i < count; i++) {
        const row = Math.floor(i / perRow);
        // Snake rows so the strip reads as one continuous run.
        const col = row % 2 === 0 ? i % perRow : perRow - 1 - (i % perRow);
        const x = gap * (col + 0.5);
        const y = rowH * (row + 0.5);
        const R = frame[i * 3];
        const G = frame[i * 3 + 1];
        const B = frame[i * 3 + 2];
        const lum = Math.max(R, G, B);
        if (lum < 8) {
          ctx.fillStyle = '#262b3a';
          ctx.beginPath();
          ctx.arc(x, y, r * 0.8, 0, Math.PI * 2);
          ctx.fill();
          continue;
        }
        // Brighten dim colors a touch so they read on a phone screen.
        const k = 255 / Math.max(lum, 1);
        const vivid = `rgb(${Math.min(255, R * k)},${Math.min(255, G * k)},${Math.min(255, B * k)})`;
        const a = lum / 255;
        ctx.globalAlpha = 0.28 * a;
        ctx.fillStyle = vivid;
        ctx.beginPath();
        ctx.arc(x, y, r * 2.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.25 + 0.75 * a;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.6 * a;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(x, y, r * 0.45, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    };

    const sync = () => {
      unsub?.();
      unsub = undefined;
      draw(performance.now() / 1000);
      if (visible && !isStatic(patternRef.current)) unsub = subscribe(draw);
    };

    resize();
    const ro = new ResizeObserver(() => {
      resize();
      draw(performance.now() / 1000);
    });
    ro.observe(canvas);
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      sync();
    });
    io.observe(canvas);
    (canvas as any).__sync = sync;

    return () => {
      ro.disconnect();
      io.disconnect();
      unsub?.();
    };
  }, [leds, rows, dot]);

  // Redraw / start or stop animating when the pattern changes.
  useEffect(() => {
    (canvasRef.current as any)?.__sync?.();
  }, [pattern]);

  return <canvas ref={canvasRef} className={`strip ${className ?? ''}`} aria-hidden />;
}
