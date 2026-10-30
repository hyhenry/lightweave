import { useState, type CSSProperties } from 'react';
import type { ColorBlock } from '../../../../shared/types.ts';
import { ColorPicker, colorName } from '../../components/ColorPicker.tsx';

interface Props {
  blocks: ColorBlock[];
  onChange: (blocks: ColorBlock[]) => void;
  showCounts: boolean; // sound effects use colors but not counts
  max: number;
}

/** The list of colors: tap to recolor, +/− how many lights, reorder, remove, add. */
export function ColorBlocks({ blocks, onChange, showCounts, max }: Props) {
  const [picking, setPicking] = useState<number | null>(null);

  const update = (i: number, patch: Partial<ColorBlock>) => onChange(blocks.map((b, j) => (j === i ? { ...b, ...patch } : b)));
  const move = (i: number, d: -1 | 1) => {
    const next = [...blocks];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange(next);
  };
  const add = () => onChange([...blocks, { color: '#00C020', count: blocks.at(-1)?.count ?? 3 }]);

  return (
    <>
      <ol className="blocks">
        {blocks.map((b, i) => (
          <li key={i} className="block-row">
            <button className="block-color" onClick={() => setPicking(i)} aria-label={`Change color ${i + 1}`}>
              <span className={`swatch-dot ${b.color === '#000000' ? 'swatch-off' : ''}`} style={{ '--c': b.color } as CSSProperties} />
              <span className="block-name">{colorName(b.color)}</span>
            </button>
            {showCounts && (
              <div className="stepper" aria-label="Number of lights">
                <button onClick={() => update(i, { count: Math.max(1, b.count - 1) })} aria-label="Fewer lights">
                  −
                </button>
                <span>
                  {b.count}
                  <small>{b.count === 1 ? 'light' : 'lights'}</small>
                </span>
                <button onClick={() => update(i, { count: Math.min(100, b.count + 1) })} aria-label="More lights">
                  +
                </button>
              </div>
            )}
            <div className="block-tools">
              <button onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">
                ↑
              </button>
              <button onClick={() => move(i, 1)} disabled={i === blocks.length - 1} aria-label="Move down">
                ↓
              </button>
              <button onClick={() => onChange(blocks.filter((_, j) => j !== i))} disabled={blocks.length === 1} aria-label="Remove color">
                🗑
              </button>
            </div>
          </li>
        ))}
      </ol>
      {blocks.length < max && (
        <button className="btn btn-ghost wide" onClick={add}>
          + Add a color
        </button>
      )}
      <ColorPicker
        open={picking !== null}
        value={picking !== null ? (blocks[picking]?.color ?? '#FFFFFF') : '#FFFFFF'}
        onPick={(color) => picking !== null && update(picking, { color })}
        onClose={() => setPicking(null)}
      />
    </>
  );
}
