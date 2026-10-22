import { useEffect, useRef, useState } from 'react';
import { TITLE_MAX, isTitleTooLong } from '../lib/titleLimit';
import TitleCounter from './TitleCounter';
import { Trash2 } from 'lucide-react';
import type { GoalNode } from '../types';
import { uid, useStore } from '../store';
import Overlay from './Overlay';
import EventColorPicker from './EventColorPicker';
import Toggle from './Toggle';
import { branchIdsInside, goalShowsAsEvent, hasEventAncestor } from '../lib/goalCalendar';
import { findPathToNode } from '../lib/goalTree';

interface Props {
  open: boolean;
  parentId: string | null;
  editing?: GoalNode | null;
  onClose: () => void;
  onAddRoot: (node: GoalNode) => void;
  onAddChild: (parentId: string, node: GoalNode) => void;
  onUpdateNode: (id: string, patch: (n: GoalNode) => GoalNode) => void;
  onDeleteNode: (id: string) => void;
}

export default function AddGoalSheet({
  open, parentId, editing, onClose, onAddRoot, onAddChild, onUpdateNode, onDeleteNode,
}: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [color, setColor] = useState<string | null>(null);
  const [showAsEvent, setShowAsEvent] = useState(false);
  const [inside, setInside] = useState<'none' | 'next' | 'all'>('none');
  const { goals } = useStore();
  const titleRef = useRef<HTMLInputElement>(null);

  const isEditing = !!editing;
  const isRootGoal = !editing && !parentId;
  const canToggleEvent = Boolean(parentId) || Boolean(editing && editing.kind !== 'goal');
  const hasChildren = Boolean(editing && editing.children.length > 0);
  const aboveItem = editing ? findPathToNode(goals, editing.id).slice(0, -1) : parentId ? findPathToNode(goals, parentId) : [];
  const showHint = canToggleEvent && !showAsEvent && !hasChildren && Boolean(startDate) && !hasEventAncestor(aboveItem);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setTitle(editing.title);
      setDescription(editing.description ?? '');
      setStartDate(editing.startDate ?? '');
      setEndDate(editing.endDate ?? '');
      setShowAsEvent(goalShowsAsEvent(editing));
    } else {
      setTitle('');
      setDescription('');
      setStartDate('');
      setEndDate('');
      setShowAsEvent(false);
    }
    setInside('none');
    setColor(null);
    // Keyboard opens automatically only when ADDING; editing an existing item waits for a tap.
    if (editing) return;
    const t = setTimeout(() => titleRef.current?.focus(), 120);
    return () => clearTimeout(t);
  }, [open, parentId, editing]);

  if (!open) return null;

  const submit = () => {
    if (!title.trim() || isTitleTooLong(title)) return;
    if (isEditing && editing) {
      onUpdateNode(editing.id, (n) => ({
        ...n,
        title: title.trim(),
        description: description.trim() || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        ...(canToggleEvent ? { showAsEvent } : {}),
      }));
      if (hasChildren && showAsEvent && inside !== 'none') {
        for (const id of branchIdsInside(editing, inside)) onUpdateNode(id, (n) => ({ ...n, showAsEvent: true }));
      }
    } else {
      const node: GoalNode = {
        id: uid('goal'),
        kind: parentId ? 'node' : 'goal',
        title: title.trim(),
        description: description.trim() || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        ...(parentId ? { showAsEvent } : {}),
        ...(parentId && color ? { color } : {}),
        completed: false,
        createdAt: Date.now(),
        children: [],
      };
      if (parentId) onAddChild(parentId, node);
      else onAddRoot(node);
    }
    onClose();
  };

  const getHeaderTitle = () => {
    if (isEditing) return `Edit ${editing?.kind === 'goal' ? 'goal' : 'item'}`;
    if (isRootGoal) return 'New Goal';
    return 'Add item';
  };

  return (
    <Overlay open={open} onClose={onClose} align="bottom">
      <div className="ios-sheet sheet-up w-full max-w-md mx-auto p-4 pb-[max(1.25rem,env(safe-area-inset-bottom,0px))] min-h-0 flex flex-col gap-3">
        {/* Header */}
        <div className="flex flex-col items-center shrink-0 -mt-1 mb-1">
          <div className="w-10 h-1 bg-border-subtle rounded-full opacity-70 mb-2" />
          <h2 className="text-[15px] font-bold text-content-primary">{getHeaderTitle()}</h2>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar flex flex-col [&>*]:shrink-0 gap-3.5">
          {/* Main Info Card */}
          <div className="bg-surface border border-subtle rounded-2xl overflow-hidden shadow-sm">
            <div className="relative">
            <input
              ref={titleRef}
              value={title}
              maxLength={Math.max(TITLE_MAX, title.length)}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              placeholder={isRootGoal ? 'Name the outcome you want' : 'Name this part of your plan'}
              className="w-full h-12 px-3.5 bg-transparent text-[14px] font-semibold text-content-primary placeholder:text-content-muted outline-none border-b border-subtle pr-14"
            />
            <TitleCounter value={title} className="absolute right-3.5 top-1/2 -translate-y-1/2" />
            </div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Details (optional). Keep the name short and put the rest here…"
              rows={2}
              className="w-full bg-transparent px-3.5 py-2.5 text-[13px] font-medium text-content-primary placeholder:text-content-muted outline-none resize-none"
            />
          </div>

          {/* Dates Card */}
          <div className="bg-surface border border-subtle rounded-2xl overflow-hidden shadow-sm flex divide-x divide-subtle">
            <div className="flex-1 p-2">
              <label className="px-1.5 text-[10px] font-bold uppercase tracking-wider text-content-muted block mb-1.5">Start date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full h-10 px-2.5 bg-elevated border border-subtle rounded-xl text-[13px] font-medium text-content-primary outline-none focus:border-primary transition-colors"
              />
            </div>
            <div className="flex-1 p-2">
              <label className="px-1.5 text-[10px] font-bold uppercase tracking-wider text-content-muted block mb-1.5">End date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={`w-full h-10 px-2.5 bg-elevated border border-subtle rounded-xl text-[13px] font-medium text-content-primary outline-none focus:border-primary transition-colors`}
              />
            </div>
          </div>

          {/* Show on the calendar as its own bar */}
          {canToggleEvent && (
            <div className="bg-surface border border-subtle rounded-2xl shadow-sm flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-content-primary">Show as event in calendar</p>
                <p className="text-[11px] text-content-muted">Adds a colored bar for this item's dates.</p>
              </div>
              <Toggle checked={showAsEvent} onChange={() => setShowAsEvent((v) => !v)} label="Show as event in calendar" />
            </div>
          )}

          {canToggleEvent && hasChildren && showAsEvent && (
            <div className="bg-surface border border-subtle rounded-2xl shadow-sm px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-content-muted mb-2">Also turn on items inside</p>
              <div className="flex gap-1.5">
                {([['none', 'None'], ['next', 'Next level'], ['all', 'All levels']] as const).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setInside(key)}
                    className={`flex-1 h-9 rounded-xl text-[12px] font-semibold border ${inside === key ? 'bg-primary text-on-primary border-primary' : 'bg-elevated text-content-secondary border-subtle'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-[11px] text-content-muted">Only items that have items of their own become bars. Lowest tasks stay bullets.</p>
            </div>
          )}

          {showHint && (
            <p className="px-1 text-[11px] text-content-muted">Not on the calendar yet: turn on an event above this item to see it as a bullet.</p>
          )}

          {/* Color for a new item on the calendar */}
          {!isEditing && parentId && <EventColorPicker value={color} onChange={setColor} label="Calendar color" />}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center gap-2 mt-1 shrink-0">
          {isEditing && editing && (
            <button
              type="button"
              onClick={() => { onDeleteNode(editing.id); onClose(); }}
              className="h-11 px-3.5 rounded-xl text-[12px] font-bold text-error bg-error-soft/60 hover:bg-error-soft border border-error/20 transition-colors flex items-center justify-center gap-1.5 shrink-0"
              title="Delete node"
            >
              <Trash2 size={14} />
              <span>Delete</span>
            </button>
          )}
          <button
            type="button"
            onClick={submit}
            disabled={!title.trim() || isTitleTooLong(title)}
            className="flex-1 h-11 rounded-xl text-[13px] font-bold bg-primary text-on-primary disabled:opacity-40 transition-opacity flex items-center justify-center shadow-sm"
          >
            {isEditing ? 'Save changes' : parentId ? 'Add item' : 'Create goal'}
          </button>
        </div>
      </div>
    </Overlay>
  );
}
