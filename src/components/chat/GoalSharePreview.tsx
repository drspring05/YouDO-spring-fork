import { useMemo, useState } from 'react';
import { Check, ChevronRight } from 'lucide-react';
import Overlay from '../Overlay';
import type { GoalNode } from '../../types';
import { countCompletedDirectChildren, endpointDone } from '../../lib/goalTree';
import { goalShareCountLabel, goalShareStats, goalShareTree, type GoalShare } from '../../lib/goalShare';

interface Props {
  share: GoalShare | null;
  /** The friend's name when they sent it; null for your own share. */
  fromName: string | null;
  saved: boolean;
  error: string;
  onClose: () => void;
  /** Present only on a received share. */
  onSave?: () => void;
}

function Mark({ done, small }: { done: boolean; small?: boolean }) {
  return (
    <span className={`yd-tree-mark ${small ? 'is-step' : ''} ${done ? 'is-done' : ''}`} aria-hidden>
      {done && <Check size={small ? 9 : 11} strokeWidth={3} />}
    </span>
  );
}

/** Read-only outline of a shared goal. Ticks show only when the sender shared progress. */
export default function GoalSharePreview({ share, fromName, saved, error, onClose, onSave }: Props) {
  const tree = useMemo(() => (share ? goalShareTree(share, share.progress) : null), [share]);
  const stats = useMemo(() => (share ? goalShareStats(share) : null), [share]);
  const [open, setOpen] = useState<Set<string>>(() => new Set());

  if (!share || !tree || !stats) return null;
  const progress = share.progress;

  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const renderNode = (node: GoalNode, depth: number) => {
    const expandable = node.children.length > 0 || (node.steps?.length ?? 0) > 0;
    const isOpen = open.has(node.id);
    const done = node.children.length > 0 ? Boolean(node.completed) : endpointDone(node);
    return (
      <li key={node.id}>
        <button
          type="button"
          className="yd-tree-row"
          style={{ paddingLeft: 8 + depth * 18 }}
          onClick={expandable ? () => toggle(node.id) : undefined}
          aria-expanded={expandable ? isOpen : undefined}
          disabled={!expandable}
        >
          <ChevronRight size={14} className={`yd-tree-chev ${expandable ? '' : 'invisible'} ${isOpen ? 'is-open' : ''}`} aria-hidden />
          {progress && <Mark done={done} />}
          <span className="yd-tree-title">{node.title}</span>
          {progress && node.children.length > 0 && (
            <span className="yd-tree-count">
              {countCompletedDirectChildren(node)}/{node.children.length}
            </span>
          )}
        </button>
        {isOpen && (
          <>
            {node.description && (
              <p className="yd-tree-desc" style={{ paddingLeft: 30 + depth * 18 }}>{node.description}</p>
            )}
            {node.steps && node.steps.length > 0 && (
              <ul className="yd-tree-steps">
                {node.steps.map((step, i) => {
                  const stepDone = progress && Boolean(node.stepDone?.[i]);
                  return (
                    <li key={i} className={stepDone ? 'is-done' : ''} style={{ paddingLeft: 30 + depth * 18 }}>
                      <Mark done={stepDone} small />
                      <span>{step}</span>
                    </li>
                  );
                })}
              </ul>
            )}
            {node.children.length > 0 && <ul>{node.children.map((child) => renderNode(child, depth + 1))}</ul>}
          </>
        )}
      </li>
    );
  };

  const summary = [fromName ? `From ${fromName}` : 'You shared this', goalShareCountLabel(stats)];
  if (stats.pct !== null) summary.push(`${stats.pct}% done`);

  return (
    <Overlay open onClose={onClose} align="bottom">
      <div className="ios-sheet sheet-up w-full max-w-md mx-auto p-4 pb-[max(1.25rem,env(safe-area-inset-bottom,0px))] flex flex-col gap-3 max-h-[88vh]">
        <div className="w-10 h-1 bg-border-subtle rounded-full mx-auto -mt-1 mb-1 opacity-70" />
        <div className="px-1">
          <h2 className="text-[17px] font-bold text-content-primary">{tree.title}</h2>
          <p className="text-[12.5px] text-content-secondary mt-0.5">{summary.join(' · ')}</p>
          {tree.description && <p className="text-[12.5px] text-content-secondary mt-2 leading-snug">{tree.description}</p>}
        </div>

        <ul className="yd-tree" aria-label="Goal outline">
          {tree.children.map((child) => renderNode(child, 0))}
          {tree.children.length === 0 &&
            tree.steps?.map((step, i) => (
              <li key={i} className={`yd-tree-step-root ${progress && tree.stepDone?.[i] ? 'is-done' : ''}`}>
                <Mark done={progress && Boolean(tree.stepDone?.[i])} small />
                <span>{step}</span>
              </li>
            ))}
        </ul>

        {error && <p role="alert" className="text-xs text-error font-medium px-1">{error}</p>}

        {onSave && (
          <button
            type="button"
            disabled={saved}
            className="w-full h-12 rounded-2xl bg-primary text-on-primary text-[15px] font-bold disabled:opacity-50 active:scale-[0.98] transition-transform shrink-0"
            onClick={onSave}
          >
            {saved ? 'Saved to your goals' : 'Save to my goals'}
          </button>
        )}
      </div>
    </Overlay>
  );
}
