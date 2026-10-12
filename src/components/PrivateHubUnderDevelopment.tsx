import {
  Sparkles,
  UsersRound,
  MessageSquare,
  Flame,
  ArrowRight,
  Clock,
} from 'lucide-react';

interface Props {
  onSwitchToPublic?: () => void;
}

export default function PrivateHubUnderDevelopment({ onSwitchToPublic }: Props) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 pt-4 pb-28 max-w-lg mx-auto w-full select-none animate-fadeIn">
      {/* Outer Glow Card */}
      <div className="relative w-full rounded-[28px] border border-primary/25 bg-gradient-to-b from-primary-soft/30 via-elevated/95 to-surface/90 p-6 sm:p-8 shadow-elevated overflow-hidden backdrop-blur-md">
        {/* Ambient Glow Orbs */}
        <div className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-primary/15 blur-3xl" />
        <div className="pointer-events-none absolute -left-10 -bottom-10 size-40 rounded-full bg-primary/10 blur-3xl" />

        {/* Top Header Section */}
        <div className="relative text-center flex flex-col items-center">
          {/* Glowing Icon Badge */}
          <div className="relative mb-4">
            <div className="size-16 sm:size-20 rounded-[22px] bg-gradient-to-br from-primary to-primary-hover text-on-primary flex items-center justify-center shadow-elevated shadow-primary/30">
              <Flame size={32} strokeWidth={2.2} className="text-on-primary animate-pulse" />
            </div>
            <div className="absolute -bottom-1 -right-1 size-6 rounded-full bg-elevated border-2 border-surface flex items-center justify-center text-primary shadow-xs">
              <Sparkles size={12} strokeWidth={2.4} />
            </div>
          </div>

          {/* Eyebrow Pill */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/15 border border-primary/30 text-[10.5px] font-bold uppercase tracking-[0.16em] text-primary mb-2.5">
            <span className="size-1.5 rounded-full bg-primary animate-ping" />
            <span>In The Kitchen · Under Development</span>
          </div>

          {/* Heading */}
          <h2 className="text-[22px] sm:text-[25px] font-extrabold text-content-primary tracking-tight leading-snug">
            Private Hub is Cooking
          </h2>

          {/* Subtitle */}
          <p className="text-[12.5px] sm:text-[13px] text-content-secondary mt-2 leading-relaxed max-w-[360px] mx-auto">
            We are fine-tuning 4-member squad rooms, direct companion messaging, and live focus synchronization. This section is temporarily closed while we squash bugs and refine the experience.
          </p>
        </div>

        {/* Feature Roadmap Preview */}
        <div className="relative mt-6 space-y-2.5">
          <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-content-muted px-1">
            What's Being Cooked
          </div>

          <div className="flex items-start gap-3 rounded-2xl border border-subtle/70 bg-surface/60 p-3 transition-colors">
            <div className="size-8 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0 mt-0.5">
              <UsersRound size={16} strokeWidth={2.4} />
            </div>
            <div className="min-w-0">
              <h4 className="text-[12.5px] font-bold text-content-primary leading-tight">4-Member Focus Squads</h4>
              <p className="text-[11px] text-content-muted mt-0.5 leading-snug">
                Study in live pods with synchronized timers, accountability check-ins, and shared momentum.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-2xl border border-subtle/70 bg-surface/60 p-3 transition-colors">
            <div className="size-8 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0 mt-0.5">
              <MessageSquare size={16} strokeWidth={2.4} />
            </div>
            <div className="min-w-0">
              <h4 className="text-[12.5px] font-bold text-content-primary leading-tight">Companion DMs &amp; Streaks</h4>
              <p className="text-[11px] text-content-muted mt-0.5 leading-snug">
                Direct 1-on-1 focus partnerships with ephemeral 24-hour accountability chats.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-2xl border border-subtle/70 bg-surface/60 p-3 transition-colors">
            <div className="size-8 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0 mt-0.5">
              <Clock size={16} strokeWidth={2.4} />
            </div>
            <div className="min-w-0">
              <h4 className="text-[12.5px] font-bold text-content-primary leading-tight">Real-Time Study Sync</h4>
              <p className="text-[11px] text-content-muted mt-0.5 leading-snug">
                Bulletproof live presence and seamless sync across all your devices.
              </p>
            </div>
          </div>
        </div>

        {/* Primary Action Button */}
        {onSwitchToPublic && (
          <div className="relative mt-6 pt-2">
            <button
              type="button"
              onClick={onSwitchToPublic}
              className="w-full h-11 rounded-[14px] bg-primary text-on-primary font-bold text-[13px] flex items-center justify-center gap-2 shadow-elevated shadow-primary/20 hover:opacity-95 active:scale-[0.98] transition-all"
            >
              <span>Back to Public Board</span>
              <ArrowRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
