import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { CalendarDays, CheckCircle2, ListTodo, Flame, ChevronRight, Repeat, History } from 'lucide-react';
import Overlay from './Overlay';
import type { Task, TaskSession } from '../types';
import { formatCountdownHm, formatDuration } from '../lib/format';
import { isCountableSession, sessionOverlapsLocalDate } from '../lib/sessionStats';
import { hapticTap, hapticTick } from '../lib/haptics';
import { useReducedEffects } from '../hooks/useReducedEffects';
import { springStep } from '../lib/liquidMotion';
import { localISODate, msUntilEndOfLocalISODate, shiftLocalISO } from '../lib/dates';
import { useReviveTimeLeftSub } from '../hooks/useReviveCountdown';
import type { StreakView } from '../lib/focusTrends';
import { lastSessionEnd, lastSessionNudge } from '../lib/lastSessionNudge';

interface Props {
  open: boolean;
  todayTasks: Task[];
  openTodayCount: number;
  todayDone: number;
  openBacklogCount: number;
  oldestBacklogDays: number | null;
  streakStatus: StreakView;
  sessionHistory: Record<string, TaskSession[]>;
  onDismiss: () => void;
}

/*
 * Slide to unlock, like the old iPhone: the knob stays under the finger (no
 * lag, no jump where you grab it), the label fades as it moves, and let go
 * early it glides home on a spring. Each frame only changes transform and
 * opacity, so the phone never re-lays out or repaints while you drag.
 */
const UNLOCK_THRESHOLD = 0.88;
const FLICK_VELOCITY = 0.0022; // progress units per ms
const THUMB_W = 56;
const THUMB_H = 36;
const TRACK_PAD = 6;
const TRACK_H = 48;
const RETURN_STIFFNESS = 260;
const RETURN_DAMPING = 2 * 0.9 * Math.sqrt(RETURN_STIFFNESS);

function StatCard({
  icon,
  label,
  value,
  sub,
  valueClass,
  valueBroken,
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
  sub: string;
  valueClass: string;
  valueBroken?: boolean;
}) {
  return (
    <div className="bg-surface border border-subtle rounded-[12px] p-3 min-w-0">
      <div className="flex items-center gap-1.5 text-content-muted mb-1.5">
        {icon}
        <span className="text-[10px] font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <p className={`text-[18px] font-semibold tabular-nums leading-none ${valueClass}`}>
        {valueBroken ? (
          <span className="relative inline-block opacity-75">
            {value}
            <span
              className="pointer-events-none absolute left-[-2px] right-[-2px] top-1/2 h-[2px] -translate-y-1/2 rotate-[-8deg] rounded-full bg-current opacity-70"
              aria-hidden
            />
          </span>
        ) : (
          value
        )}
      </p>
      <p className="text-[11px] text-content-secondary mt-1">{sub}</p>
    </div>
  );
}

function streakCardCopy(
  status: StreakView,
  reviveSub: string | null,
): { value: string | number; sub: string; valueBroken?: boolean } {
  if (status.current > 0) {
    return {
      value: status.current,
      sub: status.current === 1 ? 'day with focus' : 'days with focus',
    };
  }
  if (status.revive?.active && reviveSub) {
    const streak =
      status.revive.previousStreak === 1 ? '1 day' : `${status.revive.previousStreak} days`;
    return { value: streak, sub: reviveSub, valueBroken: true };
  }
  if (status.brokenDays > 0) {
    return {
      value: 0,
      sub: status.brokenDays === 1 ? 'broken 1 day' : `broken ${status.brokenDays} days`,
    };
  }
  return { value: 0, sub: 'start one' };
}

function backlogWaitSub(count: number, oldestDays: number | null): string {
  if (count === 0) return 'none open';
  if (oldestDays == null) return 'open';
  if (oldestDays <= 0) return 'waiting today';
  if (oldestDays === 1) return 'oldest 1 day';
  return `oldest ${oldestDays} days`;
}

