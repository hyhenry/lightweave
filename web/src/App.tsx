import { useEffect, useState } from 'react';
import type { Pattern } from '../../shared/types.ts';
import { api } from './api.ts';
import { useDevices } from './hooks/useDevices.ts';
import { useLibrary } from './hooks/useLibrary.ts';
import { useTargets } from './hooks/useTargets.ts';
import { newPattern } from './lib/patterns.ts';
import { Sheet, useToast } from './components/ui.tsx';
import { NowShowing } from './components/NowShowing.tsx';
import { PatternSheet } from './components/PatternSheet.tsx';
import { Favorites } from './pages/Favorites.tsx';
import { Gallery } from './pages/Gallery.tsx';
import { MyPatterns } from './pages/MyPatterns.tsx';
import { Editor } from './pages/editor/Editor.tsx';
import { Lights } from './pages/lights/Lights.tsx';

type Tab = 'favorites' | 'themes' | 'mine' | 'lights';

const TABS: [Tab, string, string][] = [
  ['favorites', '⭐', 'Favorites'],
  ['themes', '🎃', 'Themes'],
  ['mine', '🎨', 'My Patterns'],
  ['lights', '💡', 'Lights'],
];

export function App() {
  const toast = useToast();
  const library = useLibrary();
  const { devices, loaded, reload: reloadDevices, playingIds, anyOn } = useDevices();
  const { targets, toggle: toggleTarget } = useTargets(devices);
  const [tab, setTab] = useState<Tab>('themes');
  const [selected, setSelected] = useState<Pattern | null>(null);
  const [editing, setEditing] = useState<Pattern | null>(null);

  // Open on Favorites once there are some.
  useEffect(() => {
    library
      .reload()
      .then((r) => r.favorites.length && setTab((t) => (t === 'themes' ? 'favorites' : t)))
      .catch((e) => toast(e.message, 'err'));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // First visit with no lights set up: start on the Lights tab.
  useEffect(() => {
    if (loaded && !devices.length) setTab('lights');
  }, [loaded]); // eslint-disable-line react-hooks/exhaustive-deps

  const play = async (body: { patternId?: string; pattern?: Pattern }, name: string) => {
    if (!devices.length) {
      toast('Add your lights first', 'err');
      setTab('lights');
      return;
    }
    try {
      const failed = (await api.play({ ...body, deviceIds: targets })).results.filter((r) => !r.ok);
      if (failed.length) toast(failed.map((f) => f.error).join('\n'), 'err');
      else toast(`✨ ${name} is on`);
      reloadDevices();
    } catch (e) {
      toast((e as Error).message, 'err');
    }
  };

  const save = async (p: Pattern) => {
    const saved = p.id && !p.builtIn ? await api.updatePattern(p.id, p) : await api.createPattern(p);
    await library.reload();
    setEditing(null);
    setSelected(null);
    setTab('mine');
    toast(`Saved “${saved.name}”`);
  };

  const remove = async (p: Pattern) => {
    if (!confirm(`Delete “${p.name}”? This can’t be undone.`)) return;
    try {
      await api.deletePattern(p.id);
      await library.reload();
      setEditing(null);
      setSelected(null);
      toast(`Deleted “${p.name}”`);
    } catch (e) {
      toast((e as Error).message, 'err');
    }
  };

  const setAllPower = async () => {
    await api.power(!anyOn).catch((e) => toast(e.message, 'err'));
    reloadDevices();
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden>
            ✦
          </span>
          Lightweave
        </div>
        {devices.length > 1 && (
          <button className={`power-pill ${anyOn ? 'on' : ''}`} onClick={setAllPower}>
            {anyOn ? 'All off' : 'All on'}
          </button>
        )}
      </header>

      {devices.length > 0 && (
        <div className="now-list">
          {devices.map((d) => (
            <NowShowing key={d.id} device={d} onChanged={reloadDevices} />
          ))}
        </div>
      )}

      <main className="content">
        {tab === 'favorites' && <Favorites patterns={library.favoritePatterns} playingIds={playingIds} onOpen={setSelected} onBrowse={() => setTab('themes')} />}
        {tab === 'themes' && <Gallery patterns={library.themes} favoriteIds={library.favoriteIds} playingIds={playingIds} onOpen={setSelected} />}
        {tab === 'mine' && (
          <MyPatterns patterns={library.mine} favoriteIds={library.favoriteIds} playingIds={playingIds} onOpen={setSelected} onCreate={() => setEditing(newPattern())} />
        )}
        {tab === 'lights' && <Lights devices={devices} loaded={loaded} refresh={reloadDevices} patterns={library.patterns} favorites={library.favorites} />}
      </main>

      <nav className="tabbar">
        {TABS.map(([id, icon, label]) => (
          <button key={id} className={tab === id ? 'selected' : ''} onClick={() => setTab(id)} aria-current={tab === id}>
            <span className="tab-icon">{icon}</span>
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <PatternSheet
        pattern={editing ? null : selected}
        devices={devices}
        targets={targets}
        favorite={!!selected && library.favoriteIds.has(selected.id)}
        onToggleTarget={toggleTarget}
        onShow={async (p) => {
          await play({ patternId: p.id }, p.name);
          setSelected(null);
        }}
        onEdit={setEditing}
        onFavorite={(p, on) => library.toggleFavorite(p.id, on)}
        onDelete={remove}
        onClose={() => setSelected(null)}
      />

      <Sheet open={!!editing} onClose={() => setEditing(null)} full>
        {editing && (
          <Editor
            key={editing.id || 'new'}
            initial={editing}
            onClose={() => setEditing(null)}
            onSave={save}
            onTry={(p) => play({ pattern: p }, p.name)}
            onDelete={editing.id && !editing.builtIn ? () => remove(editing) : undefined}
          />
        )}
      </Sheet>
    </div>
  );
}
