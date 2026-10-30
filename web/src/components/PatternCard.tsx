import type { Pattern } from '../../../shared/types.ts';
import { motionLabel } from '../lib/patterns.ts';
import { StripPreview } from './StripPreview.tsx';

interface Props {
  pattern: Pattern;
  playing: boolean;
  favorite?: boolean;
  sub?: string; // replaces the motion label, e.g. the category in Favorites
  onOpen: (p: Pattern) => void;
}

export function PatternCard({ pattern: p, playing, favorite, sub, onOpen }: Props) {
  return (
    <button className={`card ${playing ? 'playing' : ''}`} onClick={() => onOpen(p)}>
      <StripPreview pattern={p} />
      <span className="card-meta">
        <span className="card-name">
          {favorite && (
            <span className="fav-star" aria-label="Favorite">
              ★{' '}
            </span>
          )}
          {p.name}
        </span>
        <span className="card-sub">{playing ? <span className="live-dot">On now</span> : (sub ?? motionLabel(p))}</span>
      </span>
    </button>
  );
}
