import { useEffect, useRef, useState } from 'react';
import { TITLE_MAX, isTitleTooLong } from '../lib/titleLimit';
import TitleCounter from './TitleCounter';
import { Calendar } from 'lucide-react';
import type { Priority, Task } from '../types';
import { todayISO, tomorrowISO } from '../store';
import Overlay from './Overlay';
import Toggle from './Toggle';
import EventColorPicker from './EventColorPicker';
import {
  createDeviceEvent,
  getDeviceCalendarPermission,
  listDeviceCalendars,
  requestDeviceCalendarAccess,
  supportsDeviceCalendar,
  type DeviceCalendar,
} from '../lib/nativeCalendar';
import {
  chooseTaskCalendar,
  defaultTimes,
  eventWindow,
  readTaskCalendarId,
  scheduleError,
  scheduleFields,
  writableCalendars,
  writeTaskCalendarId,
  type ScheduleDraft,
} from '../lib/taskSchedule';
import { getCalendarDeviceId } from '../lib/taskCalendarSync';

interface Props {
  open: boolean;
  onClose: () => void;
  onAdd: (task: Task) => void;
  initialDate?: string | null;
}

const priorities: { value: Priority; label: string; active: string }[] = [
  { value: 'high', label: 'High', active: 'bg-error text-white border-error' },
  { value: 'medium', label: 'Medium', active: 'bg-warning text-on-accent border-warning' },
  { value: 'low', label: 'Low', active: 'bg-secondary text-on-accent border-secondary' },
];

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export default function AddTaskSheet({ open, onClose, onAdd, initialDate }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [targetDate, setTargetDate] = useState('');
  /** Last day of a timeframe. Empty (or not after the first day) means a single day. */
  const [endDate, setEndDate] = useState('');
  /** Show the date box even when the day is today or tomorrow, after the calendar chip is tapped. */
  const [customDate, setCustomDate] = useState(false);
  const [color, setColor] = useState<string | null>(null);
  const [deadline, setDeadline] = useState('');
  const [allDay, setAllDay] = useState(true);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [addToCalendar, setAddToCalendar] = useState(false);
  const [calendars, setCalendars] = useState<DeviceCalendar[]>([]);
  const [calendarId, setCalendarId] = useState('');
  const [calendarError, setCalendarError] = useState('');
  const [busy, setBusy] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const calendarSupported = supportsDeviceCalendar();

  useEffect(() => {
    if (open) {
      const times = defaultTimes();
      setTitle('');
      setDescription('');
      setPriority('medium');
      const first = initialDate ?? todayISO();
      setTargetDate(first);
      setEndDate('');
      setCustomDate(first !== todayISO() && first !== tomorrowISO());
      setColor(null);
      setDeadline('');
      setAllDay(true);
      setStartTime(times.startTime);
      setEndTime(times.endTime);
      setAddToCalendar(false);
      setCalendarError('');
      setBusy(false);
      setTimeout(() => titleRef.current?.focus(), 150);
    }
  }, [open, initialDate]);

  // If calendar access is already granted, load the calendars now so the picker is ready.
  // Otherwise the permission is asked for when the task is added.
  useEffect(() => {
    if (!open || !calendarSupported) return;
    let cancelled = false;
    (async () => {
      try {
        if ((await getDeviceCalendarPermission()) !== 'granted') return;
        const list = await listDeviceCalendars();
        if (cancelled) return;
        setCalendars(list);
        setCalendarId(chooseTaskCalendar(list, readTaskCalendarId())?.id ?? '');
      } catch {
        /* the picker simply stays hidden; adding the task will report any real problem */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, calendarSupported]);

  if (!open) return null;

  const draft: ScheduleDraft = { allDay, startTime, endTime };
  const effectiveEnd = targetDate && endDate > targetDate ? endDate : '';
  const timeError = targetDate && !allDay ? scheduleError(draft, !effectiveEnd) : null;
  const showCustomDate = customDate || (targetDate !== todayISO() && targetDate !== tomorrowISO());
  const wantsCalendar = calendarSupported && addToCalendar && Boolean(targetDate);
  const editableCalendars = writableCalendars(calendars);
  const canSubmit = Boolean(title.trim()) && !isTitleTooLong(title) && !timeError && !busy;

  /** Puts the task on the phone calendar and returns the ids that link the two. */
  const createLinkedEvent = async (date: string): Promise<Pick<Task, 'calendarEventId' | 'calendarId' | 'calendarDeviceId'>> => {
    let access = await getDeviceCalendarPermission();
    if (access !== 'granted') access = await requestDeviceCalendarAccess();
    if (access !== 'granted') {
      throw new Error('Calendar access was not allowed. You can turn it on in Android settings.');
    }
    const list = calendars.length ? calendars : await listDeviceCalendars();
    setCalendars(list);
    const target =
      list.find((calendar) => calendar.id === calendarId && calendar.writable) ??
      chooseTaskCalendar(list, readTaskCalendarId());
    if (!target) throw new Error('None of the calendars on this phone can be edited.');
    const slot = eventWindow(date, draft, effectiveEnd || date);
    if (!slot) throw new Error('Check the date and times.');
    const id = await createDeviceEvent({
      calendarId: target.id,
      title: title.trim(),
      description: description.trim(),
      ...slot,
      ...(color ? { color } : {}),
    });
    writeTaskCalendarId(target.id);
    return { calendarEventId: id, calendarId: target.id, calendarDeviceId: getCalendarDeviceId() };
  };

  const submit = async () => {
    if (!canSubmit) return;
    const date = targetDate || null;
    let link: Pick<Task, 'calendarEventId' | 'calendarId' | 'calendarDeviceId'> = {};
    if (wantsCalendar && date) {
      setBusy(true);
      setCalendarError('');
      try {
        link = await createLinkedEvent(date);
      } catch (error) {
        const reason = error instanceof Error && error.message ? error.message : 'Could not add to your calendar.';
        setCalendarError(`${reason} Your task is not saved yet. Tap Add Task to save it without a calendar event.`);
        setAddToCalendar(false);
        setBusy(false);
        return;
      }
      setBusy(false);
    }
    onAdd({
      id: uid(),
      title: title.trim(),
      description: description.trim(),
      priority,
      targetDate: date,
      deadline: deadline ? new Date(deadline).toISOString() : null,
      steps: [],
      progress: 0,
      createdAt: Date.now(),
      order: Date.now(),
      ...scheduleFields(date, draft),
      ...(date && effectiveEnd ? { endDate: effectiveEnd } : {}),
      ...(color ? { color } : {}),
      ...link,
    });
    onClose();
  };

  return (
    <Overlay open={open} onClose={onClose} align="bottom">
      <div className="ios-sheet sheet-up w-full max-w-md mx-auto p-4 pb-[max(1.25rem,env(safe-area-inset-bottom,0px))] min-h-0 flex flex-col gap-3.5">
        {/* Header */}
        <div className="flex flex-col items-center shrink-0 -mt-1 mb-1">
          <div className="w-10 h-1 bg-border-subtle rounded-full opacity-70 mb-2" />
          <h2 className="text-[15px] font-bold text-content-primary">New Task</h2>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar flex flex-col [&>*]:shrink-0 gap-3.5">
          {/* Main Info Card */}
          <div className="bg-surface border border-subtle rounded-2xl overflow-hidden shadow-sm">
            <div className="relative">
            <input
              ref={titleRef}
              value={title}
              maxLength={Math.max(TITLE_MAX, title.length)}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void submit()}
              placeholder="What needs doing?"
              className="w-full h-12 px-3.5 bg-transparent text-[14px] font-semibold text-content-primary placeholder:text-content-muted outline-none border-b border-subtle pr-14"
            />
            <TitleCounter value={title} className="absolute right-3.5 top-1/2 -translate-y-1/2" />
            </div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Details (optional). Keep the name short and put the rest here…"
              rows={2}
              className="w-full bg-transparent px-3.5 py-2.5 text-[13px] font-medium text-content-primary placeholder:text-content-muted outline-none resize-none"
            />
          </div>

          {/* Priority Card */}
          <div className="bg-surface border border-subtle rounded-2xl p-3 shadow-sm flex flex-col gap-2">
            <label className="px-1 text-[10px] font-bold uppercase tracking-wider text-content-muted">Priority</label>
            <div className="bg-elevated p-1 rounded-xl border border-subtle grid grid-cols-3 gap-1">
              {priorities.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPriority(p.value)}
                  className={`py-1.5 rounded-lg text-[12px] font-bold transition-all ${
                    priority === p.value
                      ? `${p.active} shadow-sm`
                      : 'text-content-secondary hover:text-content-primary'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Dates Card */}
          <div className="bg-surface border border-subtle rounded-2xl overflow-hidden shadow-sm">
            <div className="px-3.5 pt-3 pb-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-content-muted">From</label>
            </div>
            <div className="p-2 pt-0 grid grid-cols-3 gap-2 border-b border-subtle">
              <button
                type="button"
                onClick={() => {
                  setTargetDate(todayISO());
                  setCustomDate(false);
                }}
                className={`py-2 rounded-xl text-[12px] font-bold transition-all ${
                  !showCustomDate && targetDate === todayISO()
                    ? 'bg-primary text-on-primary shadow-sm'
                    : 'bg-elevated text-content-secondary hover:text-content-primary border border-subtle'
                }`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => {
                  setTargetDate(tomorrowISO());
                  setCustomDate(false);
                }}
                className={`py-2 rounded-xl text-[12px] font-bold transition-all ${
                  !showCustomDate && targetDate === tomorrowISO()
                    ? 'bg-primary text-on-primary shadow-sm'
                    : 'bg-elevated text-content-secondary hover:text-content-primary border border-subtle'
                }`}
              >
                Tomorrow
              </button>
              <button
                type="button"
                onClick={() => setCustomDate(true)}
                className={`py-2 flex items-center justify-center rounded-xl text-[12px] font-bold transition-all ${
                  showCustomDate
                    ? 'bg-primary text-on-primary shadow-sm'
                    : 'bg-elevated text-content-secondary hover:text-content-primary border border-subtle'
                }`}
                aria-label="Custom Date"
              >
                <Calendar size={14} />
              </button>
            </div>
            {showCustomDate && (
              <div className="p-2 border-b border-subtle bg-elevated/30 flex items-center gap-2">
                <input
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  aria-label="Start date"
                  className="flex-1 min-w-0 h-10 px-3 bg-surface border border-subtle rounded-xl text-[13px] font-medium text-content-primary outline-none focus:border-primary transition-colors"
                />
                {targetDate && (
                  <button
                    type="button"
                    onClick={() => {
                      setTargetDate('');
                      setEndDate('');
                    }}
                    className="shrink-0 px-2 text-[11px] font-bold text-content-secondary"
                  >
                    No date
                  </button>
                )}
              </div>
            )}
            
            {targetDate && (
              <div className="px-3.5 py-3 border-b border-subtle">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <label htmlFor="task-until" className="text-[10px] font-bold uppercase tracking-wider text-content-muted">
                    Until (optional)
                  </label>
                  <div className="flex items-center gap-2 min-w-0">
                    <input
                      id="task-until"
                      type="date"
                      min={targetDate}
                      value={effectiveEnd}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="h-9 px-2.5 bg-elevated border border-subtle rounded-xl text-[12.5px] font-medium text-content-primary outline-none focus:border-primary transition-colors"
                    />
                    {effectiveEnd && (
                      <button type="button" onClick={() => setEndDate('')} className="text-[11px] font-bold text-content-secondary">
                        Clear
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-content-muted">All day</span>
                  <Toggle checked={allDay} onChange={() => setAllDay((value) => !value)} label="All day" />
                </div>
                {!allDay && (
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <label className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-content-muted">Start</span>
                      <input
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className="w-full h-10 px-3 bg-elevated border border-subtle rounded-xl text-[13px] font-medium text-content-primary outline-none focus:border-primary transition-colors"
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-content-muted">End</span>
                      <input
                        type="time"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        className="w-full h-10 px-3 bg-elevated border border-subtle rounded-xl text-[13px] font-medium text-content-primary outline-none focus:border-primary transition-colors"
                      />
                    </label>
                  </div>
                )}
                {timeError && <p className="mt-2 text-[12px] font-medium text-error">{timeError}</p>}
              </div>
            )}

            {calendarSupported && targetDate && (
              <div className="px-3.5 py-3 border-b border-subtle">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={addToCalendar}
                    onChange={(e) => {
                      setAddToCalendar(e.target.checked);
                      setCalendarError('');
                    }}
                    className="h-5 w-5 shrink-0 rounded accent-primary"
                  />
                  <span className="text-[13px] font-semibold text-content-primary">Add to calendar</span>
                </label>
                {addToCalendar && editableCalendars.length > 1 && (
                  <select
                    value={calendarId}
                    onChange={(e) => setCalendarId(e.target.value)}
                    aria-label="Calendar for this task"
                    className="mt-2 w-full h-10 px-3 bg-elevated border border-subtle rounded-xl text-[13px] font-medium text-content-primary outline-none focus:border-primary transition-colors"
                  >
                    {editableCalendars.map((calendar) => (
                      <option key={calendar.id} value={calendar.id}>
                        {calendar.name}
                        {calendar.accountName && calendar.accountName !== calendar.name ? ` (${calendar.accountName})` : ''}
                      </option>
                    ))}
                  </select>
                )}
                {calendarError && <p className="mt-2 text-[12px] font-medium text-error">{calendarError}</p>}
              </div>
            )}

            {wantsCalendar && (
              <div className="p-2 border-b border-subtle">
                <EventColorPicker value={color} onChange={setColor} label="Calendar color" />
              </div>
            )}

            <div className="px-3.5 py-3">
              <label className="text-[10px] font-bold uppercase tracking-wider text-content-muted block mb-2">Hard deadline</label>
              <input
                type="datetime-local"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full h-10 px-3 bg-elevated border border-subtle rounded-xl text-[13px] font-medium text-content-primary outline-none focus:border-primary transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col gap-2 mt-2 shrink-0">
          <button
            onClick={() => void submit()}
            disabled={!canSubmit}
            className="w-full h-12 rounded-2xl text-[13px] font-bold bg-primary text-on-primary disabled:opacity-40 transition-opacity flex items-center justify-center shadow-sm"
          >
            {busy ? 'Adding…' : 'Add Task'}
          </button>
        </div>
      </div>
    </Overlay>
  );
}
