import type { Pattern } from '../../../shared/types.ts';
import { Gallery } from './Gallery.tsx';

interface Props {
  patterns: Pattern[];
  favoriteIds: Set<string>;
  playingIds: Set<string>;
  onOpen: (p: Pattern) => void;
  onCreate: () => void;
}

export function MyPatterns({ patterns, favoriteIds, playingIds, onOpen, onCreate }: Props) {
  return (
    <>
      <button className="btn btn-primary wide create-btn" onClick={onCreate}>
        + Create a pattern
      </button>
      <Gallery
        patterns={patterns}
        favoriteIds={favoriteIds}
        playingIds={playingIds}
        onOpen={onOpen}
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
  );
}
