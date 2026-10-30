import { useState } from 'react';
import { api, type DeviceWithStatus } from '../../api.ts';
import { Toggle, useToast } from '../../components/ui.tsx';

/** Let a controller without a microphone react to sound picked up by another WLED. */
export function AudioPassthrough({ device, devices, onChanged }: { device: DeviceWithStatus; devices: DeviceWithStatus[]; onChanged: () => void }) {
  const toast = useToast();
  const sources = devices.filter((x) => x.id !== device.id && x.status.audio === 'mic');
  const [on, setOn] = useState(device.status.audio === 'receiving');
  const [sourceId, setSourceId] = useState(device.audioSource ?? sources[0]?.id);
  const [busy, setBusy] = useState(false);

  const apply = async (next: boolean, src = sourceId) => {
    setBusy(true);
    try {
      await api.setAudioSource(device.id, next ? (src ?? null) : null);
      setOn(next);
      setSourceId(src);
      toast(next ? 'Audio reactive on' : 'Audio reactive off');
      onChanged();
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="field audio-field">
      <Toggle label="Audio reactive" checked={on} onChange={(v) => !busy && (!v || sources.length) && apply(v)} />
      {!sources.length ? (
        <p className="hint">Needs another WLED with a microphone to share its sound.</p>
      ) : (
        on && (
          <>
            <span className="hint">Sound from</span>
            <div className="chips wrap">
              {sources.map((s) => (
                <button key={s.id} disabled={busy} className={`chip ${s.id === sourceId ? 'selected' : ''}`} onClick={() => s.id !== sourceId && apply(true, s.id)}>
                  {s.name}
                </button>
              ))}
            </div>
          </>
        )
      )}
    </div>
  );
}

/** Switch a controller's own microphone on or off. */
export function OwnMic({ device, devices, onChanged }: { device: DeviceWithStatus; devices: DeviceWithStatus[]; onChanged: () => void }) {
  const toast = useToast();
  const listeners = devices.filter((x) => x.audioSource === device.id);
  const [on, setOn] = useState(device.status.audio === 'mic');
  const [busy, setBusy] = useState(false);

  const apply = async (next: boolean) => {
    setBusy(true);
    try {
      await api.setMic(device.id, next);
      setOn(next);
      toast(next ? 'Audio reactive on' : 'Audio reactive off');
      onChanged();
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="field audio-field">
      <Toggle label="Audio reactive" checked={on} onChange={(v) => !busy && apply(v)} />
      <p className="hint">Uses this controller’s microphone.</p>
      {on && listeners.length > 0 && (
        <p className="hint">{listeners.map((x) => x.name).join(', ')} also get sound from it and will stop reacting too.</p>
      )}
    </div>
  );
}
