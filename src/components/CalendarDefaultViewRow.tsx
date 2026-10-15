import { CalendarDays } from 'lucide-react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import {
  CALENDAR_DEFAULT_VIEW_KEY,
  CALENDAR_VIEW_OPTIONS,
  normalizeCalendarView,
  type CalendarViewMode,
} from '../lib/calendarPrefs';

/** Settings → Preferences row: which view the Calendar tab opens in. */
export default function CalendarDefaultViewRow() {
  const [stored, setStored] = useLocalStorage<CalendarViewMode>(CALENDAR_DEFAULT_VIEW_KEY, 'month');
  const current = normalizeCalendarView(stored);

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
    </div>
  );
}
