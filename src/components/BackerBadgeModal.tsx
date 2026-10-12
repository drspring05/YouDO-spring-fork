import { useState } from 'react';
import Overlay from './Overlay';
import {
  X,
  Coffee,
  Copy,
  Check,
  ExternalLink,
  Heart,
  Sparkles,
  ShieldCheck,
  Loader2,
} from 'lucide-react';
import { submitHubBacker } from '../lib/hubWaitlist';

interface Props {
  open: boolean;
  onClose: () => void;
  currentUsername?: string | null;
}

const UPI_ID = 'mattedhairr@axl';
const PRESET_AMOUNTS = [30, 50, 100, 250];

export default function BackerBadgeModal({ open, onClose, currentUsername }: Props) {
  const [copied, setCopied] = useState(false);
  const [selectedAmount, setSelectedAmount] = useState<number>(50);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [utr, setUtr] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const effectiveAmount = customAmount ? parseFloat(customAmount) || selectedAmount : selectedAmount;

  const handleCopy = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(UPI_ID);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    } catch {
      /* ignore */
    }
  };

  const handleOpenUpi = () => {
    const noteEncoded = encodeURIComponent(
      `YouDO Support${currentUsername ? ` @${currentUsername}` : ''}`
    );
    const upiUrl = `upi://pay?pa=${UPI_ID}&pn=YouDO%20Dev&am=${effectiveAmount}&cu=INR&tn=${noteEncoded}`;
    window.location.href = upiUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!effectiveAmount || effectiveAmount <= 0) {
      setErrorMsg('Please select or enter a valid amount');
      return;
    }

    if (!utr.trim()) {
      setErrorMsg('Please enter your 12-digit UPI Transaction / UTR number from your receipt');
      return;
    }

    setIsSubmitting(true);
    const res = await submitHubBacker({
      amount: effectiveAmount,
      utr: utr.trim(),
      note: note.trim() || undefined,
      username: currentUsername || undefined,
    });
    setIsSubmitting(false);

    if (res.success) {
      setSubmitted(true);
    } else {
      setErrorMsg(res.error || 'Failed to submit. Please try again.');
    }
  };

  const handleClose = () => {
    setErrorMsg(null);
    setSubmitted(false);
    onClose();
  };

  return (
    <Overlay open={open} onClose={handleClose} align="center">
      <div className="relative w-full max-w-md mx-auto rounded-[28px] border border-primary/25 bg-surface/98 backdrop-blur-xl p-5 sm:p-6 shadow-2xl text-content-primary overflow-hidden animate-scaleIn">
        {/* Ambient Top Glow */}
        <div className="pointer-events-none absolute -top-10 -right-10 size-36 rounded-full bg-primary/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-10 -left-10 size-36 rounded-full bg-amber-500/15 blur-3xl" />

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-subtle">
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-xl bg-gradient-to-br from-amber-500 to-primary text-white flex items-center justify-center shadow-xs">
              <Coffee size={18} strokeWidth={2.4} />
            </div>
            <div>
              <h3 className="text-[16px] font-extrabold text-content-primary leading-tight">
                Fuel Solo Dev
              </h3>
              <p className="text-[11px] text-content-muted leading-none mt-0.5">
                Support server &amp; AI tooling costs
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="size-8 rounded-full bg-elevated/80 hover:bg-elevated text-content-muted hover:text-content-primary flex items-center justify-center transition-colors"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {submitted ? (
          /* Success Screen */
          <div className="py-6 text-center space-y-3">
            <div className="size-16 rounded-full bg-primary/20 text-primary mx-auto flex items-center justify-center animate-bounce">
              <Heart size={32} fill="currentColor" />
            </div>
            <h4 className="text-[18px] font-extrabold text-content-primary">
              Thank You So Much! 🙏
            </h4>
            <p className="text-[12.5px] text-content-secondary max-w-xs mx-auto leading-relaxed">
              Your contribution record (₹{effectiveAmount}) has been received! Once verified with the
              UPI reference, an exclusive{' '}
              <span className="font-bold text-primary">Founding Backer 🌟</span> badge will be
              honored on your profile.
            </p>
            <div className="pt-3">
              <button
                type="button"
                onClick={handleClose}
                className="w-full h-10 rounded-xl bg-primary text-on-primary font-bold text-[13px] hover:opacity-95 transition-opacity"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          /* Form Content */
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            {/* UPI ID Badge & Native Pay */}
            <div className="rounded-2xl border border-primary/20 bg-primary-soft/15 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between text-[11px] text-content-muted">
                <span className="font-semibold uppercase tracking-wider text-[10px] text-primary">
                  Official UPI ID
                </span>
                <span className="flex items-center gap-1 text-[10.5px] text-content-secondary">
                  <ShieldCheck size={12} className="text-primary" /> Verified Dev
                </span>
              </div>

              <div className="flex items-center justify-between gap-2 bg-surface/90 rounded-xl border border-subtle px-3 py-2">
                <span className="font-mono font-bold text-[13.5px] text-content-primary tracking-wide select-all">
                  {UPI_ID}
                </span>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="px-2.5 py-1 rounded-lg bg-elevated hover:bg-subtle text-[11px] font-bold text-primary flex items-center gap-1 transition-colors"
                >
                  {copied ? (
                    <>
                      <Check size={12} /> Copied!
                    </>
                  ) : (
                    <>
                      <Copy size={12} /> Copy
                    </>
                  )}
                </button>
              </div>

              <button
                type="button"
                onClick={handleOpenUpi}
                className="w-full h-9 rounded-xl bg-gradient-to-r from-amber-500 to-primary text-white font-bold text-[12px] flex items-center justify-center gap-1.5 shadow-xs hover:opacity-95 active:scale-[0.98] transition-all"
              >
                <span>Pay via UPI App (GPay / PhonePe / Paytm)</span>
                <ExternalLink size={13} />
              </button>
            </div>

            {/* Amount Selection */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-content-muted">
                Select Amount
              </label>
              <div className="grid grid-cols-4 gap-2">
                {PRESET_AMOUNTS.map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => {
                      setSelectedAmount(amt);
                      setCustomAmount('');
                    }}
                    className={`h-9 rounded-xl font-bold text-[12px] transition-all border ${
                      !customAmount && selectedAmount === amt
                        ? 'bg-primary text-on-primary border-primary shadow-xs'
                        : 'bg-elevated/70 text-content-secondary border-subtle hover:border-primary/40'
                    }`}
                  >
                    ₹{amt}
                  </button>
                ))}
              </div>
            </div>

            {/* UTR / Transaction Reference */}
            <div className="space-y-1">
              <label
                htmlFor="utr-input"
                className="text-[11px] font-bold uppercase tracking-wider text-content-muted flex items-center justify-between"
              >
                <span>12-Digit UPI Ref / UTR No.</span>
                <span className="text-[10px] text-primary normal-case">from payment receipt</span>
              </label>
              <input
                id="utr-input"
                type="text"
                value={utr}
                onChange={(e) => setUtr(e.target.value.replace(/[^0-9a-zA-Z]/g, ''))}
                placeholder="e.g. 412389472910"
                maxLength={20}
                required
                className="w-full h-10 px-3 rounded-xl bg-surface border border-subtle focus:border-primary focus:outline-hidden text-[12.5px] font-mono text-content-primary placeholder:text-content-muted"
              />
            </div>

            {/* Optional Cheer Note */}
            <div className="space-y-1">
              <label
                htmlFor="cheer-note"
                className="text-[11px] font-bold uppercase tracking-wider text-content-muted"
              >
                Note or Encouragement <span className="text-[10px] lowercase text-content-muted">(optional)</span>
              </label>
              <input
                id="cheer-note"
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Loving YouDO, keep building!"
                maxLength={100}
                className="w-full h-9 px-3 rounded-xl bg-surface border border-subtle focus:border-primary focus:outline-hidden text-[12px] text-content-primary placeholder:text-content-muted"
              />
            </div>

            {currentUsername && (
              <div className="text-[11px] text-content-muted flex items-center gap-1 px-1">
                <Sparkles size={12} className="text-primary shrink-0" />
                <span>
                  Crediting to your profile: <strong className="text-content-primary">@{currentUsername}</strong>
                </span>
              </div>
            )}

            <p className="text-[10.5px] text-content-muted text-center leading-tight px-2">
              🛡️ Claims are verified by the admin against UPI receipts before the Founding Backer badge is activated.
            </p>

            {errorMsg && (
              <p className="text-[11.5px] font-semibold text-rose-500 bg-rose-500/10 border border-rose-500/20 rounded-lg p-2 text-center">
                {errorMsg}
              </p>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-10 rounded-xl bg-primary text-on-primary font-bold text-[13px] flex items-center justify-center gap-2 shadow-elevated shadow-primary/20 hover:opacity-95 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Submitting Record...</span>
                </>
              ) : (
                <>
                  <Sparkles size={15} />
                  <span>Record Contribution for Badge</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </Overlay>
  );
}
