import { useCallback, useMemo, useState } from 'react';
import type { Pattern } from '../../../shared/types.ts';
import { api } from '../api.ts';

/** All patterns (built-in and the household's own) plus favorites. */
export function useLibrary() {
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);

  const reload = useCallback(async () => {
    const r = await api.patterns();
    setPatterns(r.patterns);
    setFavorites(r.favorites);
    return r;
  }, []);

  const toggleFavorite = useCallback(async (id: string, on: boolean) => {
    setFavorites((await api.favorite(id, on)).favorites);
  }, []);

  const derived = useMemo(() => {
    const favoriteIds = new Set(favorites);
    return {
      favoriteIds,
      favoritePatterns: favorites.map((id) => patterns.find((p) => p.id === id)).filter((p): p is Pattern => !!p),
      themes: patterns.filter((p) => p.builtIn),
      mine: patterns.filter((p) => !p.builtIn),
    };
  }, [patterns, favorites]);

  return { patterns, favorites, reload, toggleFavorite, ...derived };
}
