import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { APP_ICONS, APP_ICON_MARK, DEFAULT_APP_ICON, getAppIcon, setAppIcon, supportsNativeAppIcon, type AppIconVariant } from '../lib/appIcon';
import { hapticTick } from '../lib/haptics';

export function AppIconTile({ icon, size = 52 }: { icon: AppIconVariant; size?: number }) {
  const scale = (size * 0.5) / 16;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" className="block">
      <rect width={size} height={size} rx={size * 0.225} fill={icon.background} />
      <g
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={APP_ICON_MARK.stroke}
        transform={`translate(${size / 2} ${size / 2}) scale(${scale}) translate(-12 -12)`}
      >
        <path d={APP_ICON_MARK.y} stroke={icon.y} />
        <path d={APP_ICON_MARK.tick} stroke={icon.tick} />
      </g>
    </svg>
  );
}

/** Settings → Appearance → App icon. Accent colours never change the home-screen icon. */
export default function AppIconPicker() {
  const [selected, setSelected] = useState(DEFAULT_APP_ICON);
  const [error, setError] = useState('');
  const native = supportsNativeAppIcon();

  useEffect(() => {
    let cancelled = false;
    void getAppIcon().then((id) => { if (!cancelled) setSelected(id); });
    return () => { cancelled = true; };
  }, []);

  const choose = async (id: string) => {
    if (id === selected) return;
    hapticTick();
    const previous = selected;
    setSelected(id);
    setError('');
    try {
      await setAppIcon(id);
    } catch {
      setSelected(previous);
      setError('Could not change the icon. Try again.');
    }
  };

  return (
    <div>
      <div role="radiogroup" aria-label="App icon" className="app-icon-picker">
        {APP_ICONS.map((icon) => {
          const isSelected = icon.id === selected;
          return (
            <button
              key={icon.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={`${icon.label} icon`}
              className="app-icon-option"
              data-no-bounce
              onClick={() => void choose(icon.id)}
            >
              <span className="app-icon-option-tile">
                <AppIconTile icon={icon} />
                {isSelected && (
                  <span className="app-icon-option-badge" aria-hidden="true">
                    <Check size={12} strokeWidth={3.2} />
                  </span>
                )}
              </span>
              <span className="app-icon-option-label">{icon.label}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[10.5px] leading-relaxed text-content-muted">
        {error ||
          (native
            ? 'Your home-screen icon changes after you leave the app. On some phones you may need to add it to the home screen again.'
            : 'Changes the browser tab icon, and the icon the web app gets when you install it.')}
      </p>
    </div>
  );
}
