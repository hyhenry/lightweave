import { useState } from 'react';
import type { Device } from '../../../../shared/types.ts';
import { api, type DeviceWithStatus } from '../../api.ts';
import { Sheet, Toggle, useToast } from '../../components/ui.tsx';
import { AudioPassthrough } from './AudioPassthrough.tsx';

interface Props {
  device: DeviceWithStatus;
  devices: DeviceWithStatus[];
  onChanged: () => void; // something changed right away (audio)
  onClose: () => void;
  onDone: () => void; // saved or removed
}

export function EditDevice({ device, devices, onChanged, onClose, onDone }: Props) {
  const toast = useToast();
  const [d, setD] = useState<Device>(device);
  const canReceiveSound = device.status.audio === 'capable' || device.status.audio === 'receiving';

  const save = async () => {
    try {
      await api.updateDevice(d.id, { name: d.name, host: d.host, reverse: d.reverse });
      onDone();
    } catch (e) {
      toast((e as Error).message, 'err');
    }
  };

  const remove = async () => {
    if (!confirm(`Remove ${device.name} from Lightweave?`)) return;
    await api.deleteDevice(device.id);
    onDone();
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
      {canReceiveSound && <AudioPassthrough device={device} devices={devices} onChanged={onChanged} />}
      <div className="row-btns">
        <button className="btn btn-danger" onClick={remove}>
          Remove
        </button>
        <button className="btn btn-primary" onClick={save}>
          Save
        </button>
      </div>
    </Sheet>
  );
}
