import type { Settings } from '../../../../shared/types.ts';
import { CITIES } from '../../../../shared/sun.ts';
import { api } from '../../api.ts';
import { useToast } from '../../components/ui.tsx';

/** The city used for sunrise and sunset (phones won't share GPS over plain http). */
export function LocationPicker({ settings, timeZone, onChange }: { settings: Settings; timeZone?: string; onChange: (s: Settings) => void }) {
  const toast = useToast();
  const choose = async (name: string) => {
    if (name === settings.location?.name) return;
    try {
      onChange(await api.setLocation(CITIES.find((c) => c.name === name) ?? null));
    } catch (e) {
      toast((e as Error).message, 'err');
    }
  };
  return (
    <label className="field location">
      <span>Sunrise &amp; sunset for</span>
      <select className="input" value={settings.location?.name ?? ''} onChange={(e) => choose(e.target.value)}>
        <option value="">Choose your city…</option>
        {/* e.g. Home Assistant's home location, which isn't one of the cities */}
        {settings.location && !CITIES.some((c) => c.name === settings.location!.name) && <option>{settings.location.name}</option>}
        {CITIES.map((c) => (
          <option key={c.name}>{c.name}</option>
        ))}
      </select>
      {timeZone && <span className="hint">Times use the server’s time zone ({timeZone.replace(/_/g, ' ')}).</span>}
    </label>
  );
}
