// Home Assistant, when Lightweave runs as an HA app: find the WLED controllers HA
// already knows about, and use HA's home location for sunrise/sunset.
// Outside Home Assistant (no SUPERVISOR_TOKEN) all of this is switched off.

import type { Settings } from '../shared/types.ts';

const TOKEN = process.env.SUPERVISOR_TOKEN;
const CORE_API = process.env.HA_CORE_API ?? 'http://supervisor/core/api';

export const inHomeAssistant = Boolean(TOKEN);

async function core(path: string, body?: unknown): Promise<string> {
  const res = await fetch(`${CORE_API}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`Home Assistant replied ${res.status}`);
  return res.text();
}

// HA's WLED integration records each controller's address as its device's
// configuration_url ("http://<host>"). A template collects them in one call.
const WLED_TEMPLATE = `
{%- set ns = namespace(found=[]) -%}
{%- for id in integration_entities('wled') | map('device_id') | reject('none') | unique -%}
  {%- set ns.found = ns.found + [{'name': device_attr(id, 'name_by_user') or device_attr(id, 'name'), 'url': device_attr(id, 'configuration_url')}] -%}
{%- endfor -%}
{{ ns.found | tojson }}`;

export interface HaWled {
  name: string;
  host: string;
}

let warned = false;

/** WLED controllers set up in Home Assistant. Empty outside HA or if HA can't be asked. */
export async function wledFromHomeAssistant(): Promise<HaWled[]> {
  if (!inHomeAssistant) return [];
  try {
    const found = JSON.parse(await core('/template', { template: WLED_TEMPLATE })) as { name?: string; url?: string }[];
    return found.flatMap((d) => {
      if (!d.url) return [];
      const host = new URL(d.url).host;
      return [{ name: d.name || host, host }];
    });
  } catch (e) {
    if (!warned) console.warn(`[home assistant] couldn't list WLED devices: ${(e as Error).message}`);
    warned = true;
    return [];
  }
}

/** Home Assistant's home location, for sunrise and sunset times. */
export async function homeLocation(): Promise<Settings['location']> {
  if (!inHomeAssistant) return undefined;
  const cfg = JSON.parse(await core('/config'));
  if (!Number.isFinite(cfg.latitude) || !Number.isFinite(cfg.longitude)) return undefined;
  return { name: `${cfg.location_name || 'Home'} (Home Assistant)`, lat: cfg.latitude, lon: cfg.longitude };
}
