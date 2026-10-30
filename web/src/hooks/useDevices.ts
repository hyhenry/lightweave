import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, type DeviceWithStatus } from '../api.ts';

const POLL_MS = 15_000;

/** Controllers with live status, refreshed every 15s while the app is visible. */
export function useDevices() {
  const [devices, setDevices] = useState<DeviceWithStatus[]>([]);
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(async () => {
    try {
      setDevices((await api.devices()).devices);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    reload().catch(() => {});
    const t = setInterval(() => document.visibilityState === 'visible' && reload().catch(() => {}), POLL_MS);
    return () => clearInterval(t);
  }, [reload]);

  const playingIds = useMemo(() => new Set(devices.flatMap((d) => (d.status.playing ? [d.status.playing.patternId] : []))), [devices]);

  return { devices, loaded, reload, playingIds, anyOn: devices.some((d) => d.status.power) };
}
