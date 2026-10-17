import { Target } from 'lucide-react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { GOAL_REMEMBER_POSITION_KEY } from '../lib/goalNavPrefs';
import Toggle from './Toggle';

/** Settings → Preferences row: should the Goals tab reopen where you left it after a tab switch. On unless switched off. */
export default function GoalPositionRow() {
  const [stored, setStored] = useLocalStorage<boolean>(GOAL_REMEMBER_POSITION_KEY, true);
  const on = stored !== false;
  return (
    <div className="settings-data-row p-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="w-9 h-9 rounded-xl bg-primary-soft flex items-center justify-center text-primary shrink-0">
          <Target size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-xs font-semibold text-content-primary">Remember Goals position</h3>
          <p className="text-[10.5px] text-content-secondary font-medium">
            {on
              ? 'Switching to another tab and back keeps you where you were in Goals.'
              : 'Off: Goals always opens at the top level.'}
          </p>
        </div>
      </div>
      <Toggle checked={on} onChange={() => setStored(!on)} label="Remember Goals position" />
    </div>
  );
}
