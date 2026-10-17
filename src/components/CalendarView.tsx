import { useMemo, useState, useEffect, useRef, type TouchEvent as ReactTouchEvent } from 'react';
import Overlay from './Overlay';
import { useLocalDay } from '../hooks/useLocalDay';
import CalendarDateDial from './CalendarDateDial';
import { calendarFocusSummary } from '../lib/calendarSummary';
import { hapticTick } from '../lib/haptics';
import { ChevronLeft, ChevronRight, BarChart2, X, Info, ChevronDown, ChevronUp } from 'lucide-react';
import type { Task } from '../types';
import { findGoal, localISODate, pathTitles, useStore, isOpenBacklogTask } from '../store';
import { taskStepStates } from '../lib/goalTree';
import { originChipNames } from '../lib/plannedWork';
import { useDeviceCalendar } from '../hooks/useDeviceCalendar';
import { CALENDAR_CHANGED_EVENT, notifyCalendarChanged } from '../hooks/useTaskCalendarSync';
import { useLocalStorage } from '../hooks/useLocalStorage';
import CalendarEventSheet from './CalendarEventSheet';
import CalendarDaySheet from './CalendarDaySheet';
import WeekView from './WeekView';
import { shiftLocalISO } from '../lib/dates';
import { WEEK_NOTES_KEY, normalizeWeekNotes, weekDaysOf, weekRangeLabel, weekStartOf, withWeekNote } from '../lib/weekView';
import { eventTimeLabel, groupDeviceEventsByDay, type DeviceCalendarEvent } from '../lib/deviceCalendar';
import { chunkWeeks, layoutWeek, MAX_BAR_LANES, monthGridDays, readableTextColor } from '../lib/monthLayout';
import { innerEdges, mergedBlocksForWeek, mergedTint } from '../lib/monthMerge';
import { yearEndDay, yearStartDay } from '../lib/yearView';
import { readGoalLinks } from '../lib/goalCalendar';
import YearView from './YearView';
import { CALENDAR_VIEW_OPTIONS, readCalendarDefaultView, type CalendarViewMode } from '../lib/calendarPrefs';
import { formatDuration } from '../lib/format';
import { buildSessionSummary, isCountableSession, sessionOverlapsLocalDate } from '../lib/sessionStats';
import { taskOccurrenceOnDate, taskTimelineDates } from '../lib/taskTimeline';

