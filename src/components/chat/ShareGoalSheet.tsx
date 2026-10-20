import { useMemo, useState } from 'react';
import Overlay from '../Overlay';
import Toggle from '../Toggle';
import type { GoalNode } from '../../types';
import { buildGoalShare, goalShareCountLabel, goalShareStats } from '../../lib/goalShare';

interface Props {
  open: boolean;
  goals: GoalNode[];
  friendName: string;
  onClose: () => void;
  onShare: (goalId: string, withProgress: boolean) => void;
}

/** Pick one of your goals to send in a DM, with or without your progress. */
export default function ShareGoalSheet({ open, goals, friendName, onClose, onShare }: Props) {
  const [picked, setPicked] = useState<string | null>(null);
  const [withProgress, setWithProgress] = useState(false);

  const rows = useMemo(
    () => (open ? goals.map((goal) => ({ goal, stats: goalShareStats(buildGoalShare(goal, true)) })) : []),
    [open, goals],
  );
  const selected = rows.some((row) => row.goal.id === picked) ? picked : null;

  if (!open) return null;

  return (
    <Overlay open={open} onClose={onClose} align="bottom">
      <div className="ios-sheet sheet-up w-full max-w-md mx-auto p-4 pb-[max(1.25rem,env(safe-area-inset-bottom,0px))] flex flex-col gap-3">
        <div className="w-10 h-1 bg-border-subtle rounded-full mx-auto -mt-1 mb-1 opacity-70" />
        <div className="px-1">
          <h2 className="text-[17px] font-bold text-content-primary">Share a goal</h2>
          <p className="text-[12.5px] text-content-secondary mt-0.5">{friendName} can view it and save a copy.</p>
        </div>

        {rows.length === 0 ? (
          <p className="text-[13px] text-content-secondary bg-surface border border-subtle rounded-2xl p-4 text-center">
            Create a goal first.
          </p>
        ) : (
          <div className="yd-share-goals" role="radiogroup" aria-label="Goal to share">
            {rows.map(({ goal, stats }) => (
              <button
                key={goal.id}
                type="button"
                role="radio"
                aria-checked={selected === goal.id}
                className={`yd-share-goal ${selected === goal.id ? 'is-on' : ''}`}
                onClick={() => setPicked(goal.id)}
              >
                <span className="yd-share-radio" aria-hidden />
                <span className="min-w-0 flex-1 text-left">
                  <span className="yd-share-goal-title">{goal.title}</span>
                  <span className="yd-share-goal-meta">{goalShareCountLabel(stats)}</span>
                </span>
                {stats.pct ? <span className="yd-share-goal-pct">{stats.pct}%</span> : null}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between gap-3 bg-surface border border-subtle rounded-2xl p-3">
          <div className="min-w-0">
            <p className="text-[14px] font-medium text-content-primary">Show my progress</p>
            <p className="text-[11.5px] text-content-secondary mt-0.5">{friendName}'s copy always starts fresh</p>
          </div>
          <Toggle checked={withProgress} onChange={() => setWithProgress(!withProgress)} label="Show my progress" />
        </div>

        <p className="text-[11.5px] text-content-muted text-center">They can save it within 24 hours, like every message.</p>

        <button
          type="button"
          disabled={!selected}
          className="w-full h-12 rounded-2xl bg-primary text-on-primary text-[15px] font-bold disabled:opacity-40 active:scale-[0.98] transition-transform"
          onClick={() => {
            if (!selected) return;
            onShare(selected, withProgress);
            setPicked(null);
            setWithProgress(false);
          }}
        >
          Share goal
        </button>
      </div>
    </Overlay>
  );
}
