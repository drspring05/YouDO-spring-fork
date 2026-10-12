import { useState, useEffect } from 'react';
import {
  Sparkles,
  UsersRound,
  MessageSquare,
  Flame,
  ArrowRight,
  Clock,
  Coffee,
  Copy,
  Check,
  BellRing,
  ExternalLink,
  Heart,
  Loader2,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getHubWaitlistStatus, joinHubWaitlist } from '../lib/hubWaitlist';
import BackerBadgeModal from './BackerBadgeModal';

interface Props {
  onSwitchToPublic?: () => void;
}

const UPI_ID = 'mattedhairr@axl';

export default function PrivateHubUnderDevelopment({ onSwitchToPublic }: Props) {
  const { user } = useAuth();
  const currentUsername =
    typeof user?.user_metadata?.username === 'string'
      ? user.user_metadata.username
      : null;

  // Waitlist state
  const [isWaitlisted, setIsWaitlisted] = useState(false);
  const [waitlistCount, setWaitlistCount] = useState<number>(0);
  const [isJoiningWaitlist, setIsJoiningWaitlist] = useState(false);

  // Backer / UPI state
  const [showBackerModal, setShowBackerModal] = useState(false);
  const [copiedUpi, setCopiedUpi] = useState(false);

  useEffect(() => {
    let mounted = true;
    getHubWaitlistStatus().then((status) => {
      if (mounted) {
        setIsWaitlisted(status.joined);
        setWaitlistCount(status.totalCount);
      }
    });
    return () => {
      mounted = false;
    };
  }, [user?.id]);

  const handleJoinWaitlist = async () => {
    if (isWaitlisted || isJoiningWaitlist) return;
    setIsJoiningWaitlist(true);
    const res = await joinHubWaitlist();
    setIsWaitlisted(true);
    setWaitlistCount(res.totalCount);
    setIsJoiningWaitlist(false);
  };

  const handleCopyUpi = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(UPI_ID);
        setCopiedUpi(true);
        setTimeout(() => setCopiedUpi(false), 2500);
      }
    } catch {
      /* ignore */
    }
  };

  const handleOpenUpiDirect = () => {
    const upiUrl = `upi://pay?pa=${UPI_ID}&pn=YouDO%20Dev&cu=INR&tn=YouDO%20Support`;
    window.location.href = upiUrl;
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 pt-4 pb-28 max-w-lg mx-auto w-full select-none animate-fadeIn">
      {/* Outer Glow Card */}
      <div className="relative w-full rounded-[28px] border border-primary/25 bg-gradient-to-b from-primary-soft/30 via-elevated/95 to-surface/90 p-5 sm:p-7 shadow-elevated overflow-hidden backdrop-blur-md">
        {/* Ambient Glow Orbs */}
        <div className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-primary/15 blur-3xl" />
        <div className="pointer-events-none absolute -left-10 -bottom-10 size-40 rounded-full bg-primary/10 blur-3xl" />

        {/* Top Header Section */}
        <div className="relative text-center flex flex-col items-center">
          {/* Glowing Icon Badge */}
          <div className="relative mb-3.5">
            <div className="size-16 sm:size-18 rounded-[22px] bg-gradient-to-br from-primary to-primary-hover text-on-primary flex items-center justify-center shadow-elevated shadow-primary/30">
              <Flame size={32} strokeWidth={2.2} className="text-on-primary animate-pulse" />
            </div>
            <div className="absolute -bottom-1 -right-1 size-6 rounded-full bg-elevated border-2 border-surface flex items-center justify-center text-primary shadow-xs">
              <Sparkles size={12} strokeWidth={2.4} />
            </div>
          </div>

          {/* Eyebrow Pill */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/15 border border-primary/30 text-[10px] font-bold uppercase tracking-[0.16em] text-primary mb-2">
            <span className="size-1.5 rounded-full bg-primary animate-ping" />
            <span>In The Kitchen · Under Development</span>
          </div>

          {/* Heading */}
          <h2 className="text-[21px] sm:text-[24px] font-extrabold text-content-primary tracking-tight leading-snug">
            Private Hub is Cooking
          </h2>

          {/* Subtitle */}
          <p className="text-[12.5px] text-content-secondary mt-1.5 leading-relaxed max-w-[360px] mx-auto">
            4-member focus squad rooms, companion chats, and real-time study synchronization are being fine-tuned.
          </p>
        </div>

        {/* Interactive Priority Waitlist Section */}
        <div className="relative mt-5 rounded-2xl border border-primary/30 bg-gradient-to-br from-primary-soft/40 via-surface/80 to-surface p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2 mb-2.5">
            <div className="flex items-center gap-2">
              <div className="size-7 rounded-lg bg-primary/20 text-primary flex items-center justify-center">
                <BellRing size={15} strokeWidth={2.4} />
              </div>
              <span className="text-[12px] font-extrabold text-content-primary">
                Priority Waitlist
              </span>
            </div>
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-[10.5px] font-bold text-primary">
              <span className="size-1.5 rounded-full bg-primary" />
              <span>
                {waitlistCount > 0 ? `${waitlistCount} waiting` : 'Join the waitlist'}
              </span>
            </div>
          </div>

          <p className="text-[11.5px] text-content-muted leading-relaxed mb-3">
            {isWaitlisted
              ? "You're on the priority list! We'll push a direct notification to your phone the instant squad rooms open."
              : 'Be the first to jump into squad rooms when early access unlocks.'}
          </p>

          <button
            type="button"
            onClick={handleJoinWaitlist}
            disabled={isWaitlisted || isJoiningWaitlist}
            className={`w-full h-11 rounded-[14px] font-bold text-[13px] flex items-center justify-center gap-2 transition-all shadow-md ${
              isWaitlisted
                ? 'bg-emerald-600/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 cursor-default'
                : 'bg-primary text-on-primary hover:opacity-95 active:scale-[0.98] shadow-primary/20'
            }`}
          >
            {isJoiningWaitlist ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Joining Priority Waitlist...</span>
              </>
            ) : isWaitlisted ? (
              <>
                <Check size={16} strokeWidth={2.5} />
                <span>You're on the Waitlist! 🎉</span>
              </>
            ) : (
              <>
                <BellRing size={16} />
                <span>
                  Notify Me When Ready 🔥 {waitlistCount > 0 ? `(#${waitlistCount + 1})` : ''}
                </span>
              </>
            )}
          </button>
        </div>

        {/* Feature Roadmap Preview */}
        <div className="relative mt-5 space-y-2">
          <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-content-muted px-1">
            What's Being Cooked
          </div>

          <div className="flex items-start gap-2.5 rounded-xl border border-subtle/70 bg-surface/60 p-2.5 transition-colors">
            <div className="size-7 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0 mt-0.5">
              <UsersRound size={15} strokeWidth={2.4} />
            </div>
            <div className="min-w-0">
              <h4 className="text-[12px] font-bold text-content-primary leading-tight">4-Member Focus Squads</h4>
              <p className="text-[10.5px] text-content-muted mt-0.5 leading-snug">
                Study in live pods with synchronized timers and shared momentum.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2.5 rounded-xl border border-subtle/70 bg-surface/60 p-2.5 transition-colors">
            <div className="size-7 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0 mt-0.5">
              <MessageSquare size={15} strokeWidth={2.4} />
            </div>
            <div className="min-w-0">
              <h4 className="text-[12px] font-bold text-content-primary leading-tight">Companion DMs &amp; Streaks</h4>
              <p className="text-[10.5px] text-content-muted mt-0.5 leading-snug">
                Direct 1-on-1 focus partnerships with ephemeral 24-hour chats.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2.5 rounded-xl border border-subtle/70 bg-surface/60 p-2.5 transition-colors">
            <div className="size-7 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0 mt-0.5">
              <Clock size={15} strokeWidth={2.4} />
            </div>
            <div className="min-w-0">
              <h4 className="text-[12px] font-bold text-content-primary leading-tight">Real-Time Study Sync</h4>
              <p className="text-[10.5px] text-content-muted mt-0.5 leading-snug">
                Seamless live presence across all your devices.
              </p>
            </div>
          </div>
        </div>

        {/* Solo Dev Support & UPI Section */}
        <div className="relative mt-5 rounded-2xl border border-amber-500/25 bg-gradient-to-b from-amber-500/10 via-surface/90 to-surface p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="size-7 rounded-lg bg-amber-500/20 text-amber-500 flex items-center justify-center">
                <Coffee size={15} strokeWidth={2.4} />
              </div>
              <span className="text-[12px] font-extrabold text-content-primary">
                Fuel Solo Dev ☕
              </span>
            </div>
            <span className="text-[9.5px] font-bold uppercase tracking-wider text-amber-500/90 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-full">
              Optional
            </span>
          </div>

          <p className="text-[11px] text-content-muted leading-relaxed">
            YouDO is crafted solo. If you want to help cover AI tool subscriptions &amp; server costs to bring Private Hub faster, every chai fuels the build!
          </p>

          {/* UPI ID Pill & Actions */}
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between gap-2 rounded-xl bg-surface/80 border border-subtle px-3 py-1.5">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-[10px] uppercase font-bold text-content-muted shrink-0">
                  UPI:
                </span>
                <span className="font-mono font-bold text-[12px] text-content-primary truncate select-all">
                  {UPI_ID}
                </span>
              </div>
              <button
                type="button"
                onClick={handleCopyUpi}
                className="px-2 py-1 rounded-lg bg-elevated hover:bg-subtle text-[10.5px] font-bold text-primary flex items-center gap-1 shrink-0 transition-colors"
              >
                {copiedUpi ? (
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

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleOpenUpiDirect}
                className="h-9 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-white font-bold text-[11.5px] flex items-center justify-center gap-1 hover:opacity-95 active:scale-[0.98] transition-all shadow-xs"
              >
                <span>Pay via UPI App</span>
                <ExternalLink size={12} />
              </button>

              <button
                type="button"
                onClick={() => setShowBackerModal(true)}
                className="h-9 rounded-xl bg-elevated border border-primary/30 hover:bg-primary-soft/30 text-primary font-bold text-[11.5px] flex items-center justify-center gap-1 transition-all active:scale-[0.98]"
              >
                <Heart size={12} fill="currentColor" />
                <span>Claim Backer Badge</span>
              </button>
            </div>
          </div>
        </div>

        {/* Primary Action: Return to Public Board */}
        {onSwitchToPublic && (
          <div className="relative mt-5 pt-1">
            <button
              type="button"
              onClick={onSwitchToPublic}
              className="w-full h-10 rounded-[14px] bg-elevated/80 border border-subtle hover:bg-elevated text-content-primary font-bold text-[12.5px] flex items-center justify-center gap-2 hover:opacity-95 active:scale-[0.98] transition-all"
            >
              <span>Back to Public Board</span>
              <ArrowRight size={15} />
            </button>
          </div>
        )}
      </div>

      {/* Backer Modal Dialog */}
      <BackerBadgeModal
        open={showBackerModal}
        onClose={() => setShowBackerModal(false)}
        currentUsername={currentUsername}
      />
    </div>
  );
}
