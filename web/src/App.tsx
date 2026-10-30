import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Pattern } from '../../shared/types.ts';
import { api, type DeviceWithStatus } from './api.ts';
import { Sheet, useToast } from './components/ui.tsx';
import { StripPreview } from './components/StripPreview.tsx';
import { Gallery } from './pages/Gallery.tsx';
import { Editor, newPattern, ANIMATION_INFO } from './pages/Editor.tsx';
import { Lights } from './pages/Lights.tsx';

type Tab = 'themes' | 'mine' | 'lights';

const TARGETS_KEY = 'lightweave.targets';
function loadTargets(): string[] {
  try {
    return JSON.parse(localStorage.getItem(TARGETS_KEY) ?? '[]');
  } catch {
    return [];
  }
}

export function App() {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('themes');
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [devices, setDevices] = useState<DeviceWithStatus[]>([]);
  const [devicesLoaded, setDevicesLoaded] = useState(false);
  const [selected, setSelected] = useState<Pattern | null>(null);
  const [editing, setEditing] = useState<Pattern | null>(null);
  const [targets, setTargets] = useState<string[]>(loadTargets);

  const loadPatterns = useCallback(async () => {
    const r = await api.patterns();
    setPatterns(r.patterns);
    setFavorites(r.favorites);
  }, []);
  const loadDevices = useCallback(async () => {
    try {
      setDevices((await api.devices()).devices);
    } finally {
      setDevicesLoaded(true);
    }
  }, []);

  useEffect(() => {
    loadPatterns().catch((e) => toast(e.message, 'err'));
    loadDevices().catch(() => {});
    const t = setInterval(() => document.visibilityState === 'visible' && loadDevices().catch(() => {}), 15000);
    return () => clearInterval(t);
  }, [loadPatterns, loadDevices, toast]);

  // First visit with no lights set up: start on the Lights tab.
  useEffect(() => {
    if (devicesLoaded && !devices.length) setTab('lights');
  }, [devicesLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeTargets = useMemo(() => {
    const valid = targets.filter((id) => devices.some((d) => d.id === id));
    return valid.length ? valid : devices.map((d) => d.id);
  }, [targets, devices]);

  const toggleTarget = (id: string) => {
    const next = activeTargets.includes(id) ? activeTargets.filter((x) => x !== id) : [...activeTargets, id];
    if (!next.length) return;
    setTargets(next);
    try {
      localStorage.setItem(TARGETS_KEY, JSON.stringify(next));
    } catch {}
  };

  const playingIds = useMemo(() => new Set(devices.map((d) => d.status.playing?.patternId).filter(Boolean) as string[]), [devices]);
  const nowShowing = devices.find((d) => d.status.playing)?.status.playing;
  const anyOn = devices.some((d) => d.status.power);

  const play = async (body: { patternId?: string; pattern?: Pattern }, name: string) => {
    if (!devices.length) {
      toast('Add your lights first', 'err');
      setTab('lights');
      return;
    }
    try {
      const { results } = await api.play({ ...body, deviceIds: activeTargets });
      const failed = results.filter((r) => !r.ok);
      if (failed.length) toast(failed.map((f) => f.error).join('\n'), 'err');
      else toast(`✨ ${name} is on`);
      loadDevices();
    } catch (e) {
      toast((e as Error).message, 'err');
    }
  };

  const save = async (p: Pattern) => {
    const saved = p.id && !p.builtIn ? await api.updatePattern(p.id, p) : await api.createPattern(p);
    await loadPatterns();
    setEditing(null);
    setSelected(null);
    setTab('mine');
    toast(`Saved “${saved.name}”`);
  };

  const mine = patterns.filter((p) => !p.builtIn);
  const themes = patterns.filter((p) => p.builtIn);
  const isFav = selected ? favorites.includes(selected.id) : false;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden>
            ✦
          </span>
          Lightweave
        </div>
        {devices.length > 0 && (
          <button
            className={`power-pill ${anyOn ? 'on' : ''}`}
            onClick={async () => {
              await api.power(!anyOn).catch((e) => toast(e.message, 'err'));
              loadDevices();
            }}
          >
            {anyOn ? 'Turn off' : 'Turn on'}
          </button>
        )}
      </header>

      {nowShowing && (
        <div className="now-showing">
          <span className="live-dot" />
          Now showing <strong>{nowShowing.patternName}</strong>
        </div>
      )}

      <main className="content">
        {tab === 'themes' && <Gallery patterns={themes} favorites={favorites.filter((f) => themes.some((t) => t.id === f))} playingIds={playingIds} onOpen={setSelected} />}
        {tab === 'mine' && (
          <>
            <button className="btn btn-primary wide create-btn" onClick={() => setEditing(newPattern())}>
              + Create a pattern
            </button>
            <Gallery
              patterns={mine}
              favorites={[]}
              playingIds={playingIds}
              onOpen={setSelected}
              showFilters={false}
              empty={
                <div className="empty">
                  <div className="empty-art">🎨</div>
                  <h2>Make it yours</h2>
                  <p>Pick colors, choose how many lights each one gets, and add some motion. Or open any theme and tap “Customize”.</p>
                </div>
              }
            />
          </>
        )}
        {tab === 'lights' && <Lights devices={devices} loaded={devicesLoaded} refresh={loadDevices} />}
      </main>

      <nav className="tabbar">
        {(
          [
            ['themes', '🎃', 'Themes'],
            ['mine', '🎨', 'My Patterns'],
            ['lights', '💡', 'Lights'],
          ] as const
        ).map(([id, icon, label]) => (
          <button key={id} className={tab === id ? 'selected' : ''} onClick={() => setTab(id)} aria-current={tab === id}>
            <span className="tab-icon">{icon}</span>
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <Sheet open={!!selected && !editing} onClose={() => setSelected(null)} title={selected?.name}>
        {selected && (
          <div className="detail">
            <StripPreview pattern={selected} rows={2} dot={11} className="strip-big" />
            <p className="hint center">
              {selected.category} · {ANIMATION_INFO[selected.animation].label}
            </p>
            {devices.length > 1 && (
              <div className="targets">
                <span className="hint">Show on</span>
                <div className="chips wrap">
                  {devices.map((d) => (
                    <button key={d.id} className={`chip ${activeTargets.includes(d.id) ? 'selected' : ''}`} onClick={() => toggleTarget(d.id)}>
                      {activeTargets.includes(d.id) ? '✓ ' : ''}
                      {d.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <button
              className="btn btn-primary wide big"
              onClick={async () => {
                await play({ patternId: selected.id }, selected.name);
                setSelected(null);
              }}
            >
              ✨ Show on the lights
            </button>
            <div className="row-btns">
              <button className="btn btn-ghost" onClick={() => setEditing(selected)}>
                {selected.builtIn ? '🎨 Customize' : '✏️ Edit'}
              </button>
              <button
                className="btn btn-ghost"
                onClick={async () => {
                  const r = await api.favorite(selected.id, !isFav);
                  setFavorites(r.favorites);
                }}
              >
                {isFav ? '★ Favorited' : '☆ Favorite'}
              </button>
            </div>
          </div>
        )}
      </Sheet>

      <Sheet open={!!editing} onClose={() => setEditing(null)} full>
        {editing && (
          <Editor
            key={editing.id || 'new'}
            initial={editing}
            onClose={() => setEditing(null)}
            onSave={save}
            onTry={(p) => play({ pattern: p }, p.name)}
            onDelete={
              editing.id && !editing.builtIn
                ? async () => {
                    await api.deletePattern(editing.id);
                    await loadPatterns();
                    setEditing(null);
                    setSelected(null);
                    toast('Pattern deleted');
                  }
                : undefined
            }
          />
        )}
      </Sheet>
    </div>
  );
}
