import { CalendarDays } from 'lucide-react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { CALENDAR_DIAL_CHANGED_EVENT, CALENDAR_HIDE_DIAL_KEY } from '../lib/calendarPrefs';
import Toggle from './Toggle';

/** Settings → Preferences row: hide the date dial that sits above the Calendar tab's views. The dial shows unless this is on. */
export default function CalendarDialRow() {
  const [hidden, setHidden] = useLocalStorage<boolean>(CALENDAR_HIDE_DIAL_KEY, false);
  const isHidden = hidden === true;
  const change = () => {
    setHidden(!isHidden);
    // useLocalStorage saves in an effect, so tell an open Calendar tab after the new value is written.
    window.setTimeout(() => window.dispatchEvent(new Event(CALENDAR_DIAL_CHANGED_EVENT)), 0);
  };
  return (
    <div className="settings-data-row p-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="w-9 h-9 rounded-xl bg-primary-soft flex items-center justify-center text-primary shrink-0">
          <CalendarDays size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-xs font-semibold text-content-primary">Hide calendar date dial</h3>
          <p className="text-[10.5px] text-content-secondary font-medium">
            {isHidden
              ? 'The Calendar tab starts straight at its Month, Week, Agenda and Year switch.'
              : 'Off: the swipeable day dial shows above the Calendar tab.'}
          </p>
        </div>
      </div>
      <Toggle checked={isHidden} onChange={change} label="Hide calendar date dial" />
    </div>
  );
}
