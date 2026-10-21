import { useMemo } from 'react';
import { Check, Target } from 'lucide-react';
import { goalShareCountLabel, goalShareStats, type GoalShare } from '../../lib/goalShare';

interface Props {
  /** null when the shared goal couldn't be read. */
  share: GoalShare | null;
  /** The friend's name on a received card; null on your own. */
  fromName: string | null;
  saved: boolean;
  onView: () => void;
  /** Present only on a received card. */
  onSave?: () => void;
}

/** A goal shared in a DM: title, size, the sender's progress if shared, View and Save. */
export default function GoalShareCard({ share, fromName, saved, onView, onSave }: Props) {
  const stats = useMemo(() => (share ? goalShareStats(share) : null), [share]);

  return (
    <div className="yd-goal-card">
      <p className="yd-goal-kicker">Shared goal</p>
      {!share || !stats ? (
        <p className="yd-goal-meta">This goal can't be opened.</p>
      ) : (
        <>
          <div className="yd-goal-head">
            <span className="yd-goal-icon" aria-hidden>
              <Target size={19} />
            </span>
            <div className="min-w-0">
              <p className="yd-goal-title">{share.goal.title}</p>
              <p className="yd-goal-meta">{goalShareCountLabel(stats)}</p>
            </div>
          </div>
          {stats.pct !== null && (
            <>
              <div className="yd-goal-bar" role="progressbar" aria-valuenow={stats.pct} aria-valuemin={0} aria-valuemax={100}>
                <i style={{ width: `${stats.pct}%` }} />
              </div>
              <p className="yd-goal-progress">
                <span>{fromName ? `${fromName}'s progress` : 'Your progress'}</span>
                <span>{stats.pct}%</span>
              </p>
            </>
          )}
          <div className="yd-goal-actions">
            <button type="button" className="yd-goal-btn" onClick={onView}>
              View
            </button>
            {onSave &&
              (saved ? (
                <span className="yd-goal-btn is-saved">
                  Saved <Check size={14} aria-hidden />
                </span>
              ) : (
                <button type="button" className="yd-goal-btn is-primary" onClick={onSave}>
                  Save a copy
                </button>
              ))}
          </div>
        </>
      )}
    </div>
  );
}
