import { useEffect, useState } from 'react';
import { Check, X, Zap } from 'lucide-react';
import type { GoalNode } from '../types';
import { todayISO, tomorrowISO, useStore } from '../store';
import Overlay from './Overlay';
import EventColorPicker from './EventColorPicker';
import ScrollWheel from './ScrollWheel';
import { sameColor } from '../lib/eventColors';
import {
  dayRange,
  inDayRange,
  isSingleDay,
  nodeStepDates,
  stepDateAfterWheel,
  wheelPositions,
  type DayRange,
  type WheelMonth,
} from '../lib/stepDates';

const WHEEL_PLACEHOLDER = '—';

const totalStepsExistForHint = (nodes: GoalNode[]) => nodes.some((n) => (n.steps?.length ?? 0) > 0);

/** "Oct", or "Dec 26" when the timeframe runs across a new year and the year helps tell months apart. */
function monthLabel(month: WheelMonth, months: WheelMonth[]): string {
  const short = new Date(month.year, month.month, 1).toLocaleDateString(undefined, { month: 'short' });
  return months.some((m) => m.year !== months[0].year) ? `${short} ${String(month.year).slice(2)}` : short;
}

export interface NodePlan {
  nodeId: string;
  stepSlice?: number[];
}

interface Props {
  open: boolean;
  nodes?: GoalNode[];
  node?: GoalNode | null;
  onClose: () => void;
  onConfirm: (plans: NodePlan[], targetDate: string) => void;
}