export default function TodayBriefingSheet({
  open,
  todayTasks,
  openTodayCount,
  todayDone,
  openBacklogCount,
  oldestBacklogDays,
  streakStatus,
  sessionHistory,
  onDismiss,
}: Props) {
  const [reducedEffects] = useReducedEffects();
  const trackRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLButtonElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLParagraphElement>(null);
  const travelRef = useRef(1);
  const progressRef = useRef(0);
  const draggingRef = useRef(false);
  const confirmedRef = useRef(false);
  /** Where on the knob the finger landed, so the knob never jumps to centre under it. */
  const grabOffsetRef = useRef(0);
  const lastSampleRef = useRef<{ t: number; p: number } | null>(null);
  const velocityRef = useRef(0);
  const hapticBucketRef = useRef(0);
  const springRef = useRef({ target: 0, vel: 0, last: -1 });
  const rafRef = useRef(0);
  const [isDragging, setIsDragging] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const todayStr = localISODate(new Date());
  useEffect(() => {
    if (!open) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [open]);
  const dayLeftMs = msUntilEndOfLocalISODate(todayStr, now);
  const dayLeftClass =
    dayLeftMs <= 0
      ? 'text-content-muted'
      : dayLeftMs < 3_600_000
        ? 'text-error/80'
        : dayLeftMs < 10_800_000
          ? 'text-warning'
          : 'text-content-muted';
  const dateLabel = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  const todayFocusMs = useMemo(() => {
    const all = Object.values(sessionHistory).flat();
    return all.reduce((acc, s) => {
      if (!isCountableSession(s)) return acc;
      const slice = sessionOverlapsLocalDate(s, todayStr);
      return acc + (slice?.netFocusMs ?? 0);
    }, 0);
  }, [sessionHistory, todayStr]);

  const yesterdayStr = shiftLocalISO(todayStr, -1);
  const yesterdayFocusMs = useMemo(() => {
    const all = Object.values(sessionHistory).flat();
    return all.reduce((acc, s) => {
      if (!isCountableSession(s)) return acc;
      const slice = sessionOverlapsLocalDate(s, yesterdayStr);
      return acc + (slice?.netFocusMs ?? 0);
    }, 0);
  }, [sessionHistory, yesterdayStr]);

  const lastEnd = useMemo(() => lastSessionEnd(sessionHistory), [sessionHistory]);
  const sessionNudge = lastSessionNudge(lastEnd, now);

  const scheduledTotal = todayTasks.length;
  const remainingToday = openTodayCount;
  const startedToday = todayDone > 0 || todayFocusMs > 0;
  const reviveTimeSub = useReviveTimeLeftSub(
    streakStatus.revive?.windowEnds,
    !!streakStatus.revive?.active,
  );
  const streakCopy = useMemo(
    () => streakCardCopy(streakStatus, reviveTimeSub),
    [streakStatus, reviveTimeSub],
  );

  const headline = useMemo(() => {
    if (!startedToday) {
      if (scheduledTotal === 0 && openBacklogCount === 0) {
        return 'Clear slate — schedule something from Goals, or add a quick task.';
      }
      if (scheduledTotal === 0) return 'Nothing scheduled. The backlog is the menu.';
      if (openBacklogCount === 0) return 'Today is fully planned.';
      return 'Here’s the day.';
    }
    if (remainingToday === 0) return 'Today’s board is clear.';
    return 'Work in progress.';
  }, [startedToday, scheduledTotal, openBacklogCount, remainingToday]);


  const measure = useCallback(() => {
    const width = trackRef.current?.clientWidth ?? 0;
    travelRef.current = Math.max(1, width - THUMB_W - TRACK_PAD * 2);
  }, []);

  /** The only per-frame work: transform and opacity. */
  const paint = useCallback((p: number) => {
    const travel = travelRef.current;
    const x = p * travel;
    if (knobRef.current) {
      const scale = draggingRef.current ? 1.04 : 1;
      knobRef.current.style.transform = `translate3d(${x.toFixed(2)}px, -50%, 0) scale(${scale})`;
    }
    if (fillRef.current) fillRef.current.style.transform = `translate3d(${(x - travel).toFixed(2)}px, 0, 0)`;
    if (labelRef.current) labelRef.current.style.opacity = String(Math.max(0, 1 - p * 1.6));
    trackRef.current?.setAttribute('aria-valuenow', String(Math.round(p * 100)));
  }, []);

  const stopLoop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
  }, []);

  /** Glide to `target` (0 home, 1 the end), carrying the finger's speed. */
  const springTo = useCallback((target: number, velocity: number) => {
    stopLoop();
    if (reducedEffects) {
      progressRef.current = target;
      paint(target);
      return;
    }
    const s = springRef.current;
    s.target = target;
    s.vel = velocity;
    s.last = -1;
    const step = (time: number) => {
      const now = time / 1000;
      const dt = s.last < 0 ? 1 / 60 : Math.min(0.05, now - s.last);
      s.last = now;
      const travel = travelRef.current;
      const [x, v] = springStep(progressRef.current * travel, s.vel * travel, s.target * travel, dt, RETURN_STIFFNESS, RETURN_DAMPING);
      progressRef.current = Math.min(1, Math.max(0, x / travel));
      s.vel = v / travel;
      if (Math.abs(progressRef.current - s.target) < 0.001 && Math.abs(s.vel) < 0.01) {
        progressRef.current = s.target;
        paint(s.target);
        rafRef.current = 0;
        return;
      }
      paint(progressRef.current);
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
  }, [paint, reducedEffects, stopLoop]);

  const finish = useCallback(() => {
    if (confirmedRef.current) return;
    confirmedRef.current = true;
    draggingRef.current = false;
    setIsDragging(false);
    setConfirmed(true);
    springTo(1, Math.max(velocityRef.current * 1000, 0));
    setExiting(true);
    hapticTap();
    window.setTimeout(() => onDismiss(), reducedEffects ? 0 : 200);
  }, [onDismiss, springTo, reducedEffects]);

  useEffect(() => {
    if (!exiting) return;
    const layer = trackRef.current?.closest('.overlay-layer') as HTMLElement | null;
    if (!layer) return;
    layer.style.transition = 'opacity 420ms cubic-bezier(0.4, 0, 0.2, 1)';
    layer.style.opacity = '0';
  }, [exiting]);

  // Home position every time the sheet opens; re-measure when the window resizes.
  useLayoutEffect(() => {
    if (!open) return;
    stopLoop();
    confirmedRef.current = false;
    draggingRef.current = false;
    progressRef.current = 0;
    velocityRef.current = 0;
    lastSampleRef.current = null;
    setIsDragging(false);
    setConfirmed(false);
    setExiting(false);
    measure();
    paint(0);
    const onResize = () => {
      measure();
      paint(progressRef.current);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [open, measure, paint, stopLoop]);

  useEffect(() => stopLoop, [stopLoop]);

  const progressAt = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return progressRef.current;
    return Math.min(1, Math.max(0, (clientX - rect.left - TRACK_PAD - grabOffsetRef.current) / travelRef.current));
  };

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (confirmedRef.current) return;
    stopLoop();
    measure();
    const rect = trackRef.current?.getBoundingClientRect();
    grabOffsetRef.current = rect
      ? e.clientX - rect.left - TRACK_PAD - progressRef.current * travelRef.current
      : THUMB_W / 2;
    draggingRef.current = true;
    setIsDragging(true);
    hapticTap();
    hapticBucketRef.current = 0;
    velocityRef.current = 0;
    lastSampleRef.current = { t: performance.now(), p: progressRef.current };
    e.currentTarget.setPointerCapture(e.pointerId);
    paint(progressRef.current);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!draggingRef.current || confirmedRef.current) return;
    const p = progressAt(e.clientX);
    const now = performance.now();
    const prev = lastSampleRef.current;
    if (prev && now > prev.t) velocityRef.current = (p - prev.p) / (now - prev.t);
    lastSampleRef.current = { t: now, p };
    progressRef.current = p;
    const bucket = Math.floor(p * 6);
    if (bucket > hapticBucketRef.current && p > 0.08) {
      hapticBucketRef.current = bucket;
      hapticTick();
    }
    // At most one paint per frame, always with the latest finger position.
    if (!rafRef.current) {
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = 0;
        if (draggingRef.current) paint(progressRef.current);
      });
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setIsDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    if (confirmedRef.current) return;
    const p = progressRef.current;
    const flicked = velocityRef.current >= FLICK_VELOCITY && p >= 0.55;
    if (p >= UNLOCK_THRESHOLD || flicked) {
      finish();
      return;
    }
    springTo(0, Math.min(velocityRef.current * 1000, 0));
  };

  if (!open) return null;


  return (
    <Overlay open={open} scrim align="center">
      <div
        className={`panel sheet-up p-5 space-y-4 w-full max-w-sm briefing-sheet ${exiting ? 'briefing-sheet--exit' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">{dateLabel}</p>
          <h3 className="text-[17px] font-semibold text-content-primary mt-1">Today at a glance</h3>
          <p className={`text-[12px] font-semibold tabular-nums mt-1 ${dayLeftClass}`}>
            {dayLeftMs <= 0 ? 'Day ended' : `${formatCountdownHm(dayLeftMs)} left today`}
          </p>
          <p className="text-[13px] text-content-secondary leading-relaxed mt-1.5">{headline}</p>
          {sessionNudge && (
            <p
              className={`mt-2 flex items-start gap-1.5 text-[12px] leading-snug ${
                sessionNudge.tone === 'good'
                  ? 'text-secondary'
                  : sessionNudge.tone === 'long'
                    ? 'text-warning'
                    : 'text-content-secondary'
              }`}
            >
              <History className="w-3.5 h-3.5 mt-px shrink-0" aria-hidden />
              <span>{sessionNudge.text}</span>
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          {startedToday ? (
            <>
              <StatCard
                icon={<CalendarDays className="w-3.5 h-3.5 text-primary shrink-0" />}
                label="Left"
                value={remainingToday}
                sub={scheduledTotal === 0 ? 'nothing planned' : remainingToday === 0 ? 'board clear' : 'still open'}
                valueClass="text-content-primary"
              />
              <StatCard
                icon={<CheckCircle2 className="w-3.5 h-3.5 text-secondary shrink-0" />}
                label="Done"
                value={todayDone}
                sub="closed"
                valueClass="text-secondary"
              />
              <StatCard
                icon={<Flame className="w-3.5 h-3.5 text-primary shrink-0" />}
                label="Focus"
                value={formatDuration(todayFocusMs)}
                sub="net today"
                valueClass="text-primary"
              />
              <StatCard
                icon={<ListTodo className="w-3.5 h-3.5 text-error shrink-0" />}
                label="Backlog"
                value={openBacklogCount}
                sub={backlogWaitSub(openBacklogCount, oldestBacklogDays)}
                valueClass="text-error"
              />
            </>
          ) : (
            <>
              <StatCard
                icon={<CalendarDays className="w-3.5 h-3.5 text-primary shrink-0" />}
                label="Today"
                value={scheduledTotal}
                sub={scheduledTotal === 0 ? 'nothing planned' : 'on the board'}
                valueClass="text-content-primary"
              />
              <StatCard
                icon={<ListTodo className="w-3.5 h-3.5 text-error shrink-0" />}
                label="Backlog"
                value={openBacklogCount}
                sub={backlogWaitSub(openBacklogCount, oldestBacklogDays)}
                valueClass="text-error"
              />
              <StatCard
                icon={<Flame className="w-3.5 h-3.5 text-primary shrink-0" />}
                label="Yesterday"
                value={yesterdayFocusMs > 0 ? formatDuration(yesterdayFocusMs) : '0'}
                sub={yesterdayFocusMs > 0 ? 'yesterday' : 'no log yet'}
                valueClass="text-primary"
              />
              <StatCard
                icon={<Repeat className="w-3.5 h-3.5 text-primary shrink-0" />}
                label="Streak"
                value={streakCopy.value}
                sub={streakCopy.sub}
                valueClass="text-primary"
                valueBroken={streakCopy.valueBroken}
              />
            </>
          )}
        </div>


        <div className="pt-3">
          <div
            ref={trackRef}
            className={`briefing-slider relative rounded-[999px] border select-none touch-none ${
              isDragging || confirmed ? 'border-primary/35' : 'border-subtle'
            }`}
            style={{ height: TRACK_H }}
            role="slider"
            tabIndex={0}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={0}
            aria-label="Slide to Got it"
            onKeyDown={(event) => {
              if (event.key !== 'Enter' && event.key !== ' ') return;
              event.preventDefault();
              finish();
            }}
          >
            <div
              className="absolute inset-0 pointer-events-none rounded-[inherit]"
              style={{
                background:
                  'linear-gradient(180deg, color-mix(in srgb, var(--bg-base) 58%, var(--bg-surface)), color-mix(in srgb, var(--bg-surface) 90%, var(--bg-base)))',
                boxShadow:
                  'inset 0 2px 6px color-mix(in srgb, black 30%, transparent), inset 0 -1px 0 color-mix(in srgb, var(--text-primary) 4%, transparent)',
              }}
            />

            {!isDragging && !confirmed && (
              <div className="briefing-slider-sheen pointer-events-none" aria-hidden />
            )}

            {/* The trail behind the knob: a full-width pill slid along inside a
                clipping window, so it grows with transform alone. */}
            <div
              className="absolute overflow-hidden rounded-[999px] pointer-events-none"
              style={{ top: TRACK_PAD, bottom: TRACK_PAD, left: TRACK_PAD, right: TRACK_PAD }}
              aria-hidden
            >
              <div
                ref={fillRef}
                className="absolute inset-0 rounded-[999px] will-change-transform"
                style={{
                  background:
                    'linear-gradient(90deg, color-mix(in srgb, var(--primary) 12%, transparent), color-mix(in srgb, var(--primary) 30%, transparent))',
                }}
              />
            </div>

            <p
              ref={labelRef}
              className={`briefing-slider-label absolute left-1/2 top-1/2 z-[1] -translate-x-1/2 -translate-y-1/2 text-[16px] font-semibold tracking-[0.07em] leading-none pointer-events-none whitespace-nowrap ${
                !isDragging && !confirmed ? 'briefing-slider-label--idle' : ''
              }`}
              style={{ color: 'color-mix(in srgb, var(--text-secondary) 82%, var(--primary-glow) 18%)' }}
              aria-hidden
            >
              Got it!
            </p>

            <button
              ref={knobRef}
              type="button"
              data-no-bounce
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              className={`briefing-slider-knob absolute top-1/2 z-[2] flex items-center justify-center rounded-full touch-none will-change-transform ${
                isDragging ? 'briefing-slider-knob--drag' : ''
              }`}
              style={{
                width: THUMB_W,
                height: THUMB_H,
                left: TRACK_PAD,
                background:
                  'linear-gradient(165deg, color-mix(in srgb, var(--primary-glow) 95%, white) 0%, var(--primary) 48%, color-mix(in srgb, var(--primary) 85%, black) 100%)',
                boxShadow:
                  '0 2px 10px color-mix(in srgb, black 34%, transparent), 0 0 0 1px color-mix(in srgb, var(--primary-glow) 35%, transparent), inset 0 1px 0 color-mix(in srgb, white 30%, transparent)',
              }}
              aria-label="Got it"
            >
              <ChevronRight
                size={17}
                strokeWidth={2.35}
                className="text-on-primary drop-shadow-[0_1px_0_color-mix(in_srgb,black_25%,transparent)]"
              />
            </button>
          </div>
          <p
            className="mt-2 text-center text-[11px] text-content-muted tracking-wide transition-opacity duration-300"
            style={{ opacity: exiting ? 0 : 1 }}
          >
            Slide to continue
          </p>
        </div>
      </div>
    </Overlay>
  );
}
