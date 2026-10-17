import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { ChevronDown } from 'lucide-react';
import {
  hexToHsv,
  hsvToHex,
  normalizeHex,
  readPalettes,
  withPaletteColor,
  writePalettes,
  type Hsv,
} from '../lib/eventColors';

interface Props {
  /** The chosen color as "#RRGGBB", or null for the calendar's own color. */
  value: string | null;
  onChange: (color: string | null) => void;
  label?: string;
}

const WHEEL = 164;

/**
 * A small "Color" row that opens into a color wheel, a brightness bar and two palettes of saved colors.
 * It stays one quiet line until it is tapped. Android keeps the color on the phone; Google's servers only
 * sync their own fixed colors, so other devices may show a different one.
 */
export default function EventColorPicker({ value, onChange, label = 'Color' }: Props) {
  const [open, setOpen] = useState(false);
  const [hsv, setHsv] = useState<Hsv>(() => (value ? hexToHsv(value) : { h: 210, s: 0.6, v: 1 }));
  const [palettes, setPalettes] = useState(readPalettes);
  const [saving, setSaving] = useState<number | null>(null);
  const wheelRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<'wheel' | 'bar' | null>(null);

  // Follow a color chosen somewhere else (a palette tap, a reset) without losing the hue while dragging.
  useEffect(() => {
    const clean = normalizeHex(value);
    if (clean && clean !== hsvToHex(hsv)) setHsv(hexToHsv(clean));
    // Only react to the incoming value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const apply = (next: Hsv) => {
    setHsv(next);
    onChange(hsvToHex(next));
  };

  const pickWheel = (clientX: number, clientY: number) => {
    const el = wheelRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const dx = clientX - (rect.left + rect.width / 2);
    const dy = clientY - (rect.top + rect.height / 2);
    const s = Math.min(Math.hypot(dx, dy) / (rect.width / 2), 1);
    const h = ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360;
    apply({ h, s, v: hsv.v });
  };

  const pickBar = (clientX: number) => {
    const el = barRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const v = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    apply({ ...hsv, v });
  };

  const start = (kind: 'wheel' | 'bar') => (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragging.current = kind;
    if (kind === 'wheel') pickWheel(event.clientX, event.clientY);
    else pickBar(event.clientX);
  };
  const move = (kind: 'wheel' | 'bar') => (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragging.current !== kind) return;
    if (kind === 'wheel') pickWheel(event.clientX, event.clientY);
    else pickBar(event.clientX);
  };
  const stop = () => {
    dragging.current = null;
  };

  const current = hsvToHex(hsv);
  const shown = normalizeHex(value);
  const tapSlot = (palette: number, slot: number) => {
    if (saving === palette) {
      const next = withPaletteColor(palettes, palette, slot, shown ?? current);
      setPalettes(next);
      writePalettes(next);
      return;
    }
    const color = palettes[palette]?.[slot];
    if (color) {
      setHsv(hexToHsv(color));
      onChange(color);
    }
  };

  const markerRadius = hsv.s * 50;
  const markerAngle = (hsv.h * Math.PI) / 180;

  return (
    <div className="bg-surface border border-subtle rounded-2xl shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 px-3.5 h-11 text-left"
      >
        <span className="text-[10px] font-bold uppercase tracking-wider text-content-muted">{label}</span>
        <span className="flex items-center gap-2">
          <span
            className="h-5 w-5 rounded-full border border-subtle"
            style={shown ? { backgroundColor: shown } : undefined}
            aria-hidden
          />
          <span className="text-[12px] font-semibold text-content-secondary">{shown ? shown : 'Default'}</span>
          <ChevronDown size={15} className={`text-content-muted transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>

      {open && (
        <div className="px-3.5 pb-3.5 pt-1 flex flex-col items-center gap-3 border-t border-subtle">
          <div
            ref={wheelRef}
            role="slider"
            aria-label="Color wheel"
            aria-valuetext={current}
            tabIndex={0}
            onPointerDown={start('wheel')}
            onPointerMove={move('wheel')}
            onPointerUp={stop}
            onPointerCancel={stop}
            className="relative rounded-full mt-2 select-none"
            style={{
              width: WHEEL,
              height: WHEEL,
              touchAction: 'none',
              background:
                'radial-gradient(circle closest-side, #fff, rgba(255,255,255,0)), conic-gradient(#f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)',
              opacity: 0.35 + hsv.v * 0.65,
            }}
          >
            <span
              className="absolute h-4 w-4 rounded-full border-2 border-white shadow"
              style={{
                left: `${50 + markerRadius * Math.sin(markerAngle)}%`,
                top: `${50 - markerRadius * Math.cos(markerAngle)}%`,
                transform: 'translate(-50%, -50%)',
                backgroundColor: current,
              }}
            />
          </div>

          <div
            ref={barRef}
            role="slider"
            aria-label="Brightness"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(hsv.v * 100)}
            tabIndex={0}
            onPointerDown={start('bar')}
            onPointerMove={move('bar')}
            onPointerUp={stop}
            onPointerCancel={stop}
            className="relative h-5 rounded-full select-none"
            style={{
              width: WHEEL,
              touchAction: 'none',
              background: `linear-gradient(to right, #000, ${hsvToHex({ ...hsv, v: 1 })})`,
            }}
          >
            <span
              className="absolute top-1/2 h-5 w-5 rounded-full border-2 border-white shadow"
              style={{ left: `${hsv.v * 100}%`, transform: 'translate(-50%, -50%)', backgroundColor: current }}
            />
          </div>

          <div className="w-full flex flex-col gap-2">
            {palettes.map((row, p) => (
              <div key={p} className="flex items-center gap-1.5">
                {row.map((color, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => tapSlot(p, i)}
                    aria-label={
                      saving === p
                        ? `Save the current color in slot ${i + 1} of palette ${p + 1}`
                        : color
                          ? `Use ${color}`
                          : `Empty slot ${i + 1} of palette ${p + 1}`
                    }
                    className={`h-7 w-7 rounded-full border flex items-center justify-center text-[13px] font-bold text-content-muted ${
                      saving === p ? 'border-primary border-dashed' : 'border-subtle'
                    }`}
                    style={color ? { backgroundColor: color } : undefined}
                  >
                    {!color && saving === p ? '+' : ''}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setSaving(saving === p ? null : p)}
                  className="ml-auto text-[11px] font-bold text-primary"
                >
                  {saving === p ? 'Done' : 'Save'}
                </button>
              </div>
            ))}
          </div>

          {shown && (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="self-start text-[11px] font-bold text-content-secondary"
            >
              Use the calendar&rsquo;s own color
            </button>
          )}
        </div>
      )}
    </div>
  );
}
