import { useState } from 'react';
import type { Pattern } from '../../../../shared/types.ts';
import { SOUND_EFFECTS, SOUND_EFFECT_IDS, soundEffect } from '../../../../shared/sound.ts';
import { StripPreview } from '../../components/StripPreview.tsx';
import { Toggle } from '../../components/ui.tsx';
import { ANIMATION_INFO, DIRECTIONAL, MOTIONS, editableCopy, speedLabel } from '../../lib/patterns.ts';
import { ColorBlocks } from './ColorBlocks.tsx';
import { ChoiceGrid } from './ChoiceGrid.tsx';

const MAX_COLORS = 64;
const MAX_SOUND_COLORS = 3; // WLED effects take up to three colors

interface Props {
  initial: Pattern;
  onSave: (p: Pattern) => Promise<void>;
  onTry: (p: Pattern) => Promise<void>;
  onDelete?: () => void;
  onClose: () => void;
}

export function Editor({ initial, onSave, onTry, onDelete, onClose }: Props) {
  const [p, setP] = useState<Pattern>(() => editableCopy(initial));
  const [busy, setBusy] = useState<'save' | 'try' | null>(null);
  const set = (patch: Partial<Pattern>) => setP((x) => ({ ...x, ...patch }));

  const run = async (kind: 'save' | 'try') => {
    setBusy(kind);
    try {
      const final = { ...p, name: p.name.trim() || 'My Pattern' };
      await (kind === 'save' ? onSave(final) : onTry(final));
    } finally {
      setBusy(null);
    }
  };

  const isSound = p.animation === 'sound';
  const fx = soundEffect(p.sound);
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
          {isSound ? 'Preview dances to a pretend beat. Your lights follow the real music.' : `Repeats every ${total} light${total === 1 ? '' : 's'} along your roofline`}
        </p>
      </div>

      <div className="editor-scroll">
        <section className="field">
          <label htmlFor="pname">Name</label>
          <input id="pname" className="input" placeholder="e.g. Grandma’s Christmas" value={p.name} maxLength={60} onChange={(e) => set({ name: e.target.value })} />
        </section>

        <section className="field">
          <div className="field-head">
            <h3>Colors</h3>
            <span className="hint">Tap a color to change it</span>
          </div>
          {isSound && <p className="hint">{fx.usesColors ? 'Sound effects blend your first 3 colors.' : `${fx.label} picks its own colors.`}</p>}
          <ColorBlocks blocks={p.blocks} onChange={(blocks) => set({ blocks })} showCounts={!isSound} max={isSound ? MAX_SOUND_COLORS : MAX_COLORS} />
        </section>

        <section className="field">
          <h3>Motion</h3>
          <ChoiceGrid
            options={MOTIONS.map((id) => ({ id, ...ANIMATION_INFO[id] }))}
            value={p.animation}
            onChange={(animation) => set({ animation, ...(animation === 'sound' && !p.sound && { sound: 'bounceMeter' }) })}
          />
        </section>

        {isSound && (
          <section className="field">
            <h3>Sound effect</h3>
            <ChoiceGrid options={SOUND_EFFECT_IDS.map((id) => ({ id, icon: '♪', ...SOUND_EFFECTS[id] }))} value={p.sound} onChange={(sound) => set({ sound })} />
            <p className="hint">Needs a WLED controller with a microphone, or one that receives sound from another controller.</p>
          </section>
        )}

        {p.animation !== 'static' && (
          <section className="field">
            <label className="slider">
              <span>
                Speed <em>{speedLabel(p.speed)}</em>
              </span>
              <input type="range" min={1} max={10} value={p.speed} onChange={(e) => set({ speed: Number(e.target.value) })} />
            </label>
            {DIRECTIONAL.includes(p.animation) && (
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
              Pattern brightness <em>{p.brightness === 100 ? 'Normal' : `${p.brightness}%`}</em>
            </span>
            <input type="range" min={5} max={100} step={5} value={p.brightness} onChange={(e) => set({ brightness: Number(e.target.value) })} />
          </label>
          <p className="hint">Make this pattern softer than your others. Overall brightness is set at the top of the app.</p>
          {!isSound && <Toggle label="Blend colors smoothly" checked={p.blend} onChange={(blend) => set({ blend })} />}
        </section>

        {onDelete && (
          <section className="field">
            <button className="btn btn-danger wide" onClick={onDelete}>
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
    </div>
  );
}
