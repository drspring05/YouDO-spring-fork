import DateField from './DateField';
import { useEffect, useState } from 'react';
import { MapPin } from 'lucide-react';
import Overlay from './Overlay';
import Toggle from './Toggle';
import EventColorPicker from './EventColorPicker';
import { eventTimeLabel, type DeviceCalendarEvent } from '../lib/deviceCalendar';
import {
  canEditSchedule,
  draftError,
  draftFromEvent,
  newDraft,
  toChanges,
  toNewEvent,
  type EventDraft,
} from '../lib/eventEdit';
import { readGoalLinks } from '../lib/goalCalendar';
import {
  createDeviceEvent,
  deleteDeviceEvent,
  deleteDeviceOccurrence,
  listDeviceCalendars,
  updateDeviceEvent,
  type DeviceCalendar,
} from '../lib/nativeCalendar';
import { chooseTaskCalendar, readTaskCalendarId, writableCalendars } from '../lib/taskSchedule';

interface Props {
  /** The phone-calendar event to edit, or null to make a new one. */
  event: DeviceCalendarEvent | null;
  /** The day a new event starts on (the day selected in the Calendar tab). */
  date: string;
  onClose: () => void;
  /** Called after the phone calendar was changed, so the views reload. */
  onChanged: () => void;
}

type Step = 'form' | 'confirm-delete' | 'choose-delete';

const inputClass =
  'w-full h-10 px-3 bg-elevated border border-subtle rounded-xl text-[13px] font-medium text-content-primary outline-none focus:border-primary transition-colors';
const labelClass = 'text-[10px] font-bold uppercase tracking-wider text-content-muted';

const messageOf = (cause: unknown, fallback: string) => (cause instanceof Error && cause.message ? cause.message : fallback);

/**
 * Makes, edits or deletes one event on the phone calendar from inside YouDo. Events that belong to a task
 * are changed through the task instead, so they never open here. A repeating event can have its title and
 * notes changed (for the whole series) and one occurrence or the whole series deleted; its time is changed
 * in the Calendar app. Events on read-only calendars (holidays, shared calendars) can only be read.
 */
