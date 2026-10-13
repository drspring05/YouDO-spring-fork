import { useRef } from 'react';
import { Calendar, CalendarDays, CheckCircle2, Copy, FolderInput, RotateCcw, Settings, Target, Trash2, Users, X } from 'lucide-react';
import type { View } from '../types';

interface BatchMode {
  count: number;
  scheduleCount: number;
  replanCount: number;
  unplanCount: number;
  onCopy: () => void;
  onMove?: () => void;
  onDelete: () => void;
  onSchedule: () => void;
  onReplan: () => void;
  onUnplan: () => void;
  onCancel: () => void;
}

interface PasteMode {
  title: string;
  targetName: string;
  onPaste: () => void;
  onCancel: () => void;
}

interface Props {
  view: View;
  onNavigate: (v: View) => void;
  onSettings: () => void;
  todayCount?: number;
  todayDone?: number;
  goalsCount?: number;
  syncAttention?: boolean;
  batch?: BatchMode;
  paste?: PasteMode;
  hubSubTab?: 'social' | 'private';
  onToggleHubSubTab?: () => void;
  onSetHubSubTab?: (tab: 'social' | 'private') => void;
  /** Unread / pending on Hub while user is on another primary tab */
  showHubNavDot?: boolean;
  hubCommunityUnread?: number;
  /** Any private-side activity (notifications, DMs, room requests). */
  hubPrivateAttention?: boolean;
}