export default function StepSliceSheet({ open, nodes, node, onClose, onConfirm }: Props) {
  const { updateGoalNode } = useStore();
  const targetNodes = nodes && nodes.length > 0 ? nodes : node ? [node] : [];
  // Map of nodeId -> Set of selected step indices
  const [selectedMap, setSelectedMap] = useState<Record<string, Set<number>>>({});
  const [date, setDate] = useState(todayISO());
  /** Last day of the timeframe. Empty (or not after the start day) means a one-day task. */
  const [endDate, setEndDate] = useState('');
  const [color, setColor] = useState<string | null>(null);
  /** Day chosen for a step with the month and day wheels: item id -> step index -> "YYYY-MM-DD". Untouched steps have none. */
  const [stepDateMap, setStepDateMap] = useState<Record<string, Record<number, string>>>({});

  useEffect(() => {
    if (open && targetNodes.length > 0) {
      const initialMap: Record<string, Set<number>> = {};
      for (const n of targetNodes) {
        if (n.steps && n.steps.length > 0) {
          const stepDone = n.stepDone ?? [];
          const remaining = n.steps.map((_, i) => i).filter((i) => !stepDone[i]);
          initialMap[n.id] = new Set(remaining.length ? remaining : n.steps.map((_, i) => i));
        } else {
          initialMap[n.id] = new Set();
        }
      }
      const targetKey = targetNodes.map((n) => n.id).join('|');
      if (!targetKey) return;
      setSelectedMap(initialMap);
      // Replanning starts from the days already chosen for the steps.
      const initialDates: Record<string, Record<number, string>> = {};
      for (const n of targetNodes) {
        const saved: Record<number, string> = {};
        nodeStepDates(n).forEach((stepDate, i) => {
          if (stepDate) saved[i] = stepDate;
        });
        initialDates[n.id] = saved;
      }
      setStepDateMap(initialDates);
      // Replanning an item keeps its current timeframe (moved up to today if it already started in the past).
      const only = targetNodes.length === 1 ? targetNodes[0] : null;
      const keptStart = only?.startDate && only.startDate > todayISO() ? only.startDate : todayISO();
      setDate(keptStart);
      setEndDate(only?.endDate && only.endDate > keptStart ? only.endDate : '');
      setColor(targetNodes.length === 1 ? (targetNodes[0].color ?? null) : null);
    }
    // Open + node identity is enough; targetNodes is derived from nodes/node.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, nodes, node]);

  if (!open || targetNodes.length === 0) return null;

  const isMulti = targetNodes.length > 1;

  const toggleStep = (nodeId: string, i: number) => {
    setSelectedMap((prev) => {
      const cur = new Set(prev[nodeId] ?? []);
      if (cur.has(i)) cur.delete(i);
      else cur.add(i);
      return { ...prev, [nodeId]: cur };
    });
  };

  const selectAll = (n: GoalNode) => {
    const steps = n.steps ?? [];
    setSelectedMap((prev) => ({
      ...prev,
      [n.id]: new Set(steps.map((_, i) => i)),
    }));
  };

  const deselectAll = (n: GoalNode) => {
    setSelectedMap((prev) => ({
      ...prev,
      [n.id]: new Set(),
    }));
  };

  const isSingle = targetNodes.length === 1;
  const effectiveEnd = endDate && endDate >= date ? endDate : '';
  /** The days this plan covers; a step's own day has to sit inside it. */
  const range: DayRange = dayRange(date, effectiveEnd);
  const canDateSteps = !isSingleDay(range);
  /** The day chosen for a step, or null when it has none (or the timeframe moved away from it). */
  const stepDateOf = (nodeId: string, i: number): string | null => {
    const chosen = stepDateMap[nodeId]?.[i];
    return chosen && inDayRange(chosen, range) ? chosen : null;
  };
  const setStepDate = (nodeId: string, i: number, value: string | null) => {
    setStepDateMap((prev) => {
      const forNode = { ...(prev[nodeId] ?? {}) };
      if (value) forNode[i] = value;
      else delete forNode[i];
      return { ...prev, [nodeId]: forNode };
    });
  };

  /** Today / Tomorrow set both the start and the end to that day. */
  const pickDay = (iso: string) => {
    setDate(iso);
    setEndDate(iso);
  };
  const changeStart = (iso: string) => {
    if (!iso) return;
    setDate(iso);
    if (endDate && endDate < iso) setEndDate(iso);
  };

  const confirm = () => {
    if (targetNodes.some((n) => n.steps?.length && !selectedMap[n.id]?.size)) return;
    // The timeframe (and color) is saved on the item itself. An empty End means a one-day task.
    for (const item of targetNodes) {
      const colorChanged = isSingle && color !== null && !sameColor(color, item.color);
      const chosenColor = color;
      // A step's own day is kept only for steps in this plan and only inside the timeframe; done steps keep theirs.
      const itemSteps = item.steps ?? [];
      const savedDates = nodeStepDates(item);
      const chosenSlice = selectedMap[item.id] ?? new Set<number>();
      const nextStepDates = itemSteps.map((_, i) => {
        if (item.stepDone?.[i]) return savedDates[i];
        return chosenSlice.has(i) ? stepDateOf(item.id, i) : null;
      });
      updateGoalNode(item.id, (current) => ({
        ...current,
        startDate: date,
        endDate: effectiveEnd || undefined,
        stepDates: nextStepDates.some(Boolean) ? nextStepDates : undefined,
        ...(colorChanged && chosenColor ? { color: chosenColor } : {}),
      }));
    }
    const plans: NodePlan[] = targetNodes.map((n) => {
      const steps = n.steps ?? [];
      if (steps.length > 0) {
        const set = selectedMap[n.id] ?? new Set();
        const slice = [...set].sort((a, b) => a - b);
        return { nodeId: n.id, stepSlice: slice };
      }
      return { nodeId: n.id, stepSlice: undefined };
    });
    onConfirm(plans, date);
    onClose();
  };

  // Calculate total steps assigned
  let totalAssignedSteps = 0;
  let totalStepsExist = 0;
  for (const n of targetNodes) {
    const count = n.steps?.length ?? 0;
    totalStepsExist += count;
    if (count > 0) {
      totalAssignedSteps += (selectedMap[n.id]?.size ?? 0);
    }
  }
  const canSchedule = targetNodes.every((n) => !n.steps?.length || (selectedMap[n.id]?.size ?? 0) > 0);

  return (
    <Overlay open={open} onClose={onClose} align="bottom">
      <div className="ios-sheet sheet-up w-full max-w-md mx-auto p-4 pb-[max(1.25rem,env(safe-area-inset-bottom,0px))] min-h-0 flex flex-col gap-3">
        {/* Grab Handle */}
        <div className="w-10 h-1 bg-border-subtle rounded-full mx-auto -mt-1 mb-1 opacity-70 shrink-0" />

        {/* Header */}
        <div className="flex items-center gap-2.5 px-1 shrink-0">
          <div className="w-8 h-8 rounded-xl bg-primary-soft text-primary grid place-items-center shrink-0">
            <Zap size={16} />
          </div>
          <div>
            <h3 className="text-[14px] font-bold text-content-primary leading-tight">
              {isMulti ? `Plan ${targetNodes.length} Tasks` : 'Plan Task'}
            </h3>
            <p className="text-[11px] font-medium text-content-muted leading-tight mt-0.5">
              Choose steps for this date
            </p>
          </div>
        </div>

        {/* Date picker Section */}
        <div className="bg-surface border border-subtle rounded-2xl p-4 shadow-sm shrink-0 flex flex-col gap-3">
          <div className="flex items-center gap-1.5 p-1 bg-elevated border border-subtle rounded-xl">
            <button
              type="button"
              onClick={() => pickDay(todayISO())}
              className={`flex-1 h-8 rounded-lg text-[12px] font-bold transition-colors ${
                date === todayISO()
                  ? 'bg-primary text-on-primary shadow-sm'
                  : 'text-content-secondary hover:text-content-primary'
              }`}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => pickDay(tomorrowISO())}
              className={`flex-1 h-8 rounded-lg text-[12px] font-bold transition-colors ${
                date === tomorrowISO()
                  ? 'bg-primary text-on-primary shadow-sm'
                  : 'text-content-secondary hover:text-content-primary'
              }`}
            >
              Tomorrow
            </button>
          </div>

          <div className="flex gap-2">
            <div className="flex-1 min-w-0 flex flex-col gap-1">
              <label htmlFor="plan-start" className="px-1 text-[10px] font-bold uppercase tracking-wider text-content-muted">
                Start
              </label>
              <input
                id="plan-start"
                type="date"
                value={date}
                onChange={(e) => changeStart(e.target.value)}
                className="w-full h-10 px-2.5 bg-elevated border border-subtle rounded-xl text-[13px] font-medium text-content-primary outline-none focus:border-primary transition-colors"
              />
            </div>
            <div className="flex-1 min-w-0 flex flex-col gap-1">
              <div className="flex items-center justify-between px-1">
                <label htmlFor="plan-end" className="text-[10px] font-bold uppercase tracking-wider text-content-muted">
                  End (optional)
                </label>
                {effectiveEnd && (
                  <button type="button" onClick={() => setEndDate('')} className="text-[10px] font-bold uppercase text-content-secondary">
                    Clear
                  </button>
                )}
              </div>
              <input
                id="plan-end"
                type="date"
                min={date}
                value={effectiveEnd}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full h-10 px-2.5 bg-elevated border border-subtle rounded-xl text-[13px] font-medium text-content-primary outline-none focus:border-primary transition-colors"
              />
            </div>
          </div>
          <p className="text-[11px] text-content-muted leading-snug px-1">
            Leave End empty for a one-day task.
          </p>
        </div>

        {isSingle && <EventColorPicker value={color} onChange={setColor} label="Calendar color" />}

        {canDateSteps && totalStepsExistForHint(targetNodes) && (
          <p className="text-[11px] text-content-muted leading-snug px-2 -mb-1 shrink-0">
            Optional: scroll the month and day next to a step to plan it for its own day. A step left as — follows the task.
          </p>
        )}

        {/* Task Steps Lists */}
        <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar flex flex-col [&>*]:shrink-0 gap-3">
          {targetNodes.map((n) => {
            const steps = n.steps ?? [];
            const stepDone = n.stepDone ?? [];
            const selSet = selectedMap[n.id] ?? new Set();

            if (steps.length === 0) {
              return (
                <div key={n.id} className="bg-surface border border-subtle rounded-2xl p-3.5 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[13px] font-bold text-content-primary truncate">{n.title}</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-content-muted shrink-0">No steps</span>
                  </div>
                </div>
              );
            }

            return (
              <div key={n.id} className="bg-surface border border-subtle rounded-2xl overflow-hidden shadow-sm flex flex-col">
                <div className="flex items-center justify-between px-3.5 h-10 bg-elevated/40 border-b border-subtle">
                  <h4 className="text-[12px] font-bold text-content-primary truncate">{n.title}</h4>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => selectAll(n)} className="text-[11px] font-bold text-primary hover:underline">All</button>
                    <span className="text-[10px] text-content-muted">·</span>
                    <button onClick={() => deselectAll(n)} className="text-[11px] font-bold text-content-secondary hover:text-content-primary">None</button>
                  </div>
                </div>

                <div className="divide-y divide-subtle">
                  {steps.map((s, i) => {
                    const alreadyDone = stepDone[i];
                    const isSel = selSet.has(i);
                    const chosenDate = stepDateOf(n.id, i);
                    const showWheels = canDateSteps && isSel && !alreadyDone;
                    const { monthPos, dayPos, months, days } = wheelPositions(chosenDate, range);
                    const monthItems = [WHEEL_PLACEHOLDER, ...months.map((m) => monthLabel(m, months))];
                    const dayItems = [WHEEL_PLACEHOLDER, ...days.map(String)];
                    return (
                      <div
                        key={i}
                        className={`w-full flex items-center gap-2 pr-2.5 min-h-[44px] transition-colors ${
                          alreadyDone
                            ? 'bg-elevated/50 opacity-60'
                            : isSel
                              ? 'bg-primary-soft/30'
                              : ''
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => !alreadyDone && toggleStep(n.id, i)}
                          disabled={alreadyDone}
                          className={`flex-1 min-w-0 flex items-center gap-3 pl-3.5 h-11 text-left transition-colors ${
                            alreadyDone ? 'cursor-not-allowed' : isSel ? 'hover:bg-primary-soft/50' : 'hover:bg-elevated'
                          }`}
                        >
                          <div className="shrink-0">
                            {alreadyDone ? (
                              <div className="w-5 h-5 rounded-full bg-secondary text-on-primary flex items-center justify-center">
                                <Check size={14} strokeWidth={3} />
                              </div>
                            ) : isSel ? (
                              <div className="w-5 h-5 rounded-full bg-primary text-on-primary flex items-center justify-center">
                                <Check size={14} strokeWidth={3} />
                              </div>
                            ) : (
                              <div className="w-5 h-5 rounded-full border-[2px] border-content-muted" />
                            )}
                          </div>
                          <span className={`flex-1 text-[13px] font-semibold truncate ${alreadyDone ? 'text-content-muted line-through' : 'text-content-primary'}`}>
                            {s}
                          </span>
                          {alreadyDone && <span className="text-[10px] font-bold uppercase tracking-wider text-secondary shrink-0 ml-2">Done</span>}
                        </button>
                        {showWheels && (
                          <div className="flex items-center gap-1 shrink-0" role="group" aria-label={`Day for step ${i + 1}`}>
                            <div className="w-[52px]">
                              <ScrollWheel
                                label={`Month for step ${i + 1}`}
                                items={monthItems}
                                index={monthPos}
                                muted={!chosenDate}
                                onIndexChange={(pos) => setStepDate(n.id, i, stepDateAfterWheel(chosenDate, range, 'month', pos))}
                              />
                            </div>
                            <div className="w-[40px]">
                              <ScrollWheel
                                label={`Day for step ${i + 1}`}
                                items={dayItems}
                                index={dayPos}
                                muted={!chosenDate}
                                onIndexChange={(pos) => setStepDate(n.id, i, stepDateAfterWheel(chosenDate, range, 'day', pos))}
                              />
                            </div>
                            <button
                              type="button"
                              aria-label={`Clear the day for step ${i + 1}`}
                              disabled={!chosenDate}
                              onClick={() => setStepDate(n.id, i, null)}
                              className="w-6 h-6 rounded-full grid place-items-center text-content-muted hover:text-content-primary disabled:opacity-0 transition-opacity"
                            >
                              <X size={13} strokeWidth={2.6} />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col gap-2 mt-2 shrink-0">
          {!canSchedule && (
            <p className="text-center text-[11px] font-semibold text-error px-2 leading-tight" role="status">
              Choose at least one step for each task.
            </p>
          )}
          <button
            onClick={confirm}
            disabled={!canSchedule}
            className="w-full h-12 rounded-2xl text-[13px] font-bold bg-primary text-on-primary disabled:opacity-40 transition-opacity flex items-center justify-center gap-2 shadow-sm"
          >
            <Zap size={15} className="fill-current" />
            {isMulti
              ? `Plan ${targetNodes.length} Tasks`
              : totalStepsExist === 0
              ? 'Plan Task'
              : `Plan ${totalAssignedSteps} Step${totalAssignedSteps !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </Overlay>
  );
}
