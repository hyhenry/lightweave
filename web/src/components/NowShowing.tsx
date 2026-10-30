import { useEffect, useRef, useState } from 'react';
import { api, type DeviceWithStatus } from '../api.ts';
import { useThrottledSend } from '../hooks/useThrottledSend.ts';
import { useToast } from './ui.tsx';
import { StripPreview } from './StripPreview.tsx';

/**
 * One controller's card: what it's showing, a live preview, its own power switch
 * and brightness. When it's off, just its name and a switch to turn it back on.
 */
/** Give up waiting for the controller to report a switch and show what it says instead. */
const SETTLE_MS = 5000;

export function NowShowing({ device, onChanged }: { device: DeviceWithStatus; onChanged: () => Promise<unknown> | void }) {
  const toast = useToast();
  const { status } = device;
  const level = device.brightness ?? 80;
  const [brightness, setBrightness] = useState(level);
  const [power, setPower] = useState(!!status.power);
  const [busy, setBusy] = useState(false);
  const dragging = useRef(false);
  const sender = useThrottledSend((v: number) => api.brightness(v, [device.id]));
  // What the switch was just flipped to, until the controller's status agrees.
  // Status fetched before the flip would otherwise snap the switch back for a moment.
  const wanted = useRef<boolean | null>(null);
  const reported = useRef(!!status.power);
  reported.current = !!status.power;

  // Follow the server's values unless mid-drag or mid-switch.
  useEffect(() => {
    if (!dragging.current && !sender.pending()) setBrightness(level);
  }, [level]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (wanted.current !== null && reported.current !== wanted.current) return;
    wanted.current = null;
    setPower(reported.current);
  }, [status.power]);

  const toggle = async (on: boolean) => {
    wanted.current = on;
    setPower(on);
    setBusy(true);
    try {
      const { results } = await api.power(on, [device.id]);
      const failed = results.find((r) => !r.ok);
      if (failed) throw new Error(failed.error);
      await onChanged();
      setTimeout(() => {
        if (wanted.current !== on) return;
        wanted.current = null;
        setPower(reported.current);
      }, SETTLE_MS);
    } catch (e) {
      wanted.current = null;
      setPower(!on);
      toast((e as Error).message || `Couldn’t reach ${device.name}`, 'err');
    } finally {
      setBusy(false);
    }
  };

  const playing = power ? status.playing : undefined;
  const lit = status.online && power;

  return (
    <section className={`now-showing ${lit ? '' : 'is-off'}`} aria-label={device.name}>
      <div className="now-head">
        {playing && <span className="live-dot" />}
        <span className="now-title">
          {!status.online ? (
            <>
              <strong>{device.name}</strong> · can’t reach it
            </>
          ) : !power ? (
            <>
              <strong>{device.name}</strong> is off
            </>
          ) : playing ? (
            <>
              Now showing <strong>{playing.patternName}</strong> on <strong>{device.name}</strong>
            </>
          ) : (
            <>
              <strong>{device.name}</strong> · WLED’s own lights
            </>
          )}
        </span>
        <label className="power-switch" aria-label={`Power ${device.name}`}>
          <input type="checkbox" role="switch" disabled={!status.online || busy} checked={power} onChange={(e) => toggle(e.target.checked)} />
          <span className="switch" aria-hidden />
        </label>
      </div>
      {playing && (
        <StripPreview pattern={{ ...playing.pattern, brightness: (playing.pattern.brightness * brightness) / 100 }} className="strip-now" />
      )}
      {lit && (
        <label className="now-bri">
          <span aria-hidden className="bri-icon dim">
            ☀
          </span>
          <input
            type="range"
            min={5}
            max={100}
            step={5}
            value={brightness}
            aria-label={`${device.name} brightness`}
            onPointerDown={() => (dragging.current = true)}
            onPointerUp={() => (dragging.current = false)}
            onChange={(e) => {
              const v = Number(e.target.value);
              setBrightness(v);
              sender.push(v);
            }}
          />
          <span aria-hidden className="bri-icon">
            ☀
          </span>
          <span className="bri-value">{brightness}%</span>
        </label>
      )}
    </section>
  );
}
