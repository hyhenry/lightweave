import { useMemo, useState } from 'react';
import type { Pattern, Schedule, Settings } from '../../../../shared/types.ts';
import { AUTOPILOT, LAST_USED } from '../../../../shared/schedule.ts';
import { api, type DeviceWithStatus } from '../../api.ts';
import { Sheet, Toggle, useToast } from '../../components/ui.tsx';
import { DAY_NAMES, MONTHS } from '../../lib/format.ts';
import { patternChoices, usesSun, type Draft } from '../../lib/schedules.ts';
import { LocationPicker } from './LocationPicker.tsx';
import { TriggerPicker } from './TriggerPicker.tsx';

const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DEFAULT_SEASON: Schedule['season'] = { from: [12, 1], to: [1, 6] };

interface Props {
  initial: Draft;
  devices: DeviceWithStatus[];
  patterns: Pattern[];
  favorites: string[];
  settings: Settings;
  onSettings: (s: Settings) => void;
  onClose: () => void;
  onSaved: () => void;
}

export function ScheduleEditor({ initial, devices, patterns, favorites, settings, onSettings, onClose, onSaved }: Props) {
  const toast = useToast();
  const [s, setS] = useState(initial);
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<Schedule>) => setS((x) => ({ ...x, ...patch }));
  const choices = useMemo(() => patternChoices(patterns, favorites), [patterns, favorites]);

  // An empty deviceIds list means "all lights".
  const targets = s.deviceIds.length ? s.deviceIds : devices.map((d) => d.id);
  const toggleDevice = (id: string) => {
    const next = targets.includes(id) ? targets.filter((x) => x !== id) : [...targets, id];
    if (next.length) set({ deviceIds: next.length === devices.length ? [] : next });
  };
  const toggleDay = (d: number) => {
    const next = s.days.includes(d) ? s.days.filter((x) => x !== d) : [...s.days, d];
    if (next.length) set({ days: next });
  };
  const setSeasonPart = (part: 'from' | 'to', index: 0 | 1, value: number) => {
    const md: [number, number] = [...s.season![part]];
    md[index] = value;
    set({ season: { ...s.season!, [part]: md } });
  };

  const save = async () => {
    setBusy(true);
    try {
      await (s.id ? api.updateSchedule(s.id, s) : api.createSchedule(s));
      toast(`Saved “${s.name}”`);
      onSaved();
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!s.id || !confirm(`Delete “${s.name}”?`)) return;
    await api.deleteSchedule(s.id);
    onSaved();
  };

  return (
    <Sheet open onClose={onClose} title={s.id ? 'Edit schedule' : 'New schedule'}>
      <label className="field">
        <span>Name</span>
        <input className="input" value={s.name} maxLength={40} onChange={(e) => set({ name: e.target.value })} />
      </label>

      <label className="field">
        <span>Show</span>
        <select className="input" value={s.patternId} onChange={(e) => set({ patternId: e.target.value })}>
          <option value={LAST_USED}>↺ Last used</option>
          <option value={AUTOPILOT}>✨ Holiday autopilot</option>
          {choices.map(([label, list]) => (
            <optgroup key={label} label={label}>
              {list.map((p) => (
                <option key={`${label}-${p.id}`} value={p.id}>
                  {p.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        {s.patternId === LAST_USED && <span className="hint">Each light comes back on with whatever it showed last.</span>}
        {s.patternId === AUTOPILOT && <span className="hint">The upcoming holiday’s theme (favorites first), otherwise warm white.</span>}
      </label>

      {devices.length > 1 && (
        <div className="field">
          <span>Lights</span>
          <div className="chips wrap">
            {devices.map((d) => (
              <button key={d.id} className={`chip ${targets.includes(d.id) ? 'selected' : ''}`} onClick={() => toggleDevice(d.id)}>
                {targets.includes(d.id) ? '✓ ' : ''}
                {d.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <TriggerPicker label="Turn on" sun="sunset" defaultTime="18:00" value={s.on} onChange={(on) => on && set({ on })} />
      <TriggerPicker label="Turn off" sun="sunrise" defaultTime="23:00" value={s.off} onChange={(off) => set({ off })} allowStayOn />

      {usesSun(s) && !settings.location && <LocationPicker settings={settings} onChange={onSettings} />}

      <div className="field">
        <span>Days</span>
        <div className="days">
          {DAY_LETTERS.map((letter, d) => (
            <button key={d} className={`day ${s.days.includes(d) ? 'selected' : ''}`} aria-label={DAY_NAMES[d]} aria-pressed={s.days.includes(d)} onClick={() => toggleDay(d)}>
              {letter}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <Toggle label="Only part of the year" checked={!!s.season} onChange={(on) => set({ season: on ? DEFAULT_SEASON : undefined })} />
        {s.season && (
          <div className="season">
            {(['from', 'to'] as const).map((part) => (
              <div key={part} className="season-row">
                <span className="hint">{part === 'from' ? 'From' : 'Until'}</span>
                <select className="input" value={s.season![part][0]} onChange={(e) => setSeasonPart(part, 0, Number(e.target.value))}>
                  {MONTHS.map((m, i) => (
                    <option key={m} value={i + 1}>
                      {m}
                    </option>
                  ))}
                </select>
                <select className="input" value={s.season![part][1]} onChange={(e) => setSeasonPart(part, 1, Number(e.target.value))}>
                  {Array.from({ length: 31 }, (_, i) => (
                    <option key={i} value={i + 1}>
                      {i + 1}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="row-btns">
        {s.id && (
          <button className="btn btn-danger" onClick={remove}>
            Delete
          </button>
        )}
        <button className="btn btn-primary" disabled={busy} onClick={save}>
          {busy ? 'Saving…' : 'Save'}
        </button>
      </div>
    </Sheet>
  );
}