export default function CalendarEventSheet({ event, date, onClose, onChanged }: Props) {
  const isNew = event === null;
  const readOnly = event !== null && !event.writable;
  const scheduleLocked = event !== null && !canEditSchedule(event);

  const [draft, setDraft] = useState<EventDraft>(() => (event ? draftFromEvent(event) : newDraft(date)));
  const [scheduleTouched, setScheduleTouched] = useState(false);
  const [colorTouched, setColorTouched] = useState(false);
  const [calendars, setCalendars] = useState<DeviceCalendar[]>([]);
  const [calendarId, setCalendarId] = useState('');
  const [step, setStep] = useState<Step>('form');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // A new event needs a calendar to go into: the one chosen in Settings (or last used), unless changed here.
  useEffect(() => {
    if (!isNew) return;
    let live = true;
    (async () => {
      try {
        const list = writableCalendars(await listDeviceCalendars());
        if (!live) return;
        setCalendars(list);
        setCalendarId(chooseTaskCalendar(list, readTaskCalendarId())?.id ?? '');
      } catch {
        if (live) setError('Could not read your calendars.');
      }
    })();
    return () => {
      live = false;
    };
  }, [isNew]);

  const fromGoal = event !== null && Object.values(readGoalLinks()).some((link) => link.eventId === event.id);

  const change = (patch: Partial<EventDraft>, schedule = false) => {
    setDraft((current) => ({ ...current, ...patch }));
    if (schedule) setScheduleTouched(true);
    setError('');
  };

  const run = async (work: () => Promise<boolean | void>, failure: string) => {
    setBusy(true);
    setError('');
    try {
      const done = await work();
      if (done === false) {
        setError('That event is no longer on your calendar.');
        onChanged();
        return;
      }
      onChanged();
      onClose();
    } catch (cause) {
      setError(messageOf(cause, failure));
    } finally {
      setBusy(false);
    }
  };

  const save = () => {
    const problem = draftError(draft, isNew || (!scheduleLocked && scheduleTouched));
    if (problem) {
      setError(problem);
      return;
    }
    if (event === null) {
      const made = toNewEvent(draft, calendarId);
      if (!made) {
        setError(calendarId ? 'Check the date and times.' : 'No calendar on your phone can take new events.');
        return;
      }
      void run(async () => {
        await createDeviceEvent(made);
      }, 'Could not add the event.');
      return;
    }
    const changes = toChanges(event, draft, !scheduleLocked && scheduleTouched, colorTouched);
    if (Object.keys(changes).length === 0) {
      onClose();
      return;
    }
    void run(() => updateDeviceEvent(event.id, changes), 'Could not save the change.');
  };

  const remove = (scope: 'event' | 'occurrence') => {
    if (!event) return;
    void run(
      () => (scope === 'occurrence' ? deleteDeviceOccurrence(event.id, event.begin) : deleteDeviceEvent(event.id)),
      'Could not delete the event.',
    );
  };

  const title = isNew ? 'New event' : readOnly ? 'Event' : 'Edit event';

  return (
    <Overlay open onClose={busy ? undefined : onClose} align="bottom">
      <div className="ios-sheet sheet-up w-full max-w-md mx-auto p-4 pb-[max(1.25rem,env(safe-area-inset-bottom,0px))] min-h-0 flex flex-col gap-3.5">
        <div className="flex flex-col items-center shrink-0 -mt-1 mb-1">
          <div className="w-10 h-1 bg-border-subtle rounded-full opacity-70 mb-2" />
          <h2 className="text-[15px] font-bold text-content-primary">{title}</h2>
        </div>

        {step === 'form' && readOnly && event && (
          <div className="flex flex-col gap-3">
            <div className="flex gap-3 bg-surface border border-subtle rounded-2xl p-3.5">
              <span className="w-1 self-stretch rounded-full shrink-0" style={{ backgroundColor: event.color }} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-bold text-content-primary leading-snug">{event.title || '(No title)'}</p>
                <p className="text-[11.5px] text-content-secondary mt-0.5 tabular-nums">{eventTimeLabel(event, event.startDay)}</p>
                {event.location && (
                  <p className="flex items-center gap-1 text-[11px] text-content-muted mt-1 min-w-0">
                    <MapPin size={11} className="shrink-0" />
                    <span className="truncate">{event.location}</span>
                  </p>
                )}
                {event.description && <p className="text-[12px] text-content-secondary mt-2 whitespace-pre-wrap">{event.description}</p>}
              </div>
            </div>
            <p className="text-[12px] text-content-secondary leading-relaxed">
              This calendar is read-only (a holiday or shared calendar, for example), so it can&rsquo;t be changed from here.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="w-full h-12 rounded-2xl text-[13px] font-bold bg-primary text-on-primary shadow-sm"
            >
              Close
            </button>
          </div>
        )}

        {step === 'form' && !readOnly && (
          <>
            <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar flex flex-col [&>*]:shrink-0 gap-3.5">
              <div className="bg-surface border border-subtle rounded-2xl overflow-hidden shadow-sm">
                <input
                  value={draft.title}
                  onChange={(e) => change({ title: e.target.value })}
                  onKeyDown={(e) => e.key === 'Enter' && !busy && save()}
                  placeholder="Event title"
                  aria-label="Event title"
                  className="w-full h-12 px-3.5 bg-transparent text-[14px] font-semibold text-content-primary placeholder:text-content-muted outline-none border-b border-subtle"
                />
                <textarea
                  value={draft.description}
                  onChange={(e) => change({ description: e.target.value })}
                  placeholder="Notes (optional)"
                  aria-label="Notes"
                  rows={2}
                  className="w-full bg-transparent px-3.5 py-2.5 text-[13px] font-medium text-content-primary placeholder:text-content-muted outline-none resize-none"
                />
              </div>

              {scheduleLocked && event ? (
                <div className="bg-surface border border-subtle rounded-2xl px-3.5 py-3 shadow-sm space-y-1">
                  <span className={labelClass}>When</span>
                  <p className="text-[13px] font-semibold text-content-primary tabular-nums">{eventTimeLabel(event, event.startDay)}</p>
                  <p className="text-[11.5px] text-content-secondary leading-relaxed">
                    This is a repeating event. Changes to the title and notes apply to every event in the series. To change
                    the time, use your Calendar app.
                  </p>
                </div>
              ) : (
                <div className="bg-surface border border-subtle rounded-2xl px-3.5 py-3 shadow-sm space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className={labelClass}>All day</span>
                    <Toggle checked={draft.allDay} onChange={() => change({ allDay: !draft.allDay }, true)} label="All day" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="flex flex-col gap-1">
                      <span className={labelClass}>{draft.allDay ? 'From' : 'Starts'}</span>
                      <DateField
                        value={draft.startDate}
                        onChange={(e) => {
                          const next = e.target.value;
                          // Moving the start past the end drags the end along, so the event never ends up backwards.
                          change({ startDate: next, endDate: next > draft.endDate ? next : draft.endDate }, true);
                        }}
                        className={inputClass}
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className={labelClass}>{draft.allDay ? 'To' : 'Ends'}</span>
                      <DateField
                        value={draft.endDate}
                        min={draft.startDate || undefined}
                        onChange={(e) => change({ endDate: e.target.value }, true)}
                        className={inputClass}
                      />
                    </label>
                    {!draft.allDay && (
                      <>
                        <label className="flex flex-col gap-1">
                          <span className={labelClass}>Start time</span>
                          <input
                            type="time"
                            value={draft.startTime}
                            onChange={(e) => change({ startTime: e.target.value }, true)}
                            className={inputClass}
                          />
                        </label>
                        <label className="flex flex-col gap-1">
                          <span className={labelClass}>End time</span>
                          <input
                            type="time"
                            value={draft.endTime}
                            onChange={(e) => change({ endTime: e.target.value }, true)}
                            className={inputClass}
                          />
                        </label>
                      </>
                    )}
                  </div>
                </div>
              )}

              {isNew && calendars.length > 1 && (
                <div className="bg-surface border border-subtle rounded-2xl px-3.5 py-3 shadow-sm space-y-2">
                  <label htmlFor="event-calendar" className={labelClass}>
                    Calendar
                  </label>
                  <select
                    id="event-calendar"
                    value={calendarId}
                    onChange={(e) => setCalendarId(e.target.value)}
                    className={inputClass}
                  >
                    {calendars.map((calendar) => (
                      <option key={calendar.id} value={calendar.id}>
                        {calendar.name}
                        {calendar.accountName && calendar.accountName !== calendar.name ? ` (${calendar.accountName})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <EventColorPicker
                value={draft.color}
                onChange={(color) => {
                  change({ color });
                  setColorTouched(true);
                }}
              />

              {fromGoal && (
                <p className="px-1 text-[11.5px] text-content-secondary leading-relaxed">
                  This event was made from a goal item. Changing it here doesn&rsquo;t change the goal, and changing the goal
                  item later will overwrite your edits here.
                </p>
              )}
              {event?.location && (
                <p className="flex items-center gap-1 px-1 text-[11px] text-content-muted min-w-0">
                  <MapPin size={11} className="shrink-0" />
                  <span className="truncate">{event.location}</span>
                </p>
              )}
              {error && <p className="px-1 text-[12px] font-medium text-error">{error}</p>}
            </div>

            <div className="flex flex-col gap-2 mt-2 shrink-0">
              <button
                type="button"
                onClick={save}
                disabled={busy || (isNew && !calendarId)}
                className="w-full h-12 rounded-2xl text-[13px] font-bold bg-primary text-on-primary disabled:opacity-40 transition-opacity flex items-center justify-center shadow-sm"
              >
                {busy ? 'Saving…' : isNew ? 'Add event' : 'Save'}
              </button>
              {!isNew && (
                <button
                  type="button"
                  onClick={() => {
                    setError('');
                    setStep(event?.recurring ? 'choose-delete' : 'confirm-delete');
                  }}
                  disabled={busy}
                  className="w-full h-11 rounded-2xl text-[13px] font-bold bg-error-soft text-error border border-error/20 disabled:opacity-40"
                >
                  Delete event
                </button>
              )}
            </div>
          </>
        )}

        {step === 'confirm-delete' && event && (
          <div className="flex flex-col gap-3" role="alertdialog" aria-label="Delete event">
            <p className="text-[13px] text-content-secondary leading-relaxed">
              Delete <span className="font-semibold text-content-primary">&ldquo;{event.title || '(No title)'}&rdquo;</span> from your
              calendar? It will disappear from your phone&rsquo;s Calendar app too.
            </p>
            {error && <p className="text-[12px] font-medium text-error">{error}</p>}
            <button
              type="button"
              onClick={() => remove('event')}
              disabled={busy}
              className="w-full h-11 rounded-2xl text-[13px] font-bold bg-error-soft text-error border border-error/20 disabled:opacity-40"
            >
              {busy ? 'Deleting…' : 'Delete'}
            </button>
            <button
              type="button"
              onClick={() => setStep('form')}
              disabled={busy}
              className="w-full h-11 rounded-2xl text-[13px] font-bold bg-primary text-on-primary disabled:opacity-40"
            >
              Keep it
            </button>
          </div>
        )}

        {step === 'choose-delete' && event && (
          <div className="flex flex-col gap-3" role="alertdialog" aria-label="Delete repeating event">
            <p className="text-[13px] text-content-secondary leading-relaxed">
              <span className="font-semibold text-content-primary">&ldquo;{event.title || '(No title)'}&rdquo;</span> repeats. Delete
              only this one, or every event in the series?
            </p>
            {error && <p className="text-[12px] font-medium text-error">{error}</p>}
            <button
              type="button"
              onClick={() => remove('occurrence')}
              disabled={busy}
              className="w-full h-11 rounded-2xl text-[13px] font-bold bg-error-soft text-error border border-error/20 disabled:opacity-40"
            >
              {busy ? 'Deleting…' : 'Only this event'}
            </button>
            <button
              type="button"
              onClick={() => remove('event')}
              disabled={busy}
              className="w-full h-11 rounded-2xl text-[13px] font-bold bg-error-soft text-error border border-error/20 disabled:opacity-40"
            >
              All events in the series
            </button>
            <button
              type="button"
              onClick={() => setStep('form')}
              disabled={busy}
              className="w-full h-11 rounded-2xl text-[13px] font-bold bg-primary text-on-primary disabled:opacity-40"
            >
              Keep them
            </button>
          </div>
        )}
      </div>
    </Overlay>
  );
}
