import type { Pattern } from '../../../shared/types.ts';
import { PatternCard } from '../components/PatternCard.tsx';

interface Props {
  patterns: Pattern[]; // in favorite order
  playingIds: Set<string>;
  onOpen: (p: Pattern) => void;
  onBrowse: () => void;
}

/** Favorited themes and the household's own patterns, together. */
export function Favorites({ patterns, playingIds, onOpen, onBrowse }: Props) {
  if (!patterns.length) {
    return (
      <div className="empty">
        <div className="empty-art">⭐</div>
        <h2>Your go-to looks</h2>
        <p>Open any theme or one of your own patterns and tap “☆ Favorite”. They’ll all be here together, one tap away.</p>
        <button className="btn btn-primary" onClick={onBrowse}>
          Browse themes
        </button>
      </div>
    );
  }
  return (
    <div className="cards favorites">
      {patterns.map((p) => (
        <PatternCard key={p.id} pattern={p} playing={playingIds.has(p.id)} sub={p.builtIn ? p.category : 'My pattern'} onOpen={onOpen} />
      ))}
    </div>
  );
}
