import type { Pattern } from '../../../shared/types.ts';
import type { DeviceWithStatus } from '../api.ts';
import { ANIMATION_INFO } from '../lib/patterns.ts';
import { Sheet } from './ui.tsx';
import { StripPreview } from './StripPreview.tsx';

interface Props {
  pattern: Pattern | null;
  devices: DeviceWithStatus[];
  targets: string[];
  favorite: boolean;
  onToggleTarget: (deviceId: string) => void;
  onShow: (p: Pattern) => Promise<void>;
  onEdit: (p: Pattern) => void;
  onFavorite: (p: Pattern, on: boolean) => void;
  onDelete: (p: Pattern) => void;
  onClose: () => void;
}

/** Tapping a theme or pattern: big preview, pick lights, show it, customize or favorite. */
export function PatternSheet({ pattern: p, devices, targets, favorite, onToggleTarget, onShow, onEdit, onFavorite, onDelete, onClose }: Props) {
  return (
    <Sheet open={!!p} onClose={onClose} title={p?.name}>
      {p && (
        <div className="detail">
          <StripPreview pattern={p} rows={2} dot={11} className="strip-big" />
          <p className="hint center">
            {p.category} · {ANIMATION_INFO[p.animation].label}
          </p>
          {devices.length > 1 && (
            <div className="targets">
              <span className="hint">Show on</span>
              <div className="chips wrap">
                {devices.map((d) => (
                  <button key={d.id} className={`chip ${targets.includes(d.id) ? 'selected' : ''}`} onClick={() => onToggleTarget(d.id)}>
                    {targets.includes(d.id) ? '✓ ' : ''}
                    {d.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          <button className="btn btn-primary wide big" onClick={() => onShow(p)}>
            ✨ Show on the lights
          </button>
          <div className="row-btns">
            <button className="btn btn-ghost" onClick={() => onEdit(p)}>
              {p.builtIn ? '🎨 Customize' : '✏️ Edit'}
            </button>
            <button className="btn btn-ghost" onClick={() => onFavorite(p, !favorite)}>
              {favorite ? '★ Favorited' : '☆ Favorite'}
            </button>
          </div>
          {!p.builtIn && (
            <button className="btn btn-danger wide" onClick={() => onDelete(p)}>
              🗑 Delete pattern
            </button>
          )}
        </div>
      )}
    </Sheet>
  );
}
