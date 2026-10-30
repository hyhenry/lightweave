import { Sheet } from './ui.tsx';

export const SWATCHES: { name: string; hex: string }[] = [
  { name: 'Red', hex: '#FF0000' },
  { name: 'Crimson', hex: '#B00010' },
  { name: 'Orange', hex: '#FF5A00' },
  { name: 'Amber', hex: '#FF8C00' },
  { name: 'Gold', hex: '#FFB000' },
  { name: 'Yellow', hex: '#FFE45A' },
  { name: 'Lime', hex: '#7CFF00' },
  { name: 'Green', hex: '#00C020' },
  { name: 'Forest', hex: '#007A1E' },
  { name: 'Mint', hex: '#7CFFB0' },
  { name: 'Teal', hex: '#00D0B0' },
  { name: 'Sky', hex: '#5AC8FF' },
  { name: 'Blue', hex: '#0030FF' },
  { name: 'Royal', hex: '#1A3CFF' },
  { name: 'Purple', hex: '#7A00FF' },
  { name: 'Violet', hex: '#B000FF' },
  { name: 'Lavender', hex: '#B48CFF' },
  { name: 'Magenta', hex: '#FF0090' },
  { name: 'Pink', hex: '#FF2A7A' },
  { name: 'Blush', hex: '#FF7AA8' },
  { name: 'White', hex: '#FFFFFF' },
  { name: 'Warm White', hex: '#FFB45A' },
  { name: 'Soft White', hex: '#FFC98A' },
  { name: 'Cool White', hex: '#D8E8FF' },
  { name: 'Off', hex: '#000000' },
];

export function colorName(hex: string) {
  return SWATCHES.find((s) => s.hex.toLowerCase() === hex.toLowerCase())?.name ?? hex.toUpperCase();
}

export function ColorPicker({
  open,
  value,
  onPick,
  onClose,
}: {
  open: boolean;
  value: string;
  onPick: (hex: string) => void;
  onClose: () => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} title="Pick a color">
      <div className="swatch-grid">
        {SWATCHES.map((s) => (
          <button
            key={s.hex}
            className={`swatch ${s.hex.toLowerCase() === value.toLowerCase() ? 'selected' : ''} ${s.hex === '#000000' ? 'swatch-off' : ''}`}
            style={{ '--c': s.hex } as React.CSSProperties}
            onClick={() => {
              onPick(s.hex);
              onClose();
            }}
          >
            <span className="swatch-dot" />
            <span className="swatch-name">{s.name}</span>
          </button>
        ))}
      </div>
      <label className="custom-color">
        <input type="color" value={value} onChange={(e) => onPick(e.target.value.toUpperCase())} />
        <span>
          <strong>Custom color…</strong>
          <small>Any shade you like</small>
        </span>
      </label>
      <p className="hint">“Off” leaves a dark gap between colors.</p>
    </Sheet>
  );
}
