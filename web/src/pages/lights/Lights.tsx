import { useState } from 'react';
import type { Pattern } from '../../../../shared/types.ts';
import { api, type DeviceWithStatus } from '../../api.ts';
import { useToast } from '../../components/ui.tsx';
import { hostLabel } from '../../lib/format.ts';
import { Schedules } from '../schedules/Schedules.tsx';
import { AddDevice } from './AddDevice.tsx';
import { EditDevice } from './EditDevice.tsx';
import { HomeAssistantImport } from './HomeAssistantImport.tsx';

interface Props {
  devices: DeviceWithStatus[];
  loaded: boolean;
  refresh: () => Promise<void>;
  patterns: Pattern[];
  favorites: string[];
}

/** Setup: controllers and schedules. Turning lights on/off lives in the cards at the top. */
export function Lights({ devices, loaded, refresh, patterns, favorites }: Props) {
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<DeviceWithStatus | null>(null);

  return (
    <div className="lights">
      <HomeAssistantImport deviceCount={devices.length} onAdded={refresh} />
      {loaded && !devices.length && (
        <div className="empty">
          <div className="empty-art">💡</div>
          <h2>Connect your lights</h2>
          <p>Add each WLED controller by its IP address. You’ll find it in the WLED app under the controller’s info.</p>
          <button className="btn btn-primary" onClick={() => setAdding(true)}>
            Add lights
          </button>
        </div>
      )}

      {devices.length > 0 && (
        <>
          <h2 className="section-title">Controllers</h2>
          <ul className="device-list">
            {devices.map((d) => (
              <li key={d.id} className="device">
                <button className="device-main" onClick={() => setEditing(d)}>
                  <span className={`status-dot ${d.status.online ? 'on' : 'off'}`} aria-label={d.status.online ? 'Online' : 'Offline'} />
                  <span className="device-text">
                    <strong>{d.name}</strong>
                    <small>
                      {d.status.online ? hostLabel(d.host) : 'Can’t reach it'} · {d.ledCount} lights
                    </small>
                    {(d.status.audio === 'mic' || d.status.audio === 'receiving') && <small className="audio-tag">♪ Audio reactive</small>}
                    {d.status.error && <small className="err-text">{d.status.error}</small>}
                  </span>
                  <span className="chevron" aria-hidden>
                    ›
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <button className="btn btn-ghost wide" onClick={() => setAdding(true)}>
            + Add more lights
          </button>
          <Schedules devices={devices} patterns={patterns} favorites={favorites} />
        </>
      )}

      {devices.some((d) => d.status.playing) && (
        <div className="callout">
          <p>Want to use the regular WLED app again? This stops Lightweave patterns and returns the lights to WLED.</p>
          <button
            className="btn btn-ghost"
            onClick={async () => {
              await api.release();
              await refresh();
              toast('Lights handed back to WLED');
            }}
          >
            Return to WLED
          </button>
        </div>
      )}

      <AddDevice
        open={adding}
        onClose={() => setAdding(false)}
        onAdded={async () => {
          setAdding(false);
          await refresh();
        }}
      />
      {editing && (
        <EditDevice
          device={editing}
          devices={devices}
          onChanged={refresh}
          onClose={() => setEditing(null)}
          onDone={async () => {
            setEditing(null);
            await refresh();
          }}
        />
      )}
    </div>
  );
}