interface Props {
  tasks: Task[];
  onAddTask: (date: string) => void;
  onJumpToGoal: (goalNodeId: string | null | undefined) => void;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface MonthWeekRowProps {
  days: string[];
  events: DeviceCalendarEvent[];
  /** 0-11, used to dim the days that belong to the neighbouring months */
  month: number;
  todayStr: string;
  selectedDate: string | null;
  tasksByDate: Record<string, Task[]>;
  onSelect: (date: string) => void;
}

/** One week of the month grid: tappable day cells underneath, date numbers and colored event bars on top. */
function MonthWeekRow({ days, events, month, todayStr, selectedDate, tasksByDate, onSelect }: MonthWeekRowProps) {
  const layout = useMemo(() => layoutWeek(days, events), [days, events]);
  // Events of two or more days join their day cells into one tinted block (the longest event sets the tint).
  const blocks = useMemo(() => mergedBlocksForWeek(days, events), [days, events]);
  const mergedEdges = useMemo(() => innerEdges(blocks, days.length), [blocks, days.length]);

  return (
    <div className="relative border-t border-subtle first:border-t-0">
      {blocks.length > 0 && (
        <div className="absolute inset-0 grid grid-cols-7 pointer-events-none" aria-hidden>
          {blocks.map((block) => {
            const left = block.continuesBefore ? 0 : 7;
            const right = block.continuesAfter ? 0 : 7;
            return (
              <div
                key={`${block.event.key}:${block.startCol}`}
                style={{
                  gridColumn: `${block.startCol + 1} / ${block.endCol + 2}`,
                  gridRow: 1,
                  backgroundColor: mergedTint(block.event.color),
                  margin: `1px ${block.continuesAfter ? 0 : 1}px 1px ${block.continuesBefore ? 0 : 1}px`,
                  borderRadius: `${left}px ${right}px ${right}px ${left}px`,
                }}
              />
            );
          })}
        </div>
      )}
      <div className="absolute inset-0 grid grid-cols-7">
        {days.map((date, col) => {
          const count = events.filter((ev) => ev.startDay <= date && ev.endDay >= date).length;
          const fullDate = new Date(date + 'T12:00:00').toLocaleDateString(undefined, { dateStyle: 'full' });
          return (
            <button
              key={date}
              type="button"
              aria-pressed={date === selectedDate}
              aria-label={count > 0 ? `${fullDate}, ${count} calendar ${count === 1 ? 'event' : 'events'}` : fullDate}
              onClick={() => onSelect(date)}
              className={`${mergedEdges[col] ? '' : 'border-r border-subtle'} last:border-r-0 transition-colors ${date === selectedDate ? 'bg-primary-soft' : ''}`}
            />
          );
        })}
      </div>
      <div
        className="relative pointer-events-none grid grid-cols-7 py-1"
        style={{ gridTemplateRows: `20px repeat(${MAX_BAR_LANES}, 15px)`, rowGap: 2 }}
      >
        {days.map((date, col) => {
          const inMonth = new Date(date + 'T12:00:00').getMonth() === month;
          const isToday = date === todayStr;
          const isSelected = date === selectedDate;
          const dayTasks = tasksByDate[date] ?? [];
          const allDone = dayTasks.length > 0 && dayTasks.every((task) => taskOccurrenceOnDate(task, date)?.completedOnDate);
          const hidden = layout.hidden[col];
          return (
            <div
              key={date}
              style={{ gridColumn: col + 1, gridRow: 1 }}
              className={`flex items-center justify-between px-1 ${inMonth ? '' : 'opacity-40'}`}
            >
              <span className="inline-flex items-baseline">
                <span
                  className={`min-w-[20px] h-5 px-1 rounded-full inline-flex items-center justify-center text-[11px] tabular-nums ${
                    isSelected
                      ? 'bg-primary text-on-primary font-semibold'
                      : isToday
                        ? 'bg-primary-soft text-primary-glow border border-primary/20 font-bold'
                        : 'text-content-primary font-medium'
                  }`}
                >
                  {Number(date.slice(8))}
                </span>
                {dayTasks.length > 0 && (
                  <sup className={`task-sup font-bold ${allDone && !isSelected ? 'text-secondary' : 'text-warning'}`}>
                    {dayTasks.length}
                  </sup>
                )}
              </span>
              {hidden > 0 && <span className="text-[9px] font-bold text-content-secondary">+{hidden}</span>}
            </div>
          );
        })}
        {layout.bars.map((bar) => {
          const { event } = bar;
          const left = bar.continuesBefore ? 0 : 4;
          const right = bar.continuesAfter ? 0 : 4;
          return (
            <div
              key={`${event.key}:${bar.startCol}`}
              className="truncate text-[9.5px] leading-[15px] font-semibold px-1"
              style={{
                gridColumn: `${bar.startCol + 1} / ${bar.endCol + 2}`,
                gridRow: bar.lane + 2,
                backgroundColor: event.color,
                color: readableTextColor(event.color),
                marginLeft: bar.continuesBefore ? 0 : 2,
                marginRight: bar.continuesAfter ? 0 : 2,
                borderRadius: `${left}px ${right}px ${right}px ${left}px`,
              }}
            >
              {event.title || '(No title)'}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function CalendarView({ tasks, onAddTask, onJumpToGoal }: Props) {
  const { goals, sessionHistory, toggleTaskStep, setTaskDone, unlinkTask, removeTask } = useStore();
  const [cursor, setCursor] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });
  const todayStr = useLocalDay();
  const [selectedDate, setSelectedDate] = useState<string | null>(todayStr);
  const [view, setView] = useState<CalendarViewMode>(readCalendarDefaultView);
  /** The year the Year view shows. */
  const [yearCursor, setYearCursor] = useState(() => new Date().getFullYear());
  /** Which phone events YouDo made for goal items (event id → goal item), for the location chip in the leaflet. */
  const [goalLinks, setGoalLinks] = useState(readGoalLinks);
  useEffect(() => {
    const reload = () => setGoalLinks(readGoalLinks());
    window.addEventListener(CALENDAR_CHANGED_EVENT, reload);
    window.addEventListener('focus', reload);
    return () => {
      window.removeEventListener(CALENDAR_CHANGED_EVENT, reload);
      window.removeEventListener('focus', reload);
    };
  }, []);
  const [storedWeekNotes, setStoredWeekNotes] = useLocalStorage<Record<string, string>>(WEEK_NOTES_KEY, {});
  const weekNotes = useMemo(() => normalizeWeekNotes(storedWeekNotes), [storedWeekNotes]);
  const agendaRef = useRef<HTMLDivElement>(null);
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const previousToday = useRef(todayStr);
  useEffect(() => {
    if (todayStr !== previousToday.current && selectedDate === previousToday.current) {
      setSelectedDate(todayStr);
      const date = new Date(todayStr + 'T12:00:00');
      setCursor(new Date(date.getFullYear(), date.getMonth(), 1));
    }
    previousToday.current = todayStr;
  }, [todayStr, selectedDate]);
  const [dayStatsModalDate, setDayStatsModalDate] = useState<string | null>(null);
  const [showDayStatsHelp, setShowDayStatsHelp] = useState(false);
  const [openSessionSummaryId, setOpenSessionSummaryId] = useState<string | null>(null);
  /** The phone-calendar event being edited, or `{ event: null }` while a new one is being made. */
  const [eventSheet, setEventSheet] = useState<{ event: DeviceCalendarEvent | null } | null>(null);
  /** The day whose leaflet is open (opened by tapping a day in the Month or Week view). */
  const [daySheetDate, setDaySheetDate] = useState<string | null>(null);

  useEffect(() => {
    setOpenSessionSummaryId(null);
  }, [dayStatsModalDate]);

  const getOriginPath = (goalNodeId: string | undefined): string | null => {
    if (!goalNodeId) return null;
    for (const root of goals) {
      const titles = pathTitles(root, goalNodeId);
      if (titles.length) return titles.join(' / ');
    }
    return null;
  };

  /** Goal name plus the last two branches the task sits in (not the first two); empty for a quick task. */
  const originNamesFor = (task: Task): string[] => {
    if (!task.goalNodeId) return [];
    for (const root of goals) {
      const titles = pathTitles(root, task.goalNodeId);
      if (titles.length) return originChipNames(titles.slice(0, -1));
    }
    return [];
  };
  const stepStatesFor = (task: Task): boolean[] =>
    taskStepStates(task, task.goalNodeId ? findGoal(goals, task.goalNodeId) : null);

  const tasksByDate = useMemo(() => {
    const map: Record<string, Task[]> = {};
    const add = (d: string, t: Task) => {
      if (!map[d]) map[d] = [];
      if (!map[d].some(x => x.id === t.id)) map[d].push(t);
    };
    for (const t of tasks) {
      for (const date of taskTimelineDates(t)) {
        if (taskOccurrenceOnDate(t, date)) add(date, t);
      }
    }
    return map;
  }, [tasks]);

  // A task with a timeframe also belongs to the days after its first day, up to its last day.
  const spanByDate = useMemo(() => {
    const map: Record<string, Task[]> = {};
    for (const t of tasks) {
      if (!t.targetDate || !t.endDate || t.endDate <= t.targetDate) continue;
      let day = shiftLocalISO(t.targetDate, 1);
      for (let i = 0; i < 62 && day <= t.endDate; i++) {
        (map[day] ??= []).push(t);
        day = shiftLocalISO(day, 1);
      }
    }
    return map;
  }, [tasks]);
  const tasksWithSpans = useMemo(() => {
    const merged: Record<string, Task[]> = { ...tasksByDate };
    for (const [day, list] of Object.entries(spanByDate)) merged[day] = [...(merged[day] ?? []), ...list];
    return merged;
  }, [tasksByDate, spanByDate]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const monthName = cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  // Every day the month grid shows, including the neighbouring months' days that fill the first and last week.
  const gridDays = useMemo(() => monthGridDays(year, month), [year, month]);
  const weeks = useMemo(() => chunkWeeks(gridDays), [gridDays]);
  const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;

  // Phone calendar events for everything on screen: the month grid, or the whole year in the Year view.
  const deviceCalendar = useDeviceCalendar(
    view === 'year' ? yearStartDay(yearCursor) : gridDays[0],
    view === 'year' ? yearEndDay(yearCursor) : gridDays[gridDays.length - 1],
  );
  // An event a task created is shown through that task, so it is not listed a second time as a bar.
  const eventsByDay = useMemo(() => {
    const linked = new Set(tasks.flatMap((task) => (task.calendarEventId ? [task.calendarEventId] : [])));
    return groupDeviceEventsByDay(deviceCalendar.events.filter((event) => !linked.has(event.id)));
  }, [deviceCalendar.events, tasks]);

  const prevMonth = () => setCursor(new Date(year, month - 1, 1));
  const nextMonth = () => setCursor(new Date(year, month + 1, 1));
  const stepYear = (direction: -1 | 1) => setYearCursor((current) => current + direction);
  /** A month (or a day) tapped in the Year view opens in the Month view. */
  const openMonthFromYear = (targetYear: number, targetMonth: number) => {
    setCursor(new Date(targetYear, targetMonth, 1));
    setView('month');
  };

  /** Goal item an event was made for, if YouDo made it (plain phone events return null). */
  const goalNodeIdForEvent = (event: DeviceCalendarEvent): string | null => {
    for (const [nodeId, link] of Object.entries(goalLinks)) {
      if (!link.removed && link.eventId === event.id) return nodeId;
    }
    return null;
  };
  /** Goal name plus the last two branches above the item the event belongs to; empty for a plain event. */
  const originNamesForEvent = (event: DeviceCalendarEvent): string[] => {
    const nodeId = goalNodeIdForEvent(event);
    if (!nodeId) return [];
    for (const root of goals) {
      const titles = pathTitles(root, nodeId);
      if (titles.length) return originChipNames(titles.slice(0, -1));
    }
    return [];
  };

  // The Week view shows the week that holds the selected day; stepping a week moves the selection by seven days.
  const weekAnchor = selectedDate ?? todayStr;
  const weekStart = weekStartOf(weekAnchor);
  const weekLabel = weekRangeLabel(weekDaysOf(weekAnchor));
  const stepWeek = (direction: -1 | 1) => selectDay(shiftLocalISO(weekAnchor, direction * 7));
  const onNoteChange = (start: string, text: string) =>
    setStoredWeekNotes((current) => withWeekNote(normalizeWeekNotes(current), start, text));

  const selectedTasks = selectedDate ? (tasksByDate[selectedDate] ?? []) : [];
  const selectedDone = selectedDate
    ? selectedTasks.filter((task) => taskOccurrenceOnDate(task, selectedDate)?.completedOnDate).length
    : 0;

  const summary = useMemo(() => calendarFocusSummary(Object.values(sessionHistory).flat(), selectedDate ?? todayStr), [sessionHistory, selectedDate, todayStr]);
  const selectDay = (date: string) => {
    if (date !== selectedDate) hapticTick();
    setSelectedDate(date);
    const parsed = new Date(date + 'T12:00:00');
    setCursor(new Date(parsed.getFullYear(), parsed.getMonth(), 1));
    setYearCursor(parsed.getFullYear());
  };
  const showTodayButton =
    selectedDate !== todayStr ||
    monthKey !== todayStr.slice(0, 7) ||
    (view === 'year' && yearCursor !== Number(todayStr.slice(0, 4)));
  /** Tapping a day in the Month or Week view selects it and opens its leaflet. */
  const openDay = (date: string) => {
    selectDay(date);
    setDaySheetDate(date);
  };

  // Swipe the grid sideways to change month (or week); mostly-vertical drags are left to normal scrolling,
  // and a drag that starts in the notes box is a text selection, not a swipe.
  const onGridTouchStart = (event: ReactTouchEvent) => {
    if ((event.target as HTMLElement).closest('textarea')) {
      swipeStart.current = null;
      return;
    }
    const touch = event.touches[0];
    swipeStart.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
  };
  const onGridTouchEnd = (event: ReactTouchEvent) => {
    const start = swipeStart.current;
    swipeStart.current = null;
    const touch = event.changedTouches[0];
    if (!start || !touch) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.abs(dx) < 56 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    hapticTick();
    if (view === 'week') stepWeek(dx < 0 ? 1 : -1);
    else if (view === 'year') stepYear(dx < 0 ? 1 : -1);
    else if (dx < 0) nextMonth();
    else prevMonth();
  };

  // Agenda: only the days of this month that have something on them.
  const agendaDays = gridDays.filter(
    (date) => date.startsWith(monthKey) && ((eventsByDay[date]?.length ?? 0) > 0 || (tasksByDate[date]?.length ?? 0) > 0),
  );

  // Opening the Agenda (or changing month) scrolls its own list to the selected day.
  const selectedDateRef = useRef(selectedDate);
  selectedDateRef.current = selectedDate;
  useEffect(() => {
    if (view !== 'agenda') return;
    const list = agendaRef.current;
    const target = list?.querySelector<HTMLElement>(`[data-agenda-date="${selectedDateRef.current}"]`);
    if (list && target) list.scrollTop = Math.max(0, target.offsetTop);
    else if (list) list.scrollTop = 0;
  }, [view, monthKey]);

  // Gather sessions for modal date
  const modalDateSessions = useMemo(() => {
    if (!dayStatsModalDate) return [];
    const allSessions = Object.values(sessionHistory).flat();
    return allSessions.flatMap((s) => {
      const slice = sessionOverlapsLocalDate(s, dayStatsModalDate);
      if (!slice || (slice.durationMs <= 0 && slice.netFocusMs <= 0)) return [];
      return [{ session: s, slice }];
    });
  }, [dayStatsModalDate, sessionHistory]);

  const modalDateTasks = useMemo(() => {
    return dayStatsModalDate ? (tasksByDate[dayStatsModalDate] ?? []) : [];
  }, [dayStatsModalDate, tasksByDate]);

  const hasSessionProcess = (tId: string, date: string) => {
    return sessionHistory[tId]?.some((s) => {
      if (!isCountableSession(s)) return false;
      const slice = sessionOverlapsLocalDate(s, date);
      return !!slice && slice.netFocusMs > 0;
    }) ?? false;
  };

  // Group 1: Task Execution (Native)
  const nativeTasks = modalDateTasks.filter((task) => {
    const kind = taskOccurrenceOnDate(task, dayStatsModalDate!)?.kind;
    return kind === 'scheduled' || kind === 'failed';
  });
  
  // Filter out manual completions from stats calculation
  const processNativeTasks = nativeTasks.filter((task) => {
    const occurrence = taskOccurrenceOnDate(task, dayStatsModalDate!);
    return occurrence?.kind === 'failed' || !occurrence?.completedOnDate || hasSessionProcess(task.id, dayStatsModalDate!);
  });
  
  const nativeScheduledCount = processNativeTasks.length;
  const nativeCompletedCount = processNativeTasks.filter(
    (task) => taskOccurrenceOnDate(task, dayStatsModalDate!)?.completedOnDate,
  ).length;
  const nativeFailedCount = processNativeTasks.filter(
    (task) => taskOccurrenceOnDate(task, dayStatsModalDate!)?.kind === 'failed',
  ).length;
  
  const taskEfficiency = nativeScheduledCount > 0 ? Math.round((nativeCompletedCount / nativeScheduledCount) * 100) : 0;

  // Group 2: Focus Quality
  const dayTotalNFT = useMemo(
    () => modalDateSessions.filter(({ session }) => isCountableSession(session)).reduce((acc, { slice }) => acc + slice.netFocusMs, 0),
    [modalDateSessions],
  );
  const dayTotalWCD = useMemo(
    () => modalDateSessions.filter(({ session }) => isCountableSession(session)).reduce((acc, { slice }) => acc + slice.durationMs, 0),
    [modalDateSessions],
  );
  const focusEfficiency = dayTotalWCD > 0 ? Math.min(100, Math.round((dayTotalNFT / dayTotalWCD) * 100)) : 0;

  // Group 3: Momentum
  const globalBacklogsCount = tasks.filter((t) => isOpenBacklogTask(t)).length;
  const backlogsCleared = modalDateTasks.filter(
    (task) => taskOccurrenceOnDate(task, dayStatsModalDate!)?.kind === 'backlog-completed' && hasSessionProcess(task.id, dayStatsModalDate!),
  ).length;
  const totalRelevantBacklogs = globalBacklogsCount + backlogsCleared;

  let momentumStr = "";
  if (globalBacklogsCount === 0 && backlogsCleared === 0) {
    momentumStr = "Keeping the slate clean.";
  } else if (globalBacklogsCount === 0 && backlogsCleared > 0) {
    momentumStr = "Incredible. All backlogs crushed.";
  } else if (backlogsCleared > 0) {
    momentumStr = "Solid work catching up.";
  } else {
    momentumStr = "Backlogs are piling up. Time to focus.";
  }

  return (
    <div className="calendar-workspace">
      <CalendarDateDial value={selectedDate ?? todayStr} today={todayStr} onChange={selectDay} />
      <div className="flex items-center justify-between gap-2">
        <div role="tablist" aria-label="Calendar view" className="inline-flex p-0.5 rounded-xl bg-surface border border-subtle">
          {CALENDAR_VIEW_OPTIONS.map(({ id: mode, label }) => (
            <button
              key={mode}
              type="button"
              role="tab"
              aria-selected={view === mode}
              onClick={() => {
                if (mode === 'year') setYearCursor(year);
                setView(mode);
              }}
              className={`px-3 h-8 rounded-[10px] text-[12px] font-semibold transition-colors ${
                view === mode ? 'bg-primary text-on-primary' : 'text-content-secondary'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {showTodayButton && (
          <button
            type="button"
            onClick={() => selectDay(todayStr)}
            className="h-8 px-3 rounded-xl text-[12px] font-semibold text-primary bg-primary-soft border border-primary/20"
          >
            Today
          </button>
        )}
      </div>

      {/* Month / week navigation */}
      <div className="flex items-center justify-between">
        <button type="button" aria-label={view === 'week' ? 'Previous week' : view === 'year' ? 'Previous year' : 'Previous month'} onClick={view === 'week' ? () => stepWeek(-1) : view === 'year' ? () => stepYear(-1) : prevMonth} className="p-2 rounded-lg text-content-secondary hover:text-content-primary hover:bg-surface transition-colors">
          <ChevronLeft size={18} />
        </button>
        <h2 className="text-base font-bold text-content-primary">{view === 'week' ? weekLabel : view === 'year' ? yearCursor : monthName}</h2>
        <button type="button" aria-label={view === 'week' ? 'Next week' : view === 'year' ? 'Next year' : 'Next month'} onClick={view === 'week' ? () => stepWeek(1) : view === 'year' ? () => stepYear(1) : nextMonth} className="p-2 rounded-lg text-content-secondary hover:text-content-primary hover:bg-surface transition-colors">
          <ChevronRight size={18} />
        </button>
      </div>

      {view === 'month' ? (
        <div
          className="no-swipe bg-surface border border-subtle rounded-2xl shadow-card overflow-hidden"
          onTouchStart={onGridTouchStart}
          onTouchEnd={onGridTouchEnd}
        >
          <div className="grid grid-cols-7 border-b border-subtle">
            {WEEKDAYS.map((d) => (
              <div key={d} className="text-center text-[10px] font-bold uppercase tracking-wider text-content-secondary py-1.5">{d}</div>
            ))}
          </div>
          {weeks.map((days) => (
            <MonthWeekRow
              key={days[0]}
              days={days}
              events={deviceCalendar.events}
              month={month}
              todayStr={todayStr}
              selectedDate={selectedDate}
              tasksByDate={tasksByDate}
              onSelect={openDay}
            />
          ))}
        </div>
      ) : view === 'year' ? (
        <div className="no-swipe" onTouchStart={onGridTouchStart} onTouchEnd={onGridTouchEnd}>
          <YearView
            year={yearCursor}
            todayStr={todayStr}
            events={deviceCalendar.events}
            onOpenMonth={openMonthFromYear}
            onOpenDay={(date) => {
              selectDay(date);
              setView('month');
            }}
          />
        </div>
      ) : view === 'week' ? (
        <div className="no-swipe" onTouchStart={onGridTouchStart} onTouchEnd={onGridTouchEnd}>
          <WeekView
            anchorDate={weekAnchor}
            todayStr={todayStr}
            selectedDate={selectedDate}
            eventsByDay={eventsByDay}
            tasksByDate={tasksWithSpans}
            note={weekNotes[weekStart] ?? ''}
            onNoteChange={onNoteChange}
            onSelect={openDay}
          />
        </div>
      ) : (
        <div
          ref={agendaRef}
          className="relative max-h-[60vh] overflow-y-auto overscroll-contain bg-surface border border-subtle rounded-2xl shadow-card"
          aria-label={`Agenda for ${monthName}`}
        >
          {agendaDays.length === 0 ? (
            <p className="p-6 text-center text-content-secondary text-xs">Nothing planned in {monthName}.</p>
          ) : (
            agendaDays.map((date) => {
              const dayEvents = eventsByDay[date] ?? [];
              const dayTasks = tasksByDate[date] ?? [];
              const isSelected = date === selectedDate;
              return (
                <section key={date} data-agenda-date={date} className="border-t border-subtle first:border-t-0">
                  <button
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => selectDay(date)}
                    className={`w-full flex items-center justify-between px-3.5 py-2 text-left ${isSelected ? 'bg-primary-soft' : ''}`}
                  >
                    <span className={`text-[12.5px] font-bold ${date === todayStr ? 'text-primary-glow' : 'text-content-primary'}`}>
                      {new Date(date + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                    </span>
                    {date === todayStr && <span className="text-[10px] font-bold uppercase tracking-wider text-primary-glow">Today</span>}
                  </button>
                  <ul className="px-3.5 pb-2.5 space-y-1.5">
                    {dayEvents.map((ev) => (
                      <li key={ev.key}>
                        <button
                          type="button"
                          onClick={() => setEventSheet({ event: ev })}
                          className="w-full flex gap-2.5 items-stretch text-left"
                        >
                          <span className="w-1 rounded-full shrink-0" style={{ backgroundColor: ev.color }} aria-hidden />
                          <div className="min-w-0">
                            <p className="text-[13px] font-semibold text-content-primary leading-snug truncate">{ev.title || '(No title)'}</p>
                            <p className="text-[11px] text-content-secondary tabular-nums">{eventTimeLabel(ev, date)}</p>
                          </div>
                        </button>
                      </li>
                    ))}
                    {dayTasks.map((task) => {
                      const resolved = taskOccurrenceOnDate(task, date)?.resolved;
                      return (
                        <li key={task.id} className="flex gap-2.5 items-center">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ml-[1px] ${resolved ? 'bg-secondary/30' : 'bg-primary'}`} aria-hidden />
                          <p className={`min-w-0 flex-1 text-[13px] leading-snug truncate ${resolved ? 'line-through text-content-muted' : 'text-content-primary'}`}>{task.title}</p>
                          <span className="text-[11px] font-bold tabular-nums text-content-secondary shrink-0">
                            {task.progress}/{task.steps.length > 0 ? task.steps.length : 1}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })
          )}
        </div>
      )}
      <section className="calendar-day-summary" aria-label="Selected day summary">
        <div className="calendar-summary-heading">
          <h2>{selectedDate ? new Date(selectedDate + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : 'Daily summary'}</h2>
          <button type="button" aria-haspopup="dialog" onClick={() => setDayStatsModalDate(selectedDate)}><BarChart2 size={14} /> Full stats <ChevronRight size={13} /></button>
        </div>
        <div className="calendar-summary-values" key={selectedDate}>
          <div><strong>{selectedDone}<small> / {selectedTasks.length}</small></strong><span>Finished</span></div>
          <div><strong>{formatDuration(summary.netFocusMs)}</strong><span>Net focus</span></div>
          <div><strong>{summary.count}</strong><span>Sessions</span></div>
        </div>
      </section>

      {/* The day leaflet steps aside while an event is being edited, and comes back when that is done. */}
      {daySheetDate && !eventSheet && (
        <CalendarDaySheet
          date={daySheetDate}
          todayStr={todayStr}
          events={eventsByDay[daySheetDate] ?? []}
          tasks={tasksWithSpans[daySheetDate] ?? []}
          calendarSupported={deviceCalendar.supported}
          access={deviceCalendar.access}
          sessionHistory={sessionHistory}
          stepStatesFor={stepStatesFor}
          originNamesFor={originNamesFor}
          originNamesForEvent={originNamesForEvent}
          goalNodeIdForEvent={goalNodeIdForEvent}
          onToggleDone={setTaskDone}
          onToggleStep={toggleTaskStep}
          onDeleteTask={(task) => (task.goalNodeId ? unlinkTask(task.id) : removeTask(task.id))}
          onClose={() => setDaySheetDate(null)}
          onAddTask={(date) => {
            setDaySheetDate(null);
            onAddTask(date);
          }}
          onAddEvent={() => setEventSheet({ event: null })}
          onEditEvent={(event) => setEventSheet({ event })}
          onJumpToGoal={(goalNodeId) => {
            setDaySheetDate(null);
            onJumpToGoal(goalNodeId);
          }}
          onRequestAccess={() => void deviceCalendar.requestAccess()}
          onOpenSettings={() => void deviceCalendar.openSettings()}
        />
      )}

      {eventSheet && (
        <CalendarEventSheet
          event={eventSheet.event}
          date={daySheetDate ?? selectedDate ?? todayStr}
          onClose={() => setEventSheet(null)}
          onChanged={notifyCalendarChanged}
        />
      )}

      {/* ── Daily Focus Stats & Efficiency Modal ── */}
      {dayStatsModalDate && (
        <Overlay open onClose={() => setDayStatsModalDate(null)} align="center">
          <div className="panel sheet-up p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-subtle">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-primary-soft border border-primary/20 flex items-center justify-center text-primary dark:text-primary">
                  <BarChart2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-content-primary">Daily Focus Stats</h3>
                  <p className="text-xs text-content-secondary">
                    {new Date(dayStatsModalDate + 'T00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => setShowDayStatsHelp((v) => !v)}
                  className={`p-1.5 rounded-lg ${showDayStatsHelp ? 'bg-primary-soft text-primary' : 'text-content-secondary hover:text-content-primary hover:bg-elevated'}`}
                  title="How stats work"
                >
                  <Info className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setDayStatsModalDate(null)}
                  aria-label="Close daily statistics"
                  className="p-1.5 rounded-lg text-content-secondary hover:text-content-primary hover:bg-elevated transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="space-y-4 max-h-[70vh] overflow-y-auto no-scrollbar pb-2">
              {showDayStatsHelp && (
                <div className="bg-elevated border border-subtle rounded-[12px] p-3.5 space-y-2 text-[12px] text-content-secondary leading-relaxed">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-content-muted">How stats work</p>
                  <p><span className="font-semibold text-content-primary">Task execution</span> counts scheduled work for this date. Completed and failed are from that set. Manual completions (no focus session) are left out so they do not inflate efficiency.</p>
                  <p><span className="font-semibold text-content-primary">Task efficiency</span> is completed ÷ scheduled for this date.</p>
                  <p><span className="font-semibold text-content-primary">Net focus</span> is time sessions were running and not paused. Overnight sessions are split at midnight so each day only gets its share.</p>
                  <p><span className="font-semibold text-content-primary">Total duration</span> is start-to-stop time on this date, including pauses.</p>
                  <p><span className="font-semibold text-content-primary">Focus efficiency</span> is net focus ÷ total duration for this date.</p>
                  <p><span className="font-semibold text-content-primary">Momentum</span> is backlogs you cleared today versus how many are still open.</p>
                  <p>Sessions under 15 seconds of focus are ignored in the totals.</p>
                </div>
              )}
              {/* Group 1: Task Execution */}
              <div className="bg-surface p-3 rounded-[12px] border border-subtle space-y-2.5">
                <h4 className="text-[10px] font-semibold text-content-muted uppercase tracking-wider">Task execution</h4>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-elevated p-2 rounded-xl text-center min-w-0 px-1">
                    <p className="text-[9px] font-bold uppercase text-content-secondary leading-tight">Scheduled</p>
                    <p className="text-sm font-semibold text-content-primary tabular-nums">{nativeScheduledCount}</p>
                  </div>
                  <div className="bg-secondary/10 p-2 rounded-xl text-center min-w-0 px-1">
                    <p className="text-[9px] font-bold uppercase text-secondary leading-tight">Completed</p>
                    <p className="text-sm font-semibold text-secondary tabular-nums">{nativeCompletedCount}</p>
                  </div>
                  <div className="bg-error-soft p-2 rounded-xl text-center min-w-0 px-1">
                    <p className="text-[9px] font-bold uppercase text-error leading-tight">Failed</p>
                    <p className="text-sm font-semibold text-error tabular-nums">{nativeFailedCount}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[10px] font-bold text-content-muted shrink-0 w-24">Task Efficiency</span>
                  <div className="flex-1 min-w-0 h-1.5 rounded-full bg-border-subtle overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${taskEfficiency}%` }} />
                  </div>
                  <span className="text-[10px] font-bold text-primary w-8 shrink-0 text-right tabular-nums">{taskEfficiency}%</span>
                </div>
              </div>

              {/* Group 2: Focus Quality */}
              <div className="bg-surface p-3 rounded-[12px] border border-subtle space-y-2.5">
                <h4 className="text-[10px] font-semibold text-content-muted uppercase tracking-wider">Focus quality</h4>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-primary-soft p-2 rounded-xl text-center min-w-0 px-1">
                    <p className="text-[9px] font-semibold uppercase text-primary leading-tight">Net Focus</p>
                    <p className="text-sm font-semibold text-primary tabular-nums">{formatDuration(dayTotalNFT)}</p>
                  </div>
                  <div className="bg-elevated p-2 rounded-xl text-center min-w-0 px-1">
                    <p className="text-[9px] font-bold uppercase text-content-secondary leading-tight">Total Duration</p>
                    <p className="text-sm font-semibold text-content-muted tabular-nums">{formatDuration(dayTotalWCD)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[10px] font-bold text-content-muted shrink-0 w-24">Focus Efficiency</span>
                  <div className="flex-1 min-w-0 h-1.5 rounded-full bg-border-subtle overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${focusEfficiency}%` }} />
                  </div>
                  <span className="text-[10px] font-semibold text-primary w-8 shrink-0 text-right tabular-nums">{focusEfficiency}%</span>
                </div>
              </div>

              {/* Group 3: Momentum */}
              <div className="bg-surface p-3 rounded-[12px] border border-subtle space-y-2">
                <h4 className="text-[10px] font-semibold text-content-muted uppercase tracking-wider">Momentum</h4>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-content-muted">Backlogs Cleared</span>
                  <span className="text-xs font-semibold text-error">
                    {totalRelevantBacklogs === 0 ? 'No Backlogs Remaining' : `${backlogsCleared} out of ${totalRelevantBacklogs}`}
                  </span>
                </div>
                <p className="text-[10.5px] font-semibold text-content-secondary italic">
                  {momentumStr}
                </p>
              </div>

              {/* Sessions List */}
            <div>
              <h4 className="text-xs font-bold text-content-secondary mb-2">Sessions Run ({modalDateSessions.length})</h4>
              {modalDateSessions.length === 0 ? (
                <p className="text-xs text-content-secondary italic py-3 text-center bg-elevated  rounded-xl border border-subtle dark:border-subtle">
                  No focus sessions logged on this date.
                </p>
              ) : (
                <div className="space-y-1.5 max-h-72 overflow-y-auto no-scrollbar">
                  {[...modalDateSessions]
                    .sort((a, b) => a.session.startTime - b.session.startTime)
                    .map(({ session: s, slice }, index) => {
                    const overnight = localISODate(new Date(s.startTime)) !== localISODate(new Date(s.endTime));
                    const task = tasks.find((t) => t.id === s.taskId);
                    const goalPath = getOriginPath(s.goalNodeId ?? task?.goalNodeId);
                    const summary = buildSessionSummary(s, task, {
                      goalPath,
                      netFocusMs: slice.netFocusMs,
                      durationMs: slice.durationMs,
                    });
                    const summaryOpen = openSessionSummaryId === s.id;
                    const outcomeClass =
                      summary.outcomeTone === 'success'
                        ? 'bg-secondary/10 text-secondary border-secondary/20'
                        : summary.outcomeTone === 'partial'
                          ? 'bg-primary-soft text-primary border-primary/20'
                          : 'bg-surface text-content-muted border-subtle';
                    return (
                      <div key={s.id} className="bg-elevated p-2.5 rounded-xl border border-subtle dark:border-subtle text-xs">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-content-primary truncate">Session {index + 1}</p>
                            <p className="text-[10.5px] text-content-secondary font-mono mt-0.5">
                              {summary.wallClockRange}
                              {overnight ? ' · split' : ''} ({formatDuration(slice.durationMs)})
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-primary font-semibold bg-primary-soft px-2 py-0.5 rounded-lg text-[10.5px]">
                              {formatDuration(slice.netFocusMs)}
                            </span>
                            <button
                              type="button"
                              onClick={() => setOpenSessionSummaryId(summaryOpen ? null : s.id)}
                              className="inline-flex items-center gap-0.5 py-1 px-2 rounded-lg bg-surface border border-subtle text-[10px] font-semibold text-primary hover:bg-primary-soft transition"
                              aria-expanded={summaryOpen}
                              aria-label={summaryOpen ? 'Hide session summary' : 'Show session summary'}
                            >
                              Summary
                              {summaryOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            </button>
                          </div>
                        </div>
                        {summaryOpen && (
                          <div className="mt-2.5 pt-2.5 border-t border-subtle space-y-2.5">
                            <div className="min-w-0">
                              <p className="text-[9px] font-bold uppercase tracking-wider text-content-muted">Task</p>
                              <p className="text-[13px] font-bold text-content-primary leading-snug mt-0.5 truncate">
                                {summary.taskTitle}
                              </p>
                              {summary.pathSegments.length > 0 && (
                                <p className="mt-1 text-[10px] text-content-muted leading-relaxed line-clamp-2">
                                  {summary.pathSegments.map((seg, i) => (
                                    <span key={`${seg}-${i}`}>
                                      {i > 0 && (
                                        <span className="text-content-secondary/40 mx-1" aria-hidden>
                                          /
                                        </span>
                                      )}
                                      <span className={i === summary.pathSegments.length - 1 ? 'text-content-secondary font-medium' : undefined}>
                                        {seg}
                                      </span>
                                    </span>
                                  ))}
                                </p>
                              )}
                            </div>

                            <div className="grid grid-cols-2 gap-1.5">
                              <div className="bg-primary-soft p-2 rounded-xl text-center min-w-0">
                                <p className="text-[9px] font-semibold uppercase text-primary leading-tight">Net Focus</p>
                                <p className="text-sm font-semibold text-primary tabular-nums mt-0.5">{summary.netFocusLabel}</p>
                              </div>
                              <div className="bg-surface p-2 rounded-xl text-center min-w-0 border border-subtle">
                                <p className="text-[9px] font-bold uppercase text-content-secondary leading-tight">Total</p>
                                <p className="text-sm font-semibold text-content-primary tabular-nums mt-0.5">{summary.totalDurationLabel}</p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-[10px] font-bold text-content-muted shrink-0">Efficiency</span>
                              <div className="flex-1 min-w-0 h-1.5 rounded-full bg-border-subtle overflow-hidden">
                                <div
                                  className="h-full bg-primary rounded-full transition-[width] duration-300"
                                  style={{ width: `${summary.focusEfficiency}%` }}
                                />
                              </div>
                              <span className="text-[10px] font-semibold text-primary w-8 shrink-0 text-right tabular-nums">
                                {summary.focusEfficiency}%
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${outcomeClass}`}>
                                {summary.outcome}
                              </span>
                              {summary.pauseCount > 0 && (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-surface text-content-secondary border border-subtle">
                                  {summary.pauseCount} pause{summary.pauseCount === 1 ? '' : 's'}
                                </span>
                              )}
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-surface text-content-muted border border-subtle font-mono">
                                {summary.wallClockRange}
                              </span>
                            </div>

                            {summary.hasSteps && (
                              <div>
                                <p className="text-[9px] font-bold uppercase tracking-wider text-content-muted mb-1.5">
                                  Steps this session
                                </p>
                                {summary.stepNames.length > 0 ? (
                                  <div className="flex flex-wrap gap-1.5">
                                    {summary.stepNames.map((step) => (
                                      <span
                                        key={step}
                                        className="text-[10px] px-2 py-0.5 rounded-md font-medium bg-secondary/10 text-secondary border border-secondary/20"
                                      >
                                        ✓ {step}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-[10.5px] text-content-muted italic">None marked</p>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          </div>
        </Overlay>
      )}
    </div>
  );
}
