import { useCallback, useEffect, useState } from 'react';
import type { Pattern, Settings } from '../../../../shared/types.ts';
import { api, type DeviceWithStatus, type ScheduleWithNext } from '../../api.ts';
import { useToast } from '../../components/ui.tsx';
import { nextRunLabel } from '../../lib/format.ts';
import { newSchedule, scheduleSummary, showingLabel, usesSun, type Draft } from '../../lib/schedules.ts';
import { LocationPicker } from './LocationPicker.tsx';
import { ScheduleEditor } from './ScheduleEditor.tsx';

interface Props {
  devices: DeviceWithStatus[];
  patterns: Pattern[];
  favorites: string[];
}

export function Schedules({ devices, patterns, favorites }: Props) {
  const toast = useToast();
  const [schedules, setSchedules] = useState<ScheduleWithNext[]>([]);
  const [settings, setSettings] = useState<Settings>({});
  const [timeZone, setTimeZone] = useState('');
  const [editing, setEditing] = useState<Draft | null>(null);

  const load = useCallback(async () => {
    const r = await api.schedules();
    setSchedules(r.schedules);
    setSettings(r.settings);
    setTimeZone(r.timeZone);
  }, []);
  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  const setEnabled = async (s: ScheduleWithNext, enabled: boolean) => {
    setSchedules((x) => x.map((y) => (y.id === s.id ? { ...y, enabled } : y)));
    await api.updateSchedule(s.id, { ...s, enabled }).catch((e) => toast(e.message, 'err'));
    load();
  };

  return (
    <>
      <h2 className="section-title">Schedules</h2>
      {schedules.length > 0 && (
        <ul className="device-list">
          {schedules.map((s) => {
            const next = s.enabled ? nextRunLabel(s.next.on) : undefined;
            return (
              <li key={s.id} className={`device schedule ${s.enabled ? '' : 'disabled'}`}>
                <button className="device-main" onClick={() => setEditing(s)}>
                  <span className="device-text">
                    <strong>{s.name}</strong>
                    <small>{scheduleSummary(s)}</small>
                    <small>{showingLabel(s.patternId, s.showing)}</small>
                    {next && <small className="audio-tag">Next on {next}</small>}
                    {s.enabled && usesSun(s) && !settings.location && <small className="err-text">Pick your city below for sunset times</small>}
                  </span>
                </button>
                <label className="power-switch" aria-label={`${s.name} on/off`}>
                  <input type="checkbox" role="switch" checked={s.enabled} onChange={(e) => setEnabled(s, e.target.checked)} />
                  <span className="switch" aria-hidden />
                </label>
              </li>
            );
          })}
        </ul>
      )}
      <button className="btn btn-ghost wide" disabled={!devices.length} onClick={() => setEditing(newSchedule())}>
        + Add a schedule
      </button>
      <LocationPicker
        settings={settings}
        timeZone={timeZone}
        onChange={(s) => {
          setSettings(s);
          load();
        }}
      />

      {editing && (
        <ScheduleEditor
          initial={editing}
          devices={devices}
          patterns={patterns}
          favorites={favorites}
          settings={settings}
          onSettings={setSettings}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await load();
          }}
        />
      )}
    </>
  );
}
