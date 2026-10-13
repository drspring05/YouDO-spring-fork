import { useState } from 'react';
import { CalendarDays, CheckCircle2, RotateCcw, Target, Users } from 'lucide-react';
import TabPill from './TabPill';
import { DEFAULT_TUNING, setLiquidTuning, useLiquidTuning, type LiquidTuning } from '../lib/liquidTuning';

/**
 * The preview and sliders under the Liquid Glass switch in Settings →
 * Appearance. The preview is the real thing — the same pill the tab bar
 * uses — so a slider can be judged by tapping right below it.
 */

interface SliderSpec {
  key: keyof LiquidTuning;
  label: string;
  min: number;
  max: number;
  step: number;
  format: (value: number) => string;
}

const px = (v: number) => `${v.toFixed(0)} px`;
const pct = (v: number) => `${Math.round(v * 100)}%`;

const GLASS_SLIDERS: SliderSpec[] = [
  { key: 'glassBend', label: 'Refraction', min: 0, max: 40, step: 1, format: px },
  { key: 'glassTint', label: 'Tint', min: 0, max: 0.5, step: 0.01, format: pct },
];

function TuningSliders({ specs }: { specs: SliderSpec[] }) {
  const tuning = useLiquidTuning();
  const changed = specs.some((spec) => tuning[spec.key] !== DEFAULT_TUNING[spec.key]);
  return (
    <div className="liquid-sliders" data-no-swipe>
      {specs.map((spec) => (
        <label key={spec.key} className="liquid-slider">
          <span className="liquid-slider-head">
            <span>{spec.label}</span>
            <span className="liquid-slider-value">{spec.format(tuning[spec.key])}</span>
          </span>
          <input
            type="range"
            min={spec.min}
            max={spec.max}
            step={spec.step}
            value={tuning[spec.key]}
            onChange={(event) => setLiquidTuning({ [spec.key]: Number(event.target.value) })}
            aria-label={spec.label}
          />
        </label>
      ))}
      <button
        type="button"
        className="liquid-reset"
        disabled={!changed}
        onClick={() => {
          const patch: Partial<LiquidTuning> = {};
          specs.forEach((spec) => { patch[spec.key] = DEFAULT_TUNING[spec.key] as never; });
          setLiquidTuning(patch);
        }}
      >
        <RotateCcw size={13} /> Reset to defaults
      </button>
    </div>
  );
}

const PREVIEW_TABS = [
  { label: 'Today', icon: CheckCircle2 },
  { label: 'Goals', icon: Target },
  { label: 'Calendar', icon: CalendarDays },
  { label: 'Hub', icon: Users },
];

export function LiquidGlassTuning() {
  const [active, setActive] = useState(0);
  return (
    <div className="liquid-tuning">
      <div className="liquid-preview" data-no-swipe aria-label="Liquid Glass preview">
        <div className="liquid-preview-backdrop" aria-hidden="true" />
        <div className="glass tab-bar liquid-preview-bar">
          <div className="tab-bar-tabs has-pill">
            <TabPill activeIndex={active} onSelect={setActive} />
            {PREVIEW_TABS.map((tab, index) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.label}
                  type="button"
                  onClick={() => setActive(index)}
                  aria-pressed={active === index}
                  className={`tab-bar-item ${active === index ? 'is-active' : ''}`}
                >
                  <Icon size={23} strokeWidth={active === index ? 2.3 : 1.9} />
                  <span className="tab-bar-label">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <p className="liquid-hint">Tap a tab, or press and slide along the bar.</p>
      <TuningSliders specs={GLASS_SLIDERS} />
    </div>
  );
}
