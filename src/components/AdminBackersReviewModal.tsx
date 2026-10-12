import { useState, useEffect } from 'react';
import Overlay from './Overlay';
import {
  X,
  ShieldCheck,
  Check,
  Trash2,
  Copy,
  Clock,
  Sparkles,
  Loader2,
} from 'lucide-react';
import {
  fetchPendingHubBackers,
  reviewHubBacker,
  type PendingBackerItem,
} from '../lib/hubWaitlist';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function AdminBackersReviewModal({ open, onClose }: Props) {
  const [items, setItems] = useState<PendingBackerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [copiedUtr, setCopiedUtr] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadPending = async () => {
    setLoading(true);
    const data = await fetchPendingHubBackers();
    setItems(data);
    setLoading(false);
  };

  useEffect(() => {
    if (open) {
      void loadPending();
    }
  }, [open]);

  const handleCopyUtr = async (utr: string) => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(utr);
        setCopiedUtr(utr);
        setTimeout(() => setCopiedUtr(null), 2000);
      }
    } catch {
      /* ignore */
    }
  };

  const handleReview = async (id: string, decision: 'verified' | 'rejected') => {
    setWorkingId(id);
    setFeedback(null);
    const res = await reviewHubBacker(id, decision);
    setWorkingId(null);

    if (res.success) {
      setFeedback(
        decision === 'verified'
          ? 'Backer badge granted & profile updated!'
          : 'Submission rejected.'
      );
      setItems((prev) => prev.filter((item) => item.id !== id));
      setTimeout(() => setFeedback(null), 3000);
    } else {
      setFeedback(res.error || 'Review failed');
    }
  };

  return (
    <Overlay open={open} onClose={onClose} align="center">
      <div className="relative w-full max-w-lg mx-auto rounded-[24px] border border-primary/25 bg-surface/98 backdrop-blur-xl p-5 shadow-2xl text-content-primary overflow-hidden animate-scaleIn max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-subtle shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
              <ShieldCheck size={20} strokeWidth={2.4} />
            </div>
            <div>
              <h3 className="text-[16px] font-extrabold text-content-primary leading-tight">
                Pending Backer Claims
              </h3>
              <p className="text-[11px] text-content-muted leading-none mt-0.5">
                Admin review for Founding Backer badges
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="size-8 rounded-full bg-elevated/80 hover:bg-elevated text-content-muted hover:text-content-primary flex items-center justify-center transition-colors"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {feedback && (
          <div className="my-2.5 py-1.5 px-3 rounded-lg bg-primary/15 border border-primary/30 text-primary text-[12px] font-semibold text-center animate-fadeIn shrink-0">
            {feedback}
          </div>
        )}

        {/* Content list */}
        <div className="flex-1 overflow-y-auto py-3 space-y-3 min-h-[160px]">
          {loading ? (
            <div className="h-40 flex flex-col items-center justify-center gap-2 text-content-muted text-[13px]">
              <Loader2 size={24} className="animate-spin text-primary" />
              <span>Loading pending claims...</span>
            </div>
          ) : items.length === 0 ? (
            <div className="h-40 flex flex-col items-center justify-center gap-2 text-content-muted text-center px-4">
              <div className="size-12 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                <Check size={24} />
              </div>
              <p className="font-bold text-[13.5px] text-content-primary">All Caught Up!</p>
              <p className="text-[11.5px] text-content-muted">
                No pending backer claims right now.
              </p>
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl border border-subtle bg-elevated/70 p-3.5 space-y-2.5 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-[13.5px] text-content-primary">
                        @{item.username}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-500 font-extrabold text-[11px]">
                        ₹{item.amount}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-[10.5px] text-content-muted mt-0.5">
                      <Clock size={11} />
                      <span>{new Date(item.created_at).toLocaleString()}</span>
                    </div>
                  </div>

                  <span className="px-2 py-0.5 rounded-full bg-warning/15 border border-warning/30 text-warning text-[10px] font-bold uppercase tracking-wider">
                    Pending
                  </span>
                </div>

                {/* UTR Pill */}
                <div className="flex items-center justify-between gap-2 rounded-xl bg-surface/90 border border-subtle px-3 py-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[10px] font-bold uppercase text-content-muted shrink-0">
                      UTR:
                    </span>
                    <span className="font-mono font-bold text-[12px] text-content-primary tracking-wider truncate select-all">
                      {item.utr}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyUtr(item.utr)}
                    className="px-2 py-0.5 rounded-md bg-elevated hover:bg-subtle text-[10.5px] font-bold text-primary flex items-center gap-1 transition-colors shrink-0"
                  >
                    {copiedUtr === item.utr ? (
                      <>
                        <Check size={11} /> Copied
                      </>
                    ) : (
                      <>
                        <Copy size={11} /> Copy
                      </>
                    )}
                  </button>
                </div>

                {item.note && (
                  <p className="text-[11.5px] text-content-secondary italic bg-surface/60 rounded-lg p-2 border border-subtle/50">
                    &ldquo;{item.note}&rdquo;
                  </p>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    disabled={workingId === item.id}
                    onClick={() => handleReview(item.id, 'verified')}
                    className="flex-1 h-9 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[12px] flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] disabled:opacity-50 shadow-xs"
                  >
                    {workingId === item.id ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Sparkles size={13} />
                    )}
                    <span>Approve &amp; Grant Badge</span>
                  </button>

                  <button
                    type="button"
                    disabled={workingId === item.id}
                    onClick={() => handleReview(item.id, 'rejected')}
                    className="h-9 px-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/30 font-bold text-[12px] flex items-center justify-center gap-1 transition-all active:scale-[0.98] disabled:opacity-50"
                  >
                    <Trash2 size={13} />
                    <span>Reject</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </Overlay>
  );
}
