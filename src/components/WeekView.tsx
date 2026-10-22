import { useMemo } from 'react';
import type { Task } from '../types';
import type { GoalBullet } from '../lib/goalCalendar';
import { eventTimeLabel, type DeviceCalendarEvent } from '../lib/deviceCalendar';
import { readableTextColor } from '../lib/monthLayout';
import { taskOccurrenceOnDate } from '../lib/taskTimeline';
import { WEEK_CELL_MAX_ITEMS, WEEK_NOTE_MAX_LENGTH, weekCells } from '../lib/weekView';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface Props {
  /** any local day inside the week to show, YYYY-MM-DD */
  anchorDate: string;
  todayStr: string;
  selectedDate: string | null;
  eventsByDay: Record<string, DeviceCalendarEvent[]>;
  tasksByDate: Record<string, Task[]>;
  /** dated lowest-level goal items under an event, shown as bullets like tasks */
  goalItemsByDate: Record<string, GoalBullet[]>;
  /** this week's note text */
  note: string;
  onNoteChange: (weekStart: string, text: string) => void;
  onSelect: (date: string) => void;
}

/** The week as a 2×4 grid filled top-down: Sun–Wed in the first column, Thu–Sat and the notes cell in the second. */
export default function WeekView({
  anchorDate,
  todayStr,
  selectedDate,
  eventsByDay,
  tasksByDate,
  goalItemsByDate,
  note,
  onNoteChange,
  onSelect,
}: Props) {
  const cells = useMemo(() => weekCells(anchorDate), [anchorDate]);

  return (
    <div className="grid grid-cols-2 grid-rows-4 grid-flow-col gap-px bg-border-subtle border border-subtle rounded-2xl shadow-card overflow-hidden">
      {cells.map((cell) => {
        if (cell.kind === 'notes') {
          return (
            <div key="notes" className="bg-surface flex flex-col min-h-[144px] p-2 gap-1">
              <label htmlFor="week-notes" className="text-[10px] font-bold uppercase tracking-wider text-content-secondary">
                Week notes
              </label>
              <textarea
                id="week-notes"
                value={note}
                maxLength={WEEK_NOTE_MAX_LENGTH}
                onChange={(event) => onNoteChange(cell.weekStart, event.target.value)}
                placeholder="Notes for this week"
                className="flex-1 w-full resize-none bg-transparent text-[12px] leading-snug text-content-primary placeholder:text-content-muted outline-none"
              />
            </div>
          );
        }

        const { date, weekdayIndex } = cell;
        const events = eventsByDay[date] ?? [];
        const tasks = tasksByDate[date] ?? [];
        const goalItems = goalItemsByDate[date] ?? [];
        const total = events.length + tasks.length + goalItems.length;
        const isToday = date === todayStr;
        const isSelected = date === selectedDate;
        const fullDate = new Date(date + 'T12:00:00').toLocaleDateString(undefined, { dateStyle: 'full' });

        // Events first, then tasks; the cell keeps a fixed height, so the rest collapse into "+N more".
        const items: Array<
          | { type: 'event'; event: DeviceCalendarEvent }
          | { type: 'task'; task: Task }
          | { type: 'goal'; item: GoalBullet }
        > = [
          ...events.map((event) => ({ type: 'event' as const, event })),
          ...tasks.map((task) => ({ type: 'task' as const, task })),
          ...goalItems.map((item) => ({ type: 'goal' as const, item })),
        ];
        // Up to 5 items show; anything beyond that is counted on its own "+N more" line below them.
        const overflow = total > WEEK_CELL_MAX_ITEMS ? total - WEEK_CELL_MAX_ITEMS : 0;
        const visible = items.slice(0, WEEK_CELL_MAX_ITEMS);

        return (
          <button
            key={date}
            type="button"
            aria-pressed={isSelected}
            aria-label={`${fullDate}, ${events.length} calendar ${events.length === 1 ? 'event' : 'events'}, ${tasks.length + goalItems.length} ${tasks.length + goalItems.length === 1 ? 'task' : 'tasks'}`}
            onClick={() => onSelect(date)}
            className={`text-left flex flex-col min-h-[144px] p-1.5 gap-1 transition-colors ${
              isSelected ? 'bg-primary-soft' : 'bg-surface'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-content-secondary">
                {WEEKDAYS[weekdayIndex]}
              </span>
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
            </span>
            <span className="flex flex-col gap-[3px] min-w-0">
              {visible.map((item) => {
                if (item.type === 'event') {
                  const { event } = item;
                  return (
                    <span
                      key={event.key}
                      className="block truncate rounded px-1 text-[9.5px] leading-[15px] font-semibold"
                      style={{ backgroundColor: event.color, color: readableTextColor(event.color) }}
                      title={`${event.title || '(No title)'} · ${eventTimeLabel(event, date)}`}
                    >
                      {event.title || '(No title)'}
                    </span>
                  );
                }
                if (item.type === 'goal') {
                  const { item: goal } = item;
                  return (
                    <span key={`goal:${goal.nodeId}`} className="flex items-center gap-1 min-w-0 text-[10.5px] leading-[15px]">
                      <span
                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${goal.color ? '' : 'bg-primary'} ${goal.done ? 'opacity-40' : ''}`}
                        style={goal.color ? { backgroundColor: goal.color } : undefined}
                        aria-hidden
                      />
                      <span className={`truncate ${goal.done ? 'line-through text-content-muted' : 'text-content-primary'}`}>{goal.title}</span>
                    </span>
                  );
                }
                const { task } = item;
                const resolved = taskOccurrenceOnDate(task, date)?.resolved;
                return (
                  <span key={task.id} className="flex items-center gap-1 min-w-0 text-[10.5px] leading-[15px]">
                    <span
                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${resolved ? 'bg-secondary/30' : 'bg-primary'}`}
                      aria-hidden
                    />
                    <span
                      className={`truncate ${resolved ? 'line-through text-content-muted' : 'text-content-primary'}`}
                    >
                      {task.title}
                    </span>
                  </span>
                );
              })}
              {overflow > 0 && (
                <span className="text-[9.5px] font-bold text-content-secondary">+{overflow} more</span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
