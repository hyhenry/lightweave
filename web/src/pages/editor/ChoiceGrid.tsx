/** A grid of big tappable choices (motions, sound effects). */
export function ChoiceGrid<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; icon: string; label: string; blurb: string }[];
  value: T | undefined;
  onChange: (id: T) => void;
}) {
  return (
    <div className="anim-grid">
      {options.map((o) => (
        <button key={o.id} className={`anim ${value === o.id ? 'selected' : ''}`} onClick={() => onChange(o.id)}>
          <span className="anim-icon">{o.icon}</span>
          <span className="anim-label">{o.label}</span>
          <span className="anim-blurb">{o.blurb}</span>
        </button>
      ))}
    </div>
  );
}
