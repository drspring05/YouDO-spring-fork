import { useEffect, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import Toggle from './Toggle';
import { DATE_FORMAT_OPTIONS, useDateFormat, writeDateFormat } from '../lib/dateFormat';
import {
  CALENDAR_DEFAULT_VIEW_KEY,
  CALENDAR_GOAL_ITEMS_KEY,
  CALENDAR_PREFS_CHANGED_EVENT,
  CALENDAR_VIEW_OPTIONS,
  normalizeCalendarView,
  readHiddenCalendarIds,
  writeHiddenCalendarIds,
  type CalendarViewMode,
} from '../lib/calendarPrefs';
import {
  getDeviceCalendarPermission,
  listDeviceCalendars,
  supportsDeviceCalendar,
  type DeviceCalendar,
} from '../lib/nativeCalendar';
import { chooseTaskCalendar, readTaskCalendarId, writableCalendars, writeTaskCalendarId } from '../lib/taskSchedule';

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

/** The phone's calendars, once calendar access is granted. Empty until then (and when there is no access). */
function usePhoneCalendars(): DeviceCalendar[] {
  const [calendars, setCalendars] = useState<DeviceCalendar[]>([]);
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        if ((await getDeviceCalendarPermission()) !== 'granted') return;
        const list = await listDeviceCalendars();
        if (live) setCalendars(list);
      } catch {
        /* no list to show; the app keeps working with its defaults */
      }
    })();
    return () => {
      live = false;
    };
  }, []);
  return calendars;
}

const calendarLabel = (calendar: DeviceCalendar) =>
  calendar.accountName && calendar.accountName !== calendar.name ? `${calendar.name} (${calendar.accountName})` : calendar.name;

/** Which phone calendar YouDo's own events (planned tasks, dated goal items, new events) are written to. */
function CalendarTargetPicker({ calendars }: { calendars: DeviceCalendar[] }) {
  const writable = writableCalendars(calendars);
  const [chosen, setChosen] = useState<string>(() => readTaskCalendarId() ?? '');
  const current = chooseTaskCalendar(writable, chosen || null)?.id ?? '';

  // Nothing to choose between.
  if (writable.length < 2) return null;

  return (
    <div className="space-y-2 pt-1">
      <div>
        <label htmlFor="youdo-event-calendar" className="text-xs font-semibold text-content-primary block">
          Calendar for YouDo events
        </label>
        <p className="text-[10.5px] text-content-secondary font-medium">
          Planned tasks, dated goal items and new events are added here. Events already on your calendar stay where they are.
          To move goal items, switch &ldquo;Dated goal items on my calendar&rdquo; off and on again
        </p>
      </div>
      <select
        id="youdo-event-calendar"
        value={current}
        onChange={(e) => {
          setChosen(e.target.value);
          writeTaskCalendarId(e.target.value);
          window.dispatchEvent(new Event(CALENDAR_PREFS_CHANGED_EVENT));
        }}
        className="w-full h-10 px-3 bg-surface border border-subtle rounded-xl text-[13px] font-medium text-content-primary outline-none focus:border-primary transition-colors"
      >
        {[...writable]
          .sort((a, b) => a.accountName.localeCompare(b.accountName) || a.name.localeCompare(b.name))
          .map((calendar) => (
            <option key={calendar.id} value={calendar.id}>
              {calendarLabel(calendar)}
            </option>
          ))}
      </select>
    </div>
  );
}

/** One switch per phone calendar (grouped by account): which ones the Calendar tab shows. */
function CalendarShownList({ calendars }: { calendars: DeviceCalendar[] }) {
  const [hidden, setHidden] = useState<string[]>(() => readHiddenCalendarIds());

  if (calendars.length === 0) return null;

  const sorted = [...calendars].sort(
    (a, b) => a.accountName.localeCompare(b.accountName) || a.name.localeCompare(b.name),
  );

  return (
    <div className="space-y-3 pt-1">
      <div>
        <h4 className="text-xs font-semibold text-content-primary">Calendars shown in the Calendar tab</h4>
        <p className="text-[10.5px] text-content-secondary font-medium">
          Turn a calendar off to hide its events here. Your phone's Calendar app is not changed
        </p>
      </div>
      {sorted.map((calendar) => {
        const on = !hidden.includes(calendar.id);
        return (
          <div key={calendar.id} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: /^#[0-9a-f]{6}$/i.test(calendar.color) ? calendar.color : '#8B8B8B' }}
                aria-hidden
              />
              <div className="min-w-0">
                <h5 className="text-xs font-semibold text-content-primary truncate">{calendar.name}</h5>
                <p className="text-[10.5px] text-content-secondary font-medium truncate">
                  {calendar.accountName}
                  {calendar.visible ? '' : ' · off in your phone’s Calendar app'}
                </p>
              </div>
            </div>
            <Toggle
              checked={on}
              label={`Show ${calendar.name} (${calendar.accountName})`}
              onChange={() => {
                const next = on ? [...hidden, calendar.id] : hidden.filter((id) => id !== calendar.id);
                setHidden(next);
                writeHiddenCalendarIds(next);
              }}
            />
          </div>
        );
      })}
    </div>
  );
}

/** Settings → Preferences row: the Calendar tab's default view, and what goes onto the phone calendar. */
export default function CalendarDefaultViewRow() {
  const [stored, setStored] = useLocalStorage<CalendarViewMode>(CALENDAR_DEFAULT_VIEW_KEY, 'month');
  const current = normalizeCalendarView(stored);
  const phoneCalendar = supportsDeviceCalendar();
  const calendars = usePhoneCalendars();
  const dateFormat = useDateFormat();

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
      <div className="space-y-2 pt-1">
        <div>
          <h4 className="text-xs font-semibold text-content-primary">Date format</h4>
          <p className="text-[10.5px] text-content-secondary font-medium">How dates are written in the calendar, goal dates and date boxes. The phone's own date picker pop-up keeps your phone's language</p>
        </div>
        <div role="radiogroup" aria-label="Date format" className="grid grid-cols-2 gap-1 p-0.5 rounded-xl bg-surface border border-subtle">
          {DATE_FORMAT_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={dateFormat === option.value}
              onClick={() => writeDateFormat(option.value)}
              className={`h-9 rounded-[10px] text-[12px] font-semibold transition-colors ${
                dateFormat === option.value ? 'bg-primary text-on-primary' : 'text-content-secondary'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      {phoneCalendar && (
        <div className="space-y-3 pt-1">
          <CalendarSwitch
            storageKey={CALENDAR_GOAL_ITEMS_KEY}
            title="Goal items shown as events"
            hint="Goal items set to Show as event in calendar appear as all-day events. Turning this off removes them. Planned tasks show as bullets in the month view instead"
          />
        </div>
      )}
      {phoneCalendar && <CalendarTargetPicker calendars={calendars} />}
      {phoneCalendar && <CalendarShownList calendars={calendars} />}
    </div>
  );
}
