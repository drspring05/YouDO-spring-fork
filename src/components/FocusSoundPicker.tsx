import { useEffect, useState } from 'react';
import { Volume1, Volume2 } from 'lucide-react';
import Toggle from './Toggle';
import {
  FOCUS_SOUNDS,
  FOCUS_SOUNDS_EVENT,
  focusSoundPlayer,
  readFocusSoundPrefs,
  saveFocusSoundPrefs,
  type FocusSoundId,
  type FocusSoundPrefs,
} from '../lib/focusSounds';
import './focusSounds.css';

interface Props {
  /** ambient: the dark panel on the ambient screen. settings: the Focus page card, which also previews. */
  variant: 'ambient' | 'settings';
}

/** Pick the focus sound, its volume, and whether it keeps playing when you leave the app. */
export default function FocusSoundPicker({ variant }: Props) {
  const [prefs, setPrefs] = useState(readFocusSoundPrefs);

  useEffect(() => {
    const onChange = () => setPrefs(readFocusSoundPrefs());
    window.addEventListener(FOCUS_SOUNDS_EVENT, onChange);
    return () => window.removeEventListener(FOCUS_SOUNDS_EVENT, onChange);
  }, []);
  // Leaving the picker ends a preview.
  useEffect(() => () => focusSoundPlayer.endPreview(), []);

  const update = (patch: Partial<FocusSoundPrefs>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    saveFocusSoundPrefs(next);
  };

  const choose = (sound: FocusSoundId | null) => {
    update({ sound });
    if (variant !== 'settings') return;
    // Outside a session, hear a few seconds of the new pick.
    if (sound && focusSoundPlayer.canPreview) focusSoundPlayer.preview(sound);
    else if (!sound) focusSoundPlayer.endPreview();
  };

  const options: { id: FocusSoundId | null; label: string }[] = [{ id: null, label: 'Off' }, ...FOCUS_SOUNDS];

  return (
    <div className={`fs-picker is-${variant}`}>
      {variant === 'ambient' && <p className="fs-picker-title">Focus sound</p>}
      <div className="fs-picker-pills" role="radiogroup" aria-label="Focus sound">
        {options.map((option) => (
          <button
            key={option.id ?? 'off'}
            type="button"
            role="radio"
            aria-checked={prefs.sound === option.id}
            className={`fs-picker-pill ${prefs.sound === option.id ? 'is-on' : ''}`}
            onClick={() => choose(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>
      <label className="fs-picker-volume">
        <Volume1 size={16} aria-hidden />
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={Math.round(prefs.volume * 100)}
          onChange={(event) => update({ volume: Number(event.target.value) / 100 })}
          aria-label="Focus sound volume"
        />
        <Volume2 size={16} aria-hidden />
      </label>
      <div className="fs-picker-keep">
        <div className="min-w-0">
          <p className="fs-picker-keep-label">Keep playing when I leave the app</p>
          <p className="fs-picker-keep-hint">Sound carries on with the screen off</p>
        </div>
        <Toggle
          checked={prefs.keepPlaying}
          onChange={() => update({ keepPlaying: !prefs.keepPlaying })}
          label="Keep playing the focus sound when I leave the app"
        />
      </div>
    </div>
  );
}
