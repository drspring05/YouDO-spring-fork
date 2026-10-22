import { MapPin, Plus } from 'lucide-react';
import Overlay from './Overlay';
import PlannedTaskCard from './PlannedTaskCard';
import OriginChip from './OriginChip';
import type { Task, TaskSession } from '../types';
import { eventTimeLabel, type DeviceCalendarEvent } from '../lib/deviceCalendar';
import { daysBetweenLocalISO } from '../lib/dates';
import { taskCompletionModeOnDate, taskOccurrenceOnDate } from '../lib/taskTimeline';
import type { DeviceCalendarAccess } from '../hooks/useDeviceCalendar';

interface Props {
  /** the day being shown, YYYY-MM-DD */
  date: string;
  todayStr: string;
  /** phone-calendar events on this day. Events a task made are shown through the task instead. */
  events: DeviceCalendarEvent[];
  /** work planned on this day, including tasks whose timeframe runs through it */
  tasks: Task[];
  /** false off Android, where there is no phone calendar to show */
  calendarSupported: boolean;
  access: DeviceCalendarAccess;
  sessionHistory: Record<string, TaskSession[]>;
  /** which of a task's steps are done, in the task's own order (matches the Today and Goals tabs) */
  stepStatesFor: (task: Task) => boolean[];
  /** goal name plus the last two branches the task sits in; empty for a quick task */
  originNamesFor: (task: Task) => string[];
  /** goal name plus the last two branches for an event YouDo made for a goal item; empty for a plain phone event */
  originNamesForEvent: (event: DeviceCalendarEvent) => string[];
  /** the goal item an event was made for, or null for a plain phone event */
  goalNodeIdForEvent: (event: DeviceCalendarEvent) => string | null;
  onToggleDone: (taskId: string, done: boolean) => void;
  onToggleStep: (taskId: string, stepIndex: number) => void;
  /** delete a quick task, or take a goal item's task off the plan */
  onDeleteTask: (task: Task) => void;
  onClose: () => void;
  onAddTask: (date: string) => void;
  onAddEvent: () => void;
  onEditEvent: (event: DeviceCalendarEvent) => void;
  onJumpToGoal: (goalNodeId: string | null | undefined) => void;
  onRequestAccess: () => void;
  onOpenSettings: () => void;
}

const addButtonClass =
  'flex items-center gap-1 h-8 px-3 rounded-full bg-primary text-on-primary text-[12px] font-semibold shrink-0';
const emptyClass =
  'bg-surface border border-subtle rounded-2xl p-4 text-center text-content-secondary text-[12px]';

/**
 * The leaflet that opens when a day is tapped in the Month or Week view: that day's calendar events first
 * (tap one to edit or delete it), then the work planned for it. It scrolls, so it can hold as much as the day has.
 */
