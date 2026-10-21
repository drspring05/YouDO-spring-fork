import { useCallback, useEffect, useState } from 'react';
import { Browser } from '@capacitor/browser';
import { Check, ExternalLink, Lock, RefreshCw, Send } from 'lucide-react';
import {
  OPEN_APP_UPDATES_EVENT,
  REPLY_MAX,
  UPDATE_REACTIONS,
  fetchUpdateState,
  reactToUpdate,
  replyToUpdate,
  voteOnUpdate,
  type UpdateAction,
  type UpdateReaction,
  type UpdateState,
} from '../../lib/boardUpdate';

async function openLink(url: string): Promise<void> {
  try {
    await Browser.open({ url, toolbarColor: '#171612' });
  } catch {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

function runAction(action: UpdateAction) {
  if (action.kind === 'updater') window.dispatchEvent(new Event(OPEN_APP_UPDATES_EVENT));
  else void openLink(action.url);
}

/**
 * What a Board update carries besides its text: poll, quick reactions,
 * "Reply privately" and one action button. Shown when the update is opened.
 */
export default function UpdateExtras({ refreshKey }: { refreshKey: string }) {
  const [state, setState] = useState<UpdateState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [replyOpen, setReplyOpen] = useState(false);
  const [reply, setReply] = useState('');

  const load = useCallback(async () => {
    setState(await fetchUpdateState());
  }, []);
  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const run = async (task: () => Promise<{ ok: boolean; error?: string }>) => {
    if (busy) return false;
    setBusy(true);
    setError('');
    const result = await task();
    if (!result.ok) setError(result.error ?? 'Something went wrong.');
    await load();
    setBusy(false);
    return result.ok;
  };

  if (!state) return null;
  const { poll } = state;
  const showResults = !!poll?.counts;

  return (
    <div className="mt-3 space-y-3">
      {poll && (
        <div className="space-y-1.5" role="group" aria-label="Poll">
          {poll.options.map((option, index) => {
            const count = poll.counts?.[index] ?? 0;
            const pct = poll.total > 0 ? Math.round((count / poll.total) * 100) : 0;
            const mine = poll.myChoice === index;
            return (
              <button
                key={option}
                type="button"
                disabled={busy || poll.closed}
                aria-pressed={mine}
                onClick={() => void run(() => voteOnUpdate(index))}
                className={`relative w-full overflow-hidden rounded-xl border px-3 py-2 text-left text-[12px] transition-colors ${
                  mine ? 'border-secondary/50' : 'border-subtle'
                } ${poll.closed ? 'cursor-default' : ''}`}
              >
                {showResults && (
                  <span
                    className="absolute inset-y-0 left-0 bg-secondary-soft"
                    style={{ width: `${pct}%` }}
                    aria-hidden
                  />
                )}
                <span className="relative flex items-center gap-2">
                  {mine && <Check size={13} className="shrink-0 text-secondary" aria-label="Your vote" />}
                  <span className="min-w-0 flex-1 text-content-primary">{option}</span>
                  {showResults && <span className="shrink-0 font-semibold tabular-nums text-content-secondary">{pct}%</span>}
                </span>
              </button>
            );
          })}
          <p className="flex items-center gap-1 text-[10px] text-content-muted">
            {poll.closed && <Lock size={10} aria-hidden />}
            {poll.closed
              ? `Poll ended · ${poll.total} ${poll.total === 1 ? 'vote' : 'votes'}`
              : poll.myChoice === null
                ? 'Tap an option to vote. Results show after you vote.'
                : `${poll.total} ${poll.total === 1 ? 'vote' : 'votes'} · tap another option to change`}
          </p>
        </div>
      )}

      {state.action && (
        <button
          type="button"
          onClick={() => runAction(state.action!)}
          className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-secondary px-3.5 text-[12px] font-bold text-[color:var(--bg-base)]"
        >
          {state.action.kind === 'updater' ? <RefreshCw size={13} /> : <ExternalLink size={13} />}
          {state.action.label}
        </button>
      )}

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Reactions">
        {UPDATE_REACTIONS.map((emoji: UpdateReaction) => {
          const mine = state.myReaction === emoji;
          const count = state.reactions[emoji] ?? 0;
          return (
            <button
              key={emoji}
              type="button"
              disabled={busy}
              aria-pressed={mine}
              aria-label={`React ${emoji}${count ? `, ${count}` : ''}`}
              onClick={() => void run(() => reactToUpdate(mine ? null : emoji))}
              className={`inline-flex h-8 items-center gap-1 rounded-full border px-2.5 text-[13px] ${
                mine ? 'border-secondary/50 bg-secondary-soft' : 'border-subtle bg-surface'
              }`}
            >
              <span aria-hidden>{emoji}</span>
              {count > 0 && <span className="text-[11px] font-semibold tabular-nums text-content-secondary">{count}</span>}
            </button>
          );
        })}
      </div>

      {state.replies && (
        replyOpen ? (
          <div className="space-y-2">
            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              maxLength={REPLY_MAX}
              rows={3}
              placeholder="Only the YouDO team will see this"
              className="w-full resize-none rounded-xl border border-subtle bg-base p-2.5 text-[12px] text-content-primary outline-none focus:border-secondary"
            />
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] text-content-muted tabular-nums">{reply.trim().length}/{REPLY_MAX} · private</span>
              <div className="flex gap-1.5">
                <button type="button" onClick={() => setReplyOpen(false)} className="h-8 rounded-lg px-3 text-[11px] font-semibold text-content-secondary">Cancel</button>
                <button
                  type="button"
                  disabled={busy || !reply.trim()}
                  onClick={() => void run(() => replyToUpdate(reply)).then((ok) => { if (ok) { setReply(''); setReplyOpen(false); } })}
                  className="inline-flex h-8 items-center gap-1 rounded-lg bg-secondary px-3 text-[11px] font-bold text-[color:var(--bg-base)] disabled:opacity-40"
                >
                  <Send size={12} /> Send
                </button>
              </div>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setReplyOpen(true)}
            className="text-[11.5px] font-semibold text-secondary"
          >
            {state.replied ? 'Reply sent privately · Edit' : 'Reply privately'}
          </button>
        )
      )}

      {error && <p role="alert" className="text-[11px] text-error">{error}</p>}
    </div>
  );
}