export default function CommandBar({
  view,
  onNavigate,
  onSettings,
  todayCount = 0,
  todayDone = 0,
  goalsCount = 0,
  syncAttention = false,
  batch,
  paste,
  hubSubTab = 'social',
  onToggleHubSubTab,
  onSetHubSubTab,
  showHubNavDot = false,
  hubCommunityUnread = 0,
  hubPrivateAttention = false,
}: Props) {
  const remainingToday = Math.max(0, todayCount - todayDone);
  const hubTouchStartY = useRef<number | null>(null);

  const tabs: { id: View; label: string; icon: typeof Target; badge?: number; quietBadge?: boolean }[] = [
    { id: 'tasks', label: 'Today', icon: CheckCircle2, badge: remainingToday > 0 ? remainingToday : undefined },
    { id: 'goals', label: 'Goals', icon: Target, badge: goalsCount > 0 ? goalsCount : undefined, quietBadge: true },
    { id: 'calendar', label: 'Calendar', icon: CalendarDays },
    { id: 'board', label: 'Hub', icon: Users },
  ];

  return (
    <nav className="tab-bar-wrap no-swipe" aria-label="Primary navigation">
      <div className={`glass tab-bar ${batch || paste ? 'tab-bar-sheet' : ''}`}>
        {batch ? (
          <div className="w-full p-1 space-y-1.5">
            <div className="h-10 flex items-center gap-1">
              <span className="pl-2 flex-1 text-[15px] font-semibold text-content-primary tabular-nums">
                {batch.count} selected
              </span>
              <button onClick={batch.onCopy} className="h-9 px-2.5 rounded-full text-[13px] font-medium text-primary inline-flex items-center gap-1" title="Copy selected">
                <Copy size={13} /> Copy
              </button>
              {batch.onMove && (
                <button onClick={batch.onMove} className="h-9 px-2.5 rounded-full text-[13px] font-medium text-primary inline-flex items-center gap-1" title="Move selected">
                  <FolderInput size={13} /> Move
                </button>
              )}
              <button onClick={batch.onDelete} className="h-9 px-2.5 rounded-full text-[13px] font-medium text-error inline-flex items-center gap-1" title="Delete selected">
                <Trash2 size={13} /> Delete
              </button>
              <button onClick={batch.onCancel} className="w-9 h-9 grid place-items-center rounded-full bg-fill text-content-secondary" title="Clear selection">
                <X size={15} />
              </button>
            </div>
            {(batch.scheduleCount > 0 || batch.replanCount > 0 || batch.unplanCount > 0) ? (
              <div className="grid grid-cols-3 gap-1.5">
                <button onClick={batch.onSchedule} disabled={batch.scheduleCount === 0} className="h-10 rounded-full text-[13px] font-semibold bg-primary text-on-primary disabled:opacity-25 inline-flex items-center justify-center gap-1">
                  <Calendar size={13} /> Schedule {batch.scheduleCount || ''}
                </button>
                <button onClick={batch.onReplan} disabled={batch.replanCount === 0} className="h-10 rounded-full text-[13px] font-semibold bg-primary-soft text-primary disabled:opacity-25 inline-flex items-center justify-center gap-1">
                  <RotateCcw size={13} /> Replan {batch.replanCount || ''}
                </button>
                <button onClick={batch.onUnplan} disabled={batch.unplanCount === 0} className="h-10 rounded-full text-[13px] font-semibold bg-error-soft text-error disabled:opacity-25 inline-flex items-center justify-center gap-1">
                  <X size={13} /> Unplan {batch.unplanCount || ''}
                </button>
              </div>
            ) : (
              <p className="px-2 pb-1 text-[10.5px] text-content-muted">No schedulable tasks selected. Active sessions stay protected.</p>
            )}
          </div>
        ) : paste ? (
          <>
            <div className="ml-1 w-10 h-10 grid place-items-center rounded-full bg-primary-soft text-primary shrink-0">
              <Copy size={17} />
            </div>
            <div className="flex-1 min-w-0 px-2">
              <div className="text-[15px] font-semibold text-content-primary truncate">{paste.title}</div>
              <div className="text-[13px] text-content-secondary truncate">Into {paste.targetName}</div>
            </div>
            <button onClick={paste.onCancel} className="w-10 h-10 grid place-items-center rounded-full bg-fill text-content-secondary" aria-label="Cancel paste">
              <X size={17} />
            </button>
            <button
              onClick={paste.onPaste}
              className="h-10 px-5 rounded-full text-[15px] font-semibold bg-primary text-on-primary"
            >
              Paste
            </button>
          </>
        ) : (
          <>
            <div className="tab-bar-tabs">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const active = view === tab.id;
                const isHubTab = tab.id === 'board';
                const hubIconDot = isHubTab && !active && showHubNavDot;
                const hubStripPublicDot =
                  isHubTab && active && hubSubTab === 'private' && hubCommunityUnread > 0;
                const hubStripPrivateDot =
                  isHubTab && active && hubSubTab === 'social' && hubPrivateAttention;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      if (isHubTab && active) {
                        onToggleHubSubTab?.();
                      } else {
                        onNavigate(tab.id);
                      }
                    }}
                    onWheel={
                      isHubTab && active
                        ? (e) => {
                            if (e.deltaY > 5) onSetHubSubTab?.('private');
                            else if (e.deltaY < -5) onSetHubSubTab?.('social');
                          }
                        : undefined
                    }
                    onTouchStart={
                      isHubTab && active
                        ? (e) => {
                            hubTouchStartY.current = e.touches[0].clientY;
                          }
                        : undefined
                    }
                    onTouchEnd={
                      isHubTab && active
                        ? (e) => {
                            if (hubTouchStartY.current === null) return;
                            const diff = e.changedTouches[0].clientY - hubTouchStartY.current;
                            if (diff < -12) onSetHubSubTab?.('private');
                            else if (diff > 12) onSetHubSubTab?.('social');
                            hubTouchStartY.current = null;
                          }
                        : undefined
                    }
                    aria-current={active ? 'page' : undefined}
                    title={isHubTab && active ? 'Scroll or tap to switch Public / Private' : undefined}
                    className={`tab-bar-item ${active ? 'is-active' : ''}`}
                  >
                    <span className="relative inline-flex shrink-0">
                      <Icon size={23} strokeWidth={active ? 2.3 : 1.9} />
                      {hubIconDot && (
                        <span
                          className="absolute -right-1 -top-0.5 size-[9px] rounded-full bg-error ring-2 ring-[var(--bg-surface)] pointer-events-none"
                          aria-hidden
                        />
                      )}
                    </span>
                    
                    {/* Rolling label for active Hub, static label for others */}
                    {isHubTab && active ? (
                      <div className="h-[12px] overflow-hidden relative w-full">
                        <div
                          className="flex flex-col transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
                          style={{
                            transform: hubSubTab === 'social' ? 'translateY(0%)' : 'translateY(-50%)',
                          }}
                        >
                          <span className="h-[12px] flex items-center justify-center text-[10px] font-semibold text-primary shrink-0">
                            Public
                          </span>
                          <span className="h-[12px] flex items-center justify-center text-[10px] font-semibold text-primary shrink-0">
                            Private
                          </span>
                        </div>
                      </div>
                    ) : (
                      <span className="tab-bar-label">{tab.label}</span>
                    )}

                    {isHubTab && active && (
                      <div
                        className="absolute right-2 top-3 bottom-3 w-[4px] pointer-events-none"
                        aria-hidden
                      >
                        {hubStripPublicDot && (
                          <span
                            className="absolute right-full top-[25%] mr-[3px] size-[5px] -translate-y-1/2 rounded-full bg-primary ring-[1.5px] ring-[var(--bg-surface)]"
                            aria-label="Public hub has unread"
                          />
                        )}
                        {hubStripPrivateDot && (
                          <span
                            className="absolute right-full top-[75%] mr-[3px] size-[5px] -translate-y-1/2 rounded-full bg-primary ring-[1.5px] ring-[var(--bg-surface)]"
                            aria-label="Private hub has activity"
                          />
                        )}
                        <div className="absolute inset-0 rounded-full bg-fill overflow-hidden">
                          <div
                            className="absolute left-0 right-0 h-1/2 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] p-[1px]"
                            style={{
                              transform: hubSubTab === 'social' ? 'translateY(0%)' : 'translateY(100%)',
                            }}
                          >
                            <div className="w-full h-full rounded-full bg-primary" />
                          </div>
                        </div>
                      </div>
                    )}

                    {tab.badge !== undefined && (
                      <span className={`tab-bar-badge ${tab.quietBadge ? 'is-quiet' : ''}`}>
                        {tab.badge > 99 ? '99+' : tab.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
      {!batch && !paste && (
        <button
          type="button"
          onClick={onSettings}
          className="glass tab-bar-orb"
          title="Settings"
          aria-label="Settings"
        >
          <Settings size={24} strokeWidth={1.9} />
          {syncAttention && (
            <span
              className="absolute right-3.5 top-3.5 size-2.5 rounded-full bg-warning ring-2 ring-[var(--bg-surface)]"
              aria-label="Sync needs review"
            />
          )}
        </button>
      )}
    </nav>
  );
}