export default function CalendarDaySheet({
  date,
  todayStr,
  events,
  tasks,
  calendarSupported,
  access,
  sessionHistory,
  stepStatesFor,
  originNamesFor,
  originNamesForEvent,
  goalNodeIdForEvent,
  onToggleDone,
  onToggleStep,
  onDeleteTask,
  onClose,
  onAddTask,
  onAddEvent,
  onEditEvent,
  onJumpToGoal,
  onRequestAccess,
  onOpenSettings,
}: Props) {
  const heading = new Date(date + 'T12:00:00').toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  return (
    <Overlay open onClose={onClose} align="bottom">
      <div className="ios-sheet sheet-up w-full max-w-md mx-auto p-4 pb-[max(1.25rem,env(safe-area-inset-bottom,0px))] min-h-0 flex flex-col gap-3.5">
        <div className="flex flex-col items-center shrink-0 -mt-1 mb-1">
          <div className="w-10 h-1 bg-border-subtle rounded-full opacity-70 mb-2" />
          <h2 className="text-[15px] font-bold text-content-primary">
            {heading}
            {date === todayStr && (
              <span className="ml-2 text-[10px] font-bold uppercase tracking-wider text-primary-glow align-middle">Today</span>
            )}
          </h2>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar flex flex-col [&>*]:shrink-0 gap-5">
          {calendarSupported && access !== 'checking' && (
            <section aria-label="Calendar events">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[14px] font-bold text-content-primary">Calendar events</h3>
                {access === 'granted' && (
                  <button type="button" onClick={onAddEvent} className={addButtonClass}>
                    <Plus size={14} /> Event
                  </button>
                )}
              </div>
              {access === 'granted' ? (
                events.length === 0 ? (
                  <div className={emptyClass}>Nothing on your calendar for this day.</div>
                ) : (
                  <ul className="space-y-2">
                    {events.map((ev) => {
                      // Only events YouDo made for a goal item have a place in the goal tree; plain phone events show none.
                      const originNames = originNamesForEvent(ev);
                      const goalNodeId = originNames.length > 0 ? goalNodeIdForEvent(ev) : null;
                      return (
                      <li key={ev.key}>
                        <button
                          type="button"
                          onClick={() => onEditEvent(ev)}
                          aria-label={`${ev.title || '(No title)'}, ${eventTimeLabel(ev, date)}. Tap to ${ev.writable ? 'edit or delete' : 'view'}`}
                          className="w-full text-left flex gap-3 bg-surface border border-subtle rounded-2xl shadow-card p-3.5"
                        >
                          <span className="w-1 self-stretch rounded-full shrink-0" style={{ backgroundColor: ev.color }} aria-hidden />
                          <div className="min-w-0 flex-1">
                            {originNames.length > 0 && (
                              <div className="mb-1.5">
                                <OriginChip names={originNames} onClick={goalNodeId ? () => onJumpToGoal(goalNodeId) : undefined} />
                              </div>
                            )}
                            <p className="text-[14px] font-bold text-content-primary leading-snug">{ev.title || '(No title)'}</p>
                            <p className="text-[11.5px] text-content-secondary mt-0.5 tabular-nums">{eventTimeLabel(ev, date)}</p>
                            {ev.location && (
                              <p className="flex items-center gap-1 text-[11px] text-content-muted mt-1 min-w-0">
                                <MapPin size={11} className="shrink-0" />
                                <span className="truncate">{ev.location}</span>
                              </p>
                            )}
                          </div>
                          <span className="self-center text-[11px] font-bold text-primary shrink-0">
                            {ev.writable ? 'Edit' : 'View'}
                          </span>
                        </button>
                      </li>
                      );
                    })}
                  </ul>
                )
              ) : (
                <div className="bg-surface border border-subtle rounded-2xl p-4 space-y-3">
                  <p className="text-[12px] text-content-secondary leading-relaxed">
                    {access === 'denied'
                      ? 'Calendar access is turned off for YouDO. Turn it on in Android settings to see and edit your events here.'
                      : 'Show the events from your phone’s calendar here, including your Google calendars.'}
                  </p>
                  <button
                    type="button"
                    onClick={access === 'denied' ? onOpenSettings : onRequestAccess}
                    className="bg-primary text-on-primary text-xs font-semibold rounded-xl px-3.5 py-2"
                  >
                    {access === 'denied' ? 'Open settings' : 'Allow calendar access'}
                  </button>
                </div>
              )}
            </section>
          )}

          <section aria-label="Planned tasks">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[14px] font-bold text-content-primary">Planned tasks</h3>
              <button type="button" onClick={() => onAddTask(date)} className={addButtonClass}>
                <Plus size={14} /> Task
              </button>
            </div>
            {tasks.length === 0 ? (
              <div className={emptyClass}>No tasks planned for this day.</div>
            ) : (
              <div className="space-y-2">
                {tasks.map((task) => {
                  const onDay = taskOccurrenceOnDate(task, date);
                  const occurrence = onDay ?? (task.targetDate ? taskOccurrenceOnDate(task, task.targetDate) : null);
                  if (!occurrence) return null;
                  const completionMode = onDay ? taskCompletionModeOnDate(task, date, sessionHistory[task.id] ?? []) : null;
                  const lastDay = task.endDate && task.targetDate && task.endDate > task.targetDate ? task.endDate : null;
                  const dayNumber = !onDay && task.targetDate ? daysBetweenLocalISO(task.targetDate, date) + 1 : null;
                  const dayCount = lastDay && task.targetDate ? daysBetweenLocalISO(task.targetDate, lastDay) + 1 : null;
                  const tag =
                    occurrence.kind === 'failed'
                      ? ({ label: 'Failed', tone: 'error' } as const)
                      : occurrence.kind === 'backlog-completed'
                        ? ({ label: 'Backlog', tone: 'error' } as const)
                        : completionMode === 'manual'
                          ? ({ label: 'Manual', tone: 'muted' } as const)
                          : completionMode === 'mixed'
                            ? ({ label: 'Mixed', tone: 'primary' } as const)
                            : null;

                  return (
                    <PlannedTaskCard
                      key={task.id}
                      task={task}
                      stepStates={stepStatesFor(task)}
                      originNames={originNamesFor(task)}
                      resolved={occurrence.resolved}
                      tag={tag}
                      subtitle={dayNumber !== null && dayCount !== null ? `Day ${dayNumber} of ${dayCount}` : null}
                      locked={occurrence.kind === 'failed'}
                      deleteLabel={task.goalNodeId ? 'Take off the plan' : 'Delete task'}
                      onToggleDone={(done) => onToggleDone(task.id, done)}
                      onToggleStep={(index) => onToggleStep(task.id, index)}
                      onDelete={() => onDeleteTask(task)}
                      onJumpToGoal={task.goalNodeId ? () => onJumpToGoal(task.goalNodeId) : undefined}
                    />
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </Overlay>
  );
}
