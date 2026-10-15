import Overlay from './Overlay';
import type { Task } from '../types';

interface Props {
  /** Tasks whose phone-calendar event was deleted. Only the first is shown at a time. */
  tasks: Task[];
  onDeleteTask: (taskId: string) => void;
  onKeepTask: (taskId: string) => void;
  onLater: (taskId: string) => void;
}

/** Asked when an event was deleted in the Calendar app: delete the task here too, or keep it. */
export default function CalendarEventGonePrompt({ tasks, onDeleteTask, onKeepTask, onLater }: Props) {
  const task = tasks[0];
  if (!task) return null;
  const more = tasks.length - 1;
  return (
    <Overlay open onClose={() => onLater(task.id)} align="center">
      <div className="panel sheet-up p-5 space-y-4" role="alertdialog" aria-label="Calendar event deleted">
        <div className="space-y-1.5">
          <h3 className="text-[15px] font-bold text-content-primary">Deleted from your calendar</h3>
          <p className="text-[13px] text-content-secondary leading-relaxed">
            The calendar event for <span className="font-semibold text-content-primary">“{task.title}”</span> was deleted. Delete the task
            here too, or keep it without a calendar event?
          </p>
          {more > 0 && <p className="text-[11.5px] text-content-muted">{more} more to go after this one.</p>}
        </div>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => onDeleteTask(task.id)}
            className="w-full h-11 rounded-2xl text-[13px] font-bold bg-error-soft text-error border border-error/20"
          >
            Delete task
          </button>
          <button
            type="button"
            onClick={() => onKeepTask(task.id)}
            className="w-full h-11 rounded-2xl text-[13px] font-bold bg-primary text-on-primary"
          >
            Keep task
          </button>
          <button
            type="button"
            onClick={() => onLater(task.id)}
            className="w-full h-9 rounded-2xl text-[12px] font-semibold text-content-secondary"
          >
            Ask me later
          </button>
        </div>
      </div>
    </Overlay>
  );
}
