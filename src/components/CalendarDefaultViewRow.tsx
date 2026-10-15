import { CalendarDays } from 'lucide-react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import Toggle from './Toggle';
import {
  CALENDAR_DEFAULT_VIEW_KEY,
  CALENDAR_GOAL_ITEMS_KEY,
  CALENDAR_PLANNED_TASKS_KEY,
  CALENDAR_PREFS_CHANGED_EVENT,
  CALENDAR_VIEW_OPTIONS,
  normalizeCalendarView,
  type CalendarViewMode,
} from '../lib/calendarPrefs';
import { supportsDeviceCalendar } from '../lib/nativeCalendar';

interface SwitchProps {
  storageKey: string;
  title: string;
  hint: string;
}

/** A calendar on/off choice, on unless switched off. Tells the app straight away so it can apply it. */
function CalendarSwitch({ storageKey, title, hint }: SwitchProps) {
  const [stored, setStored] = useLocalStorage<boolean>(storageKey, true);
  const on = stored !== false;
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0 flex-1">
        <h4 className="text-xs font-semibold text-content-primary">{title}</h4>
        <p className="text-[10.5px] text-content-secondary font-medium">{hint}</p>
      </div>
      <Toggle
        checked={on}
        label={title}
        onChange={() => {
          setStored(!on);
          window.setTimeout(() => window.dispatchEvent(new Event(CALENDAR_PREFS_CHANGED_EVENT)), 0);
        }}
      />
    </div>
  );
}

/** Settings → Preferences row: the Calendar tab's default view, and what goes onto the phone calendar. */
export default function CalendarDefaultViewRow() {
  const [stored, setStored] = useLocalStorage<CalendarViewMode>(CALENDAR_DEFAULT_VIEW_KEY, 'month');
  const current = normalizeCalendarView(stored);
  const phoneCalendar = supportsDeviceCalendar();

  return (
    <div className="settings-data-row p-4 space-y-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-xl bg-primary-soft flex items-center justify-center text-primary shrink-0">
          <CalendarDays size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-xs font-semibold text-content-primary">Calendar Default View</h3>
          <p className="text-[10.5px] text-content-secondary font-medium">What the Calendar tab shows when you open it</p>
        </div>
      </div>
      <div role="radiogroup" aria-label="Calendar default view" className="flex p-0.5 rounded-xl bg-surface border border-subtle">
        {CALENDAR_VIEW_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={current === option.id}
            onClick={() => setStored(option.id)}
            className={`flex-1 h-9 rounded-[10px] text-[12px] font-semibold transition-colors ${
              current === option.id ? 'bg-primary text-on-primary' : 'text-content-secondary'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
      {phoneCalendar && (
        <div className="space-y-3 pt-1">
          <CalendarSwitch
            storageKey={CALENDAR_PLANNED_TASKS_KEY}
            title="Planned tasks on my calendar"
            hint="Tasks you plan to a date from Goals get an all-day event"
          />
          <CalendarSwitch
            storageKey={CALENDAR_GOAL_ITEMS_KEY}
            title="Dated goal items on my calendar"
            hint="Open goal items with a start or end date show as all-day events. Turning this off removes them"
          />
        </div>
      )}
    </div>
  );
}
