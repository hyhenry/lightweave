import { useState } from 'react';
import type { Device } from '../../../shared/types.ts';
import { api, type DeviceWithStatus } from '../api.ts';
import { Sheet, Toggle, useToast } from '../components/ui.tsx';

interface Props {
  devices: DeviceWithStatus[];
  loaded: boolean;
  refresh: () => Promise<void>;
}

export function Lights({ devices, loaded, refresh }: Props) {
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<DeviceWithStatus | null>(null);

  const power = async (d: DeviceWithStatus, on: boolean) => {
    try {
      await api.power(on, [d.id]);
      await refresh();
    } catch (e) {
      toast((e as Error).message, 'err');
    }
  };

  return (
    <div className="lights">
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

      <ul className="device-list">
        {devices.map((d) => (
          <li key={d.id} className="device">
            <button className="device-main" onClick={() => setEditing(d)}>
              <span className={`status-dot ${d.status.online ? 'on' : 'off'}`} aria-label={d.status.online ? 'Online' : 'Offline'} />
              <span className="device-text">
                <strong>{d.name}</strong>
                <small>
                  {d.status.online ? (d.status.playing ? `Showing ${d.status.playing.patternName}` : d.status.power ? 'On (WLED)' : 'Off') : 'Can’t reach it'}
                  {' · '}
                  {d.ledCount} lights
                </small>
                {d.status.error && <small className="err-text">{d.status.error}</small>}
              </span>
            </button>
            <label className="power-switch" aria-label={`Power ${d.name}`}>
              <input type="checkbox" role="switch" disabled={!d.status.online} checked={!!d.status.power} onChange={(e) => power(d, e.target.checked)} />
              <span className="switch" aria-hidden />
            </label>
          </li>
        ))}
      </ul>

      {devices.length > 0 && (
        <button className="btn btn-ghost wide" onClick={() => setAdding(true)}>
          + Add more lights
        </button>
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

function AddDevice({ open, onClose, onAdded }: { open: boolean; onClose: () => void; onAdded: () => void }) {
  const toast = useToast();
  const [host, setHost] = useState('');
  const [found, setFound] = useState<{ name: string; ledCount: number } | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setHost('');
    setFound(null);
    setName('');
  };

  const find = async () => {
    setBusy(true);
    try {
      const info = await api.probe(host.trim());
      setFound(info);
      setName(info.name);
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setBusy(false);
    }
  };

  const add = async () => {
    setBusy(true);
    try {
      await api.addDevice({ host: host.trim(), name });
      toast(`${name} added`);
      reset();
      onAdded();
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Add lights"
    >
      {!found ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            find();
          }}
        >
          <label className="field">
            <span>WLED address</span>
            <input className="input" inputMode="url" autoCapitalize="off" autoCorrect="off" placeholder="192.168.1.50" value={host} onChange={(e) => setHost(e.target.value)} />
          </label>
          <button className="btn btn-primary wide" disabled={!host.trim() || busy}>
            {busy ? 'Looking…' : 'Find lights'}
          </button>
        </form>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <p className="found">
            Found <strong>{found.name}</strong> with {found.ledCount} lights.
          </p>
          <label className="field">
            <span>What should we call it?</span>
            <input className="input" placeholder="Roofline" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <button className="btn btn-primary wide" disabled={busy || !name.trim()}>
            {busy ? 'Adding…' : 'Add'}
          </button>
        </form>
      )}
    </Sheet>
  );
}

function EditDevice({ device, onClose, onDone }: { device: DeviceWithStatus; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [d, setD] = useState<Device>(device);
  const save = async () => {
    try {
      await api.updateDevice(d.id, { name: d.name, host: d.host, reverse: d.reverse });
      onDone();
    } catch (e) {
      toast((e as Error).message, 'err');
    }
  };
  return (
    <Sheet open onClose={onClose} title={device.name}>
      <label className="field">
        <span>Name</span>
        <input className="input" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} />
      </label>
      <label className="field">
        <span>WLED address</span>
        <input className="input" autoCapitalize="off" value={d.host} onChange={(e) => setD({ ...d, host: e.target.value })} />
      </label>
      <div className="field">
        <span>Number of lights</span>
        <p className="readonly">
          {device.ledCount} <small>from WLED</small>
        </p>
        <p className="hint">To change this, update LED Preferences in WLED. Lightweave picks it up automatically.</p>
      </div>
      <Toggle label="Run patterns the other way" checked={d.reverse} onChange={(reverse) => setD({ ...d, reverse })} />
      <div className="row-btns">
        <button
          className="btn btn-danger"
          onClick={async () => {
            if (!confirm(`Remove ${device.name} from Lightweave?`)) return;
            await api.deleteDevice(device.id);
            onDone();
          }}
        >
          Remove
        </button>
        <button className="btn btn-primary" onClick={save}>
          Save
        </button>
      </div>
    </Sheet>
  );
}
