import { useMemo, useState, type ReactNode } from 'react';
import type { Pattern } from '../../../shared/types.ts';
import { StripPreview } from '../components/StripPreview.tsx';
import { PatternCard } from '../components/PatternCard.tsx';
import { groupCategories } from '../lib/gallery.ts';
import { holidayWhenLabel } from '../lib/format.ts';

interface Props {
  patterns: Pattern[];
  favoriteIds: Set<string>;
  playingIds: Set<string>;
  onOpen: (p: Pattern) => void;
  empty?: ReactNode;
  showFilters?: boolean;
}

interface Section {
  title: string;
  list: Pattern[];
  collapsible: boolean;
}

/** Themes grouped by category: holidays coming up, any time of year, then later holidays (collapsed). */
export function Gallery({ patterns, favoriteIds, playingIds, onOpen, empty, showFilters = true }: Props) {
  const [filter, setFilter] = useState('All');
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { soon, anytime, later } = useMemo(() => groupCategories([...new Set(patterns.map((p) => p.category))]), [patterns]);

  const q = query.trim().toLowerCase();
  const matches = (p: Pattern) => !q || p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q);
  const browsing = !q && filter === 'All';

  /** 'allButFirst' keeps just the nearest holiday open. */
  const sections = (cats: string[], collapse: 'none' | 'all' | 'allButFirst'): Section[] =>
    cats
      .filter((c) => filter === 'All' || filter === c)
      .map((c, i) => ({
        title: c,
        list: patterns.filter((p) => p.category === c && matches(p)),
        collapsible: browsing && (collapse === 'all' || (collapse === 'allButFirst' && i > 0)),
      }))
      .filter((s) => s.list.length);

  const groups = [
    { label: 'Coming up', sections: sections(soon, 'allButFirst') },
    { label: 'Anytime', sections: sections(anytime, 'none') },
    { label: 'Later this year', sections: sections(later, 'all') },
  ].filter((g) => g.sections.length);

  const toggle = (title: string) =>
    setExpanded((x) => {
      const next = new Set(x);
      if (!next.delete(title)) next.add(title);
      return next;
    });

  if (!patterns.length) return <>{empty}</>;

  return (
    <div className="gallery">
      {showFilters && (
        <div className="filters">
          <input className="input search" type="search" placeholder="Search themes" value={query} onChange={(e) => setQuery(e.target.value)} />
          <div className="chips" role="tablist">
            {['All', ...anytime, ...soon, ...later].map((c) => (
              <button key={c} role="tab" aria-selected={filter === c} className={`chip ${filter === c ? 'selected' : ''}`} onClick={() => setFilter(c)}>
                {c}
              </button>
            ))}
          </div>
        </div>
      )}
      {groups.map((g) => (
        <div key={g.label} className="gallery-group">
          {showFilters && filter === 'All' && <h2 className="group-label">{g.label}</h2>}
          {g.sections.map((s) => {
            const open = !s.collapsible || expanded.has(s.title);
            const when = holidayWhenLabel(s.title);
            return (
              <section key={s.title} className="gallery-section">
                {s.collapsible ? (
                  <button className="section-toggle" aria-expanded={open} onClick={() => toggle(s.title)}>
                    <span className="section-toggle-text">
                      <strong>{s.title}</strong>
                      <small>
                        {when} · {s.list.length} themes
                      </small>
                    </span>
                    <StripPreview pattern={s.list[0]} className="strip-mini" />
                    <span className="chevron" aria-hidden>
                      {open ? '▾' : '▸'}
                    </span>
                  </button>
                ) : (
                  showFilters && (
                    <h3 className="section-title">
                      {s.title}
                      {when && <span className="section-when">{when}</span>}
                    </h3>
                  )
                )}
                {open && (
                  <div className="cards">
                    {s.list.map((p) => (
                      <PatternCard key={p.id} pattern={p} playing={playingIds.has(p.id)} favorite={favoriteIds.has(p.id)} onOpen={onOpen} />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      ))}
      {!groups.length && <p className="hint center pad">Nothing matches “{query}”.</p>}
    </div>
  );
}
