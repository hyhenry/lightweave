import { useEffect, useState } from 'react';
import { api } from '../../api.ts';
import { useToast } from '../../components/ui.tsx';

type Found = { name: string; host: string; added: boolean };

/** When running inside Home Assistant: add the WLED controllers HA already knows, in a tap. */
export function HomeAssistantImport({ deviceCount, onAdded }: { deviceCount: number; onAdded: () => Promise<void> }) {
  const toast = useToast();
  const [found, setFound] = useState<Found[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  // Re-check whenever the number of lights changes (added here or removed).
  useEffect(() => {
    api
      .info()
      .then((i) => (i.homeAssistant ? api.homeAssistantWled() : { devices: [] }))
      .then((r) => setFound(r.devices))
      .catch(() => setFound([]));
  }, [deviceCount]);

  const missing = found.filter((f) => !f.added);
  if (!missing.length) return null;

  const add = async (list: Found[], key: string) => {
    setBusy(key);
    const failed: string[] = [];
    for (const f of list) await api.addDevice({ host: f.host, name: f.name }).catch(() => failed.push(f.name));
    setBusy(null);
    if (failed.length) toast(`Couldn’t reach ${failed.join(', ')}`, 'err');
    else toast(list.length === 1 ? `${list[0].name} added` : `${list.length} lights added`);
    await onAdded();
  };

  return (
    <section className="ha-import">
      <h2 className="section-title">From Home Assistant</h2>
      <ul className="device-list">
        {missing.map((f) => (
          <li key={f.host} className="device">
            <span className="device-main">
              <span className="device-text">
                <strong>{f.name}</strong>
                <small>{f.host}</small>
              </span>
            </span>
            <button className="btn btn-ghost add-btn" disabled={!!busy} onClick={() => add([f], f.host)}>
              {busy === f.host ? 'Adding…' : 'Add'}
            </button>
          </li>
        ))}
      </ul>
      {missing.length > 1 && (
        <button className="btn btn-primary wide" disabled={!!busy} onClick={() => add(missing, 'all')}>
          {busy === 'all' ? 'Adding…' : `Add all ${missing.length}`}
        </button>
      )}
    </section>
  );
}
