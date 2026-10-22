import { GitFork } from 'lucide-react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { SPRING_FORK_KEY, SPRING_FORK_ON } from '../lib/springFork';
import Toggle from './Toggle';

/** Settings → Preferences row: the Spring Fork master switch. Applies after the app is restarted. */
export default function SpringForkRow() {
  const [stored, setStored] = useLocalStorage<boolean>(SPRING_FORK_KEY, true);
  const on = stored !== false;
  const pending = on !== SPRING_FORK_ON;
  return (
    <div className="settings-data-row p-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="w-9 h-9 rounded-xl bg-primary-soft flex items-center justify-center text-primary shrink-0">
          <GitFork size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-xs font-semibold text-content-primary">Spring Fork</h3>
          <p className="text-[10.5px] text-content-secondary font-medium">
            {pending
              ? 'Close and reopen the app to apply this change.'
              : on
                ? 'On: the fork’s calendar, planning and goal changes.'
                : 'Off: the original app. Calendar sync is idle and your data is left as it is.'}
          </p>
        </div>
      </div>
      <Toggle checked={on} onChange={() => setStored(!on)} label="Spring Fork" />
    </div>
  );
}
