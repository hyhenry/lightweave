import { useMemo, useState } from 'react';
import type { Pattern } from '../../../shared/types.ts';
import { StripPreview } from '../components/StripPreview.tsx';
import { ANIMATION_INFO } from './Editor.tsx';
import { daysUntil, nextOccurrence, sortCategories } from '../../../shared/holidays.ts';

interface Props {
  patterns: Pattern[];
  favorites: string[];
  playingIds: Set<string>;
  onOpen: (p: Pattern) => void;
  empty?: React.ReactNode;
  showFilters?: boolean;
}

const FAVORITES = '★ Favorites';
const SOON_DAYS = 60;

/** "Today", "Tomorrow", "in 12 days" or "Feb 14" for a holiday section. */
function whenLabel(category: string): string | undefined {
  const days = daysUntil(category);
  if (days === undefined) return undefined;
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days <= 45) return `in ${days} days`;
  return nextOccurrence(category)!.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function Gallery({ patterns, favorites, playingIds, onOpen, empty, showFilters = true }: Props) {
  const [filter, setFilter] = useState<string>('All');
  const [query, setQuery] = useState('');

  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Three groups: holidays in the next ~2 months, themes for any time of year,
  // then the rest of the holidays in date order (collapsed to keep the page short).
  const { soon, anytime, later } = useMemo(() => {
    const cats = [...new Set(patterns.map((p) => p.category))];
    const holidays = sortCategories(cats.filter((c) => daysUntil(c) !== undefined));
    let soon = holidays.filter((c) => daysUntil(c)! <= SOON_DAYS);
    if (!soon.length) soon = holidays.slice(0, 1);
    return {
      soon,
      anytime: cats.filter((c) => daysUntil(c) === undefined),
      later: holidays.filter((c) => !soon.includes(c)),
    };
  }, [patterns]);

  const q = query.trim().toLowerCase();
  const matches = (p: Pattern) => !q || p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q);
  const favs = favorites.map((id) => patterns.find((p) => p.id === id)).filter((p): p is Pattern => !!p && matches(p));

  type Section = { title: string; list: Pattern[]; collapsible?: boolean };
  const groups: { label?: string; sections: Section[] }[] = [];
  /** Sections for these categories; 'allButFirst' keeps just the nearest holiday expanded. */
  const build = (cats: string[], collapse: 'none' | 'all' | 'allButFirst' = 'none') =>
    cats
      .filter((c) => filter === 'All' || filter === c)
      .map((c, i) => ({
        title: c,
        list: patterns.filter((p) => p.category === c && matches(p)),
        collapsible: !q && filter === 'All' && (collapse === 'all' || (collapse === 'allButFirst' && i > 0)),
      }))
      .filter((s) => s.list.length);
  if ((filter === 'All' || filter === FAVORITES) && favs.length) groups.push({ sections: [{ title: FAVORITES, list: favs }] });
  if (filter !== FAVORITES) {
    groups.push({ label: 'Coming up', sections: build(soon, 'allButFirst') });
    groups.push({ label: 'Anytime', sections: build(anytime) });
    groups.push({ label: 'Later this year', sections: build(later, 'all') });
  }
  const showLabels = showFilters && filter === 'All';
  const visible = groups.filter((g) => g.sections.length);
  const chips = ['All', ...(favorites.length ? [FAVORITES] : []), ...anytime, ...soon, ...later];

  const toggle = (title: string) =>
    setExpanded((x) => {
      const next = new Set(x);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });

  if (!patterns.length) return <>{empty}</>;

  return (
    <div className="gallery">
      {showFilters && (
        <div className="filters">
          <input className="input search" type="search" placeholder="Search themes" value={query} onChange={(e) => setQuery(e.target.value)} />
          <div className="chips" role="tablist">
            {chips.map((c) => (
              <button key={c} role="tab" aria-selected={filter === c} className={`chip ${filter === c ? 'selected' : ''}`} onClick={() => setFilter(c)}>
                {c}
              </button>
            ))}
          </div>
        </div>
      )}
      {visible.map((g, gi) => (
        <div key={g.label ?? gi} className="gallery-group">
          {showLabels && g.label && <h2 className="group-label">{g.label}</h2>}
          {g.sections.map(({ title, list, collapsible }) => {
            const open = !collapsible || expanded.has(title);
            const when = whenLabel(title);
            return (
              <section key={title} className="gallery-section">
                {collapsible ? (
                  <button className="section-toggle" aria-expanded={open} onClick={() => toggle(title)}>
                    <span className="section-toggle-text">
                      <strong>{title}</strong>
                      <small>
                        {when} · {list.length} themes
                      </small>
                    </span>
                    <StripPreview pattern={list[0]} className="strip-mini" />
                    <span className="chevron" aria-hidden>
                      {open ? '▾' : '▸'}
                    </span>
                  </button>
                ) : (
                  showFilters && (
                    <h3 className="section-title">
                      {title}
                      {when && <span className="section-when">{when}</span>}
                    </h3>
                  )
                )}
                {open && (
                  <div className="cards">
                    {list.map((p) => (
                      <button key={p.id} className={`card ${playingIds.has(p.id) ? 'playing' : ''}`} onClick={() => onOpen(p)}>
                        <StripPreview pattern={p} />
                        <span className="card-meta">
                          <span className="card-name">{p.name}</span>
                          <span className="card-sub">
                            {playingIds.has(p.id) ? <span className="live-dot">On now</span> : ANIMATION_INFO[p.animation].label}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      ))}
      {!visible.length && <p className="hint center pad">Nothing matches “{query}”.</p>}
    </div>
  );
}
