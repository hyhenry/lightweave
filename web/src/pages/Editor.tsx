import { useState } from 'react';
import type { Animation, ColorBlock, Pattern } from '../../../shared/types.ts';
import { StripPreview } from '../components/StripPreview.tsx';
import { ColorPicker, colorName } from '../components/ColorPicker.tsx';
import { Toggle } from '../components/ui.tsx';

export const ANIMATION_INFO: Record<Animation, { label: string; icon: string; blurb: string }> = {
  static: { label: 'Still', icon: '●', blurb: 'Colors stay put' },
  chase: { label: 'Chase', icon: '➜', blurb: 'Pattern glides along' },
  marquee: { label: 'Marquee', icon: '⋯', blurb: 'Steps like theater lights' },
  twinkle: { label: 'Twinkle', icon: '✦', blurb: 'Lights fade in and out' },
  sparkle: { label: 'Sparkle', icon: '✧', blurb: 'Quick white glints' },
  breathe: { label: 'Breathe', icon: '◐', blurb: 'Gently dims and brightens' },
  wave: { label: 'Wave', icon: '〰', blurb: 'A glow rolls through' },
  colorCycle: { label: 'Color Fade', icon: '◑', blurb: 'All lights fade color to color' },
};

const ORDER: Animation[] = ['static', 'chase', 'marquee', 'twinkle', 'sparkle', 'breathe', 'wave', 'colorCycle'];

export function newPattern(): Pattern {
  return {
    id: '',
    name: '',
    category: 'My Patterns',
    blocks: [
      { color: '#FF0000', count: 3 },
      { color: '#FFFFFF', count: 3 },
    ],
    animation: 'static',
    speed: 4,
    direction: 'forward',
    brightness: 80,
    blend: false,
  };
}

interface Props {
  initial: Pattern;
  onSave: (p: Pattern) => Promise<void>;
  onTry: (p: Pattern) => Promise<void>;
  onDelete?: () => Promise<void>;
  onClose: () => void;
}

