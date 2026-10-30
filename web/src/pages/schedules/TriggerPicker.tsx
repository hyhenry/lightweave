import type { Trigger } from '../../../../shared/types.ts';
import { offsetLabel } from '../../lib/format.ts';

const OFFSETS = [-60, -45, -30, -15, 0, 15, 30, 45, 60, 90, 120];

interface Props {
  label: string;
  sun: 'sunset' | 'sunrise';
  defaultTime: string; // "HH:MM" when switching to a set time
  value?: Trigger;
  onChange: (t?: Trigger) => void;
  allowStayOn?: boolean;
}

/** Sunset/sunrise (± an offset), a set time, or (for "off") stay on. */
export function TriggerPicker({ label, sun, defaultTime, value, onChange, allowStayOn }: Props) {
  const mode = !value ? 'none' : value.kind === 'time' ? 'time' : 'sun';
  return (
    <div className="field">
      <span>{label}</span>
      <div className="segmented">
        <button className={mode === 'sun' ? 'selected' : ''} onClick={() => onChange({ kind: sun, offset: 0 })}>
          {sun === 'sunset' ? '🌇 Sunset' : '🌅 Sunrise'}
        </button>
        <button className={mode === 'time' ? 'selected' : ''} onClick={() => onChange({ kind: 'time', time: defaultTime })}>
          🕒 Time
        </button>
        {allowStayOn && (
          <button className={mode === 'none' ? 'selected' : ''} onClick={() => onChange(undefined)}>
            Stay on
          </button>
        )}
      </div>
      {value?.kind === 'time' && <input className="input" type="time" value={value.time} onChange={(e) => e.target.value && onChange({ kind: 'time', time: e.target.value })} />}
      {value && value.kind !== 'time' && (
        <select className="input" value={value.offset} onChange={(e) => onChange({ kind: value.kind, offset: Number(e.target.value) })}>
          {OFFSETS.map((o) => (
            <option key={o} value={o}>
              {offsetLabel(o, value.kind)}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
