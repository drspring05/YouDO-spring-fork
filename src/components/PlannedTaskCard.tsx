import { useEffect, useState } from 'react';
import { Check, Trash2 } from 'lucide-react';
import OriginChip from './OriginChip';
import type { Task } from '../types';

interface Props {
  task: Task;
  /** which of the task's steps are done, in the task's own order */
  stepStates: boolean[];
  /** goal name plus the last two branches; empty for a quick task */
  originNames: string[];
  /** the task is finished (or missed) for the day shown, so it is dimmed */
  resolved?: boolean;
  /** shown as a red tag next to the name, e.g. FAILED or BACKLOG */
  tag?: { label: string; tone: 'error' | 'primary' | 'muted' } | null;
  /** small line under the name, e.g. "Day 2 of 5" */
  subtitle?: string | null;
  /** a day that was missed cannot be ticked */
  locked?: boolean;
  /** delete a quick task, or take a goal item's task off the plan */
  deleteLabel: string;
  onToggleDone: (done: boolean) => void;
  onToggleStep: (index: number) => void;
  onDelete: () => void;
  onJumpToGoal?: () => void;
}

const tagClass = {
  error: 'bg-error-soft text-error border-error/20',
  primary: 'bg-primary-soft text-primary border-primary/20',
  muted: 'bg-surface text-content-muted border-subtle',
} as const;

/**
 * One planned task, editable in place: a checkbox in front of its name (it ticks every step), steps that
 * toggle when tapped, and a small delete button. Used in the calendar's day leaflet and the Upcoming list.
 */
export default function PlannedTaskCard({
  task,
  stepStates,
  originNames,
  resolved = false,
  tag,
  subtitle,
  locked = false,
  deleteLabel,
  onToggleDone,
  onToggleStep,
  onDelete,
  onJumpToGoal,
}: Props) {
  const hasSteps = task.steps.length > 0;
  const total = hasSteps ? task.steps.length : 1;
  const doneCount = hasSteps ? stepStates.filter(Boolean).length : Math.min(task.progress, 1);
  const complete = doneCount >= total;
  const [confirming, setConfirming] = useState(false);

  // The delete button asks for a second tap; it goes back to normal if that does not come.
  useEffect(() => {
    if (!confirming) return;
    const timer = window.setTimeout(() => setConfirming(false), 3000);
    return () => window.clearTimeout(timer);
  }, [confirming]);

  return (
    <div
      className={`bg-surface border border-subtle rounded-2xl shadow-card p-3.5 select-none ${resolved && !complete ? 'opacity-60' : ''}`}
    >
      {originNames.length > 0 && (
        <div className="mb-1.5">
          <OriginChip names={originNames} onClick={onJumpToGoal} />
        </div>
      )}

      <div className="flex items-start gap-2.5">
        <button
          type="button"
          role="checkbox"
          aria-checked={complete}
          aria-label={complete ? `Mark ${task.title} as not done` : `Mark ${task.title} as done`}
          disabled={locked}
          onClick={() => onToggleDone(!complete)}
          className={`mt-[1px] w-[22px] h-[22px] rounded-full border-2 grid place-items-center shrink-0 transition-colors disabled:opacity-40 ${
            complete ? 'bg-secondary border-secondary text-on-primary' : 'border-content-muted/60 text-transparent'
          }`}
          style={!complete && task.color ? { borderColor: task.color } : undefined}
        >
          <Check size={13} strokeWidth={3.2} />
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h4
              className={`text-[14.5px] font-bold leading-snug tracking-tight ${
                complete || resolved ? 'line-through text-content-muted' : 'text-content-primary'
              }`}
            >
              {task.title}
            </h4>
            {tag && (
              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${tagClass[tag.tone]}`}>
                {tag.label}
              </span>
            )}
          </div>
          {subtitle && <p className="text-[11px] text-content-muted mt-0.5">{subtitle}</p>}
          {task.description && (
            <p className="text-[11.5px] text-content-secondary/80 line-clamp-2 mt-1">{task.description}</p>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[12px] font-bold tabular-nums text-content-secondary">
            {doneCount}/{total}
          </span>
          <button
            type="button"
            aria-label={confirming ? `Tap again to confirm: ${deleteLabel}` : deleteLabel}
            title={deleteLabel}
            onClick={() => {
              if (confirming) {
                setConfirming(false);
                onDelete();
              } else {
                setConfirming(true);
              }
            }}
            className={`h-7 rounded-lg grid place-items-center transition-colors ${
              confirming ? 'px-2 bg-error text-white text-[10px] font-bold' : 'w-7 text-content-muted hover:text-error'
            }`}
          >
            {confirming ? 'Confirm' : <Trash2 size={14} />}
          </button>
        </div>
      </div>

      <div className="mt-2 h-1.5 rounded-full bg-border-subtle overflow-hidden">
        <div
          className="h-full bg-secondary progress-bar-fill rounded-full"
          style={{ width: `${Math.min(100, (doneCount / total) * 100)}%` }}
        />
      </div>

      {hasSteps && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {task.steps.map((step, idx) => {
            const done = Boolean(stepStates[idx]);
            return (
              <button
                key={idx}
                type="button"
                disabled={locked}
                aria-pressed={done}
                onClick={() => onToggleStep(idx)}
                className={`text-[11px] px-2.5 py-1 rounded-md font-medium text-left disabled:opacity-60 ${
                  done
                    ? 'bg-secondary/10 text-secondary border border-secondary/20 line-through'
                    : 'bg-surface text-content-secondary border border-subtle'
                }`}
              >
                {done ? '✓ ' : ''}
                {step}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