export function Editor({ initial, onSave, onTry, onDelete, onClose }: Props) {
  const [p, setP] = useState<Pattern>(() => ({
    ...initial,
    name: initial.builtIn ? `${initial.name} (mine)` : initial.name,
    category: initial.builtIn ? 'My Patterns' : initial.category,
    blocks: initial.blocks.map((b) => ({ ...b })),
  }));
  const [picking, setPicking] = useState<number | null>(null);
  const [busy, setBusy] = useState<'save' | 'try' | null>(null);

  const set = (patch: Partial<Pattern>) => setP((x) => ({ ...x, ...patch }));
  const setBlock = (i: number, patch: Partial<ColorBlock>) =>
    setP((x) => ({ ...x, blocks: x.blocks.map((b, j) => (j === i ? { ...b, ...patch } : b)) }));
  const move = (i: number, d: -1 | 1) =>
    setP((x) => {
      const blocks = [...x.blocks];
      const j = i + d;
      if (j < 0 || j >= blocks.length) return x;
      [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
      return { ...x, blocks };
    });
  const remove = (i: number) => setP((x) => ({ ...x, blocks: x.blocks.filter((_, j) => j !== i) }));
  const add = () =>
    setP((x) => {
      const last = x.blocks[x.blocks.length - 1];
      return { ...x, blocks: [...x.blocks, { color: '#00C020', count: last?.count ?? 3 }] };
    });

  const run = async (kind: 'save' | 'try') => {
    setBusy(kind);
    try {
      const final = { ...p, name: p.name.trim() || 'My Pattern' };
      await (kind === 'save' ? onSave(final) : onTry(final));
    } finally {
      setBusy(null);
    }
  };

  const moving = p.animation !== 'static';
  const directional = ['chase', 'marquee', 'wave', 'colorCycle'].includes(p.animation);
  const total = p.blocks.reduce((n, b) => n + b.count, 0);

  return (
    <div className="editor">
      <header className="editor-top">
        <button className="text-btn" onClick={onClose}>
          Cancel
        </button>
        <strong>{initial.id && !initial.builtIn ? 'Edit pattern' : 'New pattern'}</strong>
        <button className="text-btn accent" disabled={!!busy || !p.blocks.length} onClick={() => run('save')}>
          {busy === 'save' ? 'Saving…' : 'Save'}
        </button>
      </header>

      <div className="editor-preview">
        <StripPreview pattern={p} rows={3} dot={11} className="strip-big" />
        <p className="hint center">
          Repeats every {total} light{total === 1 ? '' : 's'} along your roofline
        </p>
      </div>

      <div className="editor-scroll">
        <section className="field">
          <label htmlFor="pname">Name</label>
          <input
            id="pname"
            className="input"
            placeholder="e.g. Grandma’s Christmas"
            value={p.name}
            maxLength={60}
            onChange={(e) => set({ name: e.target.value })}
          />
        </section>

        <section className="field">
          <div className="field-head">
            <h3>Colors</h3>
            <span className="hint">Tap a color to change it</span>
          </div>
          <ol className="blocks">
            {p.blocks.map((b, i) => (
              <li key={i} className="block-row">
                <button className="block-color" onClick={() => setPicking(i)} aria-label={`Change color ${i + 1}`}>
                  <span className={`swatch-dot ${b.color === '#000000' ? 'swatch-off' : ''}`} style={{ '--c': b.color } as React.CSSProperties} />
                  <span className="block-name">{colorName(b.color)}</span>
                </button>
                <div className="stepper" aria-label="Number of lights">
                  <button onClick={() => setBlock(i, { count: Math.max(1, b.count - 1) })} aria-label="Fewer lights">
                    −
                  </button>
                  <span>
                    {b.count}
                    <small>{b.count === 1 ? 'light' : 'lights'}</small>
                  </span>
                  <button onClick={() => setBlock(i, { count: Math.min(100, b.count + 1) })} aria-label="More lights">
                    +
                  </button>
                </div>
                <div className="block-tools">
                  <button onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">
                    ↑
                  </button>
                  <button onClick={() => move(i, 1)} disabled={i === p.blocks.length - 1} aria-label="Move down">
                    ↓
                  </button>
                  <button onClick={() => remove(i)} disabled={p.blocks.length === 1} aria-label="Remove color">
                    🗑
                  </button>
                </div>
              </li>
            ))}
          </ol>
          {p.blocks.length < 64 && (
            <button className="btn btn-ghost wide" onClick={add}>
              + Add a color
            </button>
          )}
        </section>

        <section className="field">
          <h3>Motion</h3>
          <div className="anim-grid">
            {ORDER.map((a) => (
              <button key={a} className={`anim ${p.animation === a ? 'selected' : ''}`} onClick={() => set({ animation: a })}>
                <span className="anim-icon">{ANIMATION_INFO[a].icon}</span>
                <span className="anim-label">{ANIMATION_INFO[a].label}</span>
                <span className="anim-blurb">{ANIMATION_INFO[a].blurb}</span>
              </button>
            ))}
          </div>
        </section>

        {moving && (
          <section className="field">
            <label className="slider">
              <span>
                Speed <em>{p.speed <= 3 ? 'Slow' : p.speed >= 8 ? 'Fast' : 'Medium'}</em>
              </span>
              <input type="range" min={1} max={10} value={p.speed} onChange={(e) => set({ speed: Number(e.target.value) })} />
            </label>
            {directional && (
              <div className="segmented">
                <button className={p.direction === 'forward' ? 'selected' : ''} onClick={() => set({ direction: 'forward' })}>
                  → Forward
                </button>
                <button className={p.direction === 'reverse' ? 'selected' : ''} onClick={() => set({ direction: 'reverse' })}>
                  ← Reverse
                </button>
              </div>
            )}
          </section>
        )}

        <section className="field">
          <label className="slider">
            <span>
              Brightness <em>{p.brightness}%</em>
            </span>
            <input type="range" min={5} max={100} step={5} value={p.brightness} onChange={(e) => set({ brightness: Number(e.target.value) })} />
          </label>
          <Toggle label="Blend colors smoothly" checked={p.blend} onChange={(blend) => set({ blend })} />
        </section>

        {onDelete && (
          <section className="field">
            <button
              className="btn btn-danger wide"
              onClick={async () => {
                if (confirm(`Delete “${initial.name}”?`)) await onDelete();
              }}
            >
              Delete pattern
            </button>
          </section>
        )}
      </div>

      <footer className="editor-bottom">
        <button className="btn btn-primary wide" disabled={!!busy || !p.blocks.length} onClick={() => run('try')}>
          {busy === 'try' ? 'Sending…' : '✨ Try it on the lights'}
        </button>
      </footer>

      <ColorPicker
        open={picking !== null}
        value={picking !== null ? (p.blocks[picking]?.color ?? '#FFFFFF') : '#FFFFFF'}
        onPick={(color) => picking !== null && setBlock(picking, { color })}
        onClose={() => setPicking(null)}
      />
    </div>
  );
}
