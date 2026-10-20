import { useCallback, useEffect, useRef, useState } from 'react';
import { Minimize2, Moon, Pause, Play, Square } from 'lucide-react';
import { KeepAwake } from '@capacitor-community/keep-awake';
import type { ActiveSession, Task } from '../types';
import Overlay from './Overlay';
import OriginChip from './OriginChip';
import { formatElapsed } from '../lib/format';
import { computeNetFocusMs } from '../lib/sessionStats';
import { sessionClockLabel } from '../lib/sessionClock';
import { ambientDrift, isNightHour } from '../lib/ambient';
import './ambient.css';

function formatPauseDuration(ms: number) {
  const mins = Math.floor(ms / 60000);
  const hrs = Math.floor(mins / 60);
  return hrs > 0 ? `${hrs}h ${mins % 60}m` : `${mins}m`;
}

interface Props {
  activeSession: ActiveSession;
  task: Task;
  /** First one or two names on the way to the task, shown as the Today chip. */
  originNames?: string[];
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onMinimize: () => void;
  onJumpToGoal?: () => void;
}

/** How long the controls stay after a tap. */
const CONTROLS_MS = 4000;
/** The face moves a little every minute so nothing stays lit in one place. */
const DRIFT_MS = 60_000;

/**
 * StandBy-style ambient clock: the session timer in huge digits on true black,
 * the clock and the task small around it. Tap to show the controls. Dim red
 * after dark, and a slow drift against screen burn-in.
 */
export function AmbientScreen({
  activeSession,
  task,
  originNames,
  onPause,
  onResume,
  onStop,
  onMinimize,
  onJumpToGoal,
}: Props) {
  const [elapsed, setElapsed] = useState(0);
  const [now, setNow] = useState(() => new Date());
  const [controls, setControls] = useState(true);
  const [nightOverride, setNightOverride] = useState<boolean | null>(null);
  const [drift, setDrift] = useState({ x: 0, y: 0 });
  const hideTimer = useRef(0);

  useEffect(() => {
    try {
      KeepAwake.keepAwake().catch(() => {});
    } catch {
      /* ignore */
    }
    return () => {
      try {
        KeepAwake.allowSleep().catch(() => {});
      } catch {
        /* ignore */
      }
    };
  }, []);

  useEffect(() => {
    const tick = () => {
      setElapsed(Math.floor(computeNetFocusMs(activeSession, Date.now()) / 1000));
      setNow(new Date());
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [activeSession]);

  useEffect(() => {
    let step = 0;
    const interval = setInterval(() => setDrift(ambientDrift(++step)), DRIFT_MS);
    return () => clearInterval(interval);
  }, []);

  const showControls = useCallback(() => {
    setControls(true);
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setControls(false), CONTROLS_MS);
  }, []);
  useEffect(() => {
    showControls();
    return () => window.clearTimeout(hideTimer.current);
  }, [showControls]);

  const night = nightOverride ?? isNightHour(now.getHours());
  const parts = formatElapsed(elapsed).split(':');
  // Portrait stacks the last part under the rest: "24" over "18", or "1:24" over "18".
  const head = parts.slice(0, -1).join(':');
  const tail = parts[parts.length - 1];
  const clock = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const paused = activeSession.isPaused;

  const control = (event: React.MouseEvent, action: () => void) => {
    event.stopPropagation();
    action();
    showControls();
  };

  return (
    <Overlay open scrim={false} align="full" fullWidth="bleed">
      <div
        className={`ambient-screen ${night ? 'is-night' : ''} ${paused ? 'is-paused' : ''} ${controls ? 'controls-on' : ''}`}
        onClick={showControls}
        role="presentation"
      >
        <div
          className="ambient-face"
          style={{ transform: `translate3d(${drift.x}px, ${drift.y}px, 0)` }}
        >
          <div className="ambient-top">
            <span>{clock}</span>
            <span>
              {paused ? 'Paused · ' : ''}Started {sessionClockLabel(activeSession.startTime, activeSession.wallClockStart)}
              {activeSession.pauses.length > 0 ? ` · ${activeSession.pauses.length} ${activeSession.pauses.length === 1 ? 'pause' : 'pauses'}` : ''}
            </span>
          </div>

          <div className={`ambient-digits ${parts.length > 2 ? 'has-hours' : ''}`} aria-live="off" aria-label={`Focused ${formatElapsed(elapsed)}`}>
            <span className="ambient-digits-line">{formatElapsed(elapsed)}</span>
            <span className="ambient-digits-stack" aria-hidden>
              <span>{head}</span>
              <span>{tail}</span>
            </span>
          </div>

          <div className="ambient-task">
            <p className="ambient-title">{task.title}</p>
            {originNames && originNames.length > 0 && (
              <OriginChip names={originNames} onClick={onJumpToGoal ? () => { onMinimize(); onJumpToGoal(); } : undefined} />
            )}
          </div>
        </div>

        {/* Session log: every pause of this sitting, shown with the controls. */}
        {activeSession.pauses.length > 0 && (
          <div className={`ambient-log ${controls ? 'is-visible' : ''}`} aria-hidden={!controls}>
            <p className="ambient-log-title">
              Pauses{activeSession.pauses.length > 4 ? ` · last 4 of ${activeSession.pauses.length}` : ''}
            </p>
            {activeSession.pauses.slice(-4).map((p, idx) => {
              const start = sessionClockLabel(p.start, p.wallClockStart);
              const end = p.end ? sessionClockLabel(p.end, p.wallClockEnd) : 'now';
              const ms = p.end ? (p.durationMs || p.end - p.start) : activeSession.pauseStart ? now.getTime() - activeSession.pauseStart : 0;
              return (
                <p key={idx} className="ambient-log-row">
                  <span>{start} – {end}</span>
                  <span className="ambient-log-time">{formatPauseDuration(ms)}</span>
                </p>
              );
            })}
          </div>
        )}

        <div className={`ambient-controls ${controls ? 'is-visible' : ''}`} aria-hidden={!controls}>
          <button type="button" tabIndex={controls ? 0 : -1} onClick={(e) => control(e, paused ? onResume : onPause)} aria-label={paused ? 'Resume' : 'Pause'}>
            {paused ? <Play size={20} className="fill-current" /> : <Pause size={20} />}
          </button>
          <button type="button" tabIndex={controls ? 0 : -1} onClick={(e) => control(e, onStop)} aria-label="Stop session">
            <Square size={17} className="fill-current" />
          </button>
          <button
            type="button"
            tabIndex={controls ? 0 : -1}
            onClick={(e) => control(e, () => setNightOverride(!night))}
            aria-label={night ? 'Turn off night mode' : 'Turn on night mode'}
            aria-pressed={night}
          >
            <Moon size={19} />
          </button>
          <button type="button" tabIndex={controls ? 0 : -1} onClick={(e) => control(e, onMinimize)} aria-label="Minimize">
            <Minimize2 size={19} />
          </button>
        </div>
      </div>
    </Overlay>
  );
}
