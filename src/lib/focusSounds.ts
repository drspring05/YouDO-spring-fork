import { STORAGE_KEYS } from './storageKeys';

/**
 * Focus sounds: calm music or steady sound while a session runs. Recordings are
 * CC0 (sources in docs/focus-sounds.md); brown and pink noise are generated here.
 * They play only during a session, pause and resume with it, and fade in and out.
 */
export type FocusSoundId = 'guitar' | 'piano-jrpg' | 'piano-catmint' | 'thunder' | 'forest' | 'brown' | 'pink';

export interface FocusSound {
  id: FocusSoundId;
  label: string;
  /** seamless: a music loop; crossfade: a recording that blends its end into its start; noise: generated. */
  kind: 'seamless' | 'crossfade' | 'noise';
  src?: string;
}

export const FOCUS_SOUNDS: FocusSound[] = [
  { id: 'guitar', label: 'Acoustic guitar', kind: 'seamless', src: 'sounds/guitar.ogg' },
  { id: 'piano-jrpg', label: 'Soft piano', kind: 'seamless', src: 'sounds/piano-jrpg.ogg' },
  { id: 'piano-catmint', label: 'Gentle piano', kind: 'seamless', src: 'sounds/piano-catmint.ogg' },
  { id: 'thunder', label: 'Soft thunder', kind: 'crossfade', src: 'sounds/thunder.ogg' },
  { id: 'forest', label: 'Forest stream', kind: 'crossfade', src: 'sounds/forest.ogg' },
  { id: 'brown', label: 'Brown noise', kind: 'noise' },
  { id: 'pink', label: 'Pink noise', kind: 'noise' },
];

export interface FocusSoundPrefs {
  /** null: no sound. */
  sound: FocusSoundId | null;
  /** 0–1 */
  volume: number;
  /** Keep playing while the app is in the background or the screen is off. */
  keepPlaying: boolean;
}

export const DEFAULT_FOCUS_SOUND_PREFS: FocusSoundPrefs = { sound: null, volume: 0.6, keepPlaying: false };
export const FOCUS_SOUNDS_EVENT = 'youdo-focus-sounds-changed';

export function parseFocusSoundPrefs(raw: unknown): FocusSoundPrefs {
  const row = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const sound = FOCUS_SOUNDS.some((s) => s.id === row.sound) ? (row.sound as FocusSoundId) : null;
  const volume = typeof row.volume === 'number' && Number.isFinite(row.volume)
    ? Math.min(1, Math.max(0, row.volume))
    : DEFAULT_FOCUS_SOUND_PREFS.volume;
  return { sound, volume, keepPlaying: row.keepPlaying === true };
}

export function readFocusSoundPrefs(): FocusSoundPrefs {
  try {
    return parseFocusSoundPrefs(JSON.parse(localStorage.getItem(STORAGE_KEYS.focusSounds) ?? 'null'));
  } catch {
    return { ...DEFAULT_FOCUS_SOUND_PREFS };
  }
}

export function saveFocusSoundPrefs(next: FocusSoundPrefs): void {
  try {
    localStorage.setItem(STORAGE_KEYS.focusSounds, JSON.stringify(next));
  } catch {
    /* Restricted storage: the choice lasts for this visit. */
  }
  window.dispatchEvent(new Event(FOCUS_SOUNDS_EVENT));
}

/**
 * What the player should do right now. Sound follows the session: it plays
 * while the timer runs, pauses with it, and stops when it ends. Leaving the app
 * (or turning the screen off) pauses it too, unless "Keep playing" is on.
 */
export function focusSoundAction(state: {
  session: boolean;
  paused: boolean;
  sound: FocusSoundId | null;
  visible: boolean;
  keepPlaying: boolean;
}): 'play' | 'pause' | 'stop' {
  if (!state.session || !state.sound) return 'stop';
  if (state.paused || (!state.visible && !state.keepPlaying)) return 'pause';
  return 'play';
}

/**
 * Brown (deep, like a far waterfall) or pink (softer rain-like hiss) noise. The
 * last `blend` samples are mixed into the first ones so the loop has no seam.
 */
export function generateNoise(kind: 'brown' | 'pink', length: number, random: () => number = Math.random): Float32Array {
  const blend = Math.min(Math.floor(length / 8), 4096);
  const raw = new Float32Array(length + blend);
  if (kind === 'brown') {
    let last = 0;
    for (let i = 0; i < raw.length; i++) {
      last = (last + 0.02 * (random() * 2 - 1)) / 1.02;
      raw[i] = last * 3.5;
    }
  } else {
    // Paul Kellet's economy pink filter.
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < raw.length; i++) {
      const white = random() * 2 - 1;
      b0 = 0.99765 * b0 + white * 0.099046;
      b1 = 0.963 * b1 + white * 0.2965164;
      b2 = 0.57 * b2 + white * 1.0526913;
      raw[i] = (b0 + b1 + b2 + white * 0.1848) * 0.11;
    }
  }
  const out = raw.slice(0, length);
  for (let i = 0; i < blend; i++) {
    const t = i / blend;
    out[i] = out[i] * t + raw[length + i] * (1 - t);
  }
  return out;
}

const FADE_S = 1.5;
const CROSSFADE_S = 4;
/** Settings plays this much of a sound when you pick it outside a session. */
const PREVIEW_MS = 5000;

/** One player for the whole app. Web Audio, so loops are gapless and fades are smooth. */
class FocusSoundPlayer {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private buffers = new Map<FocusSoundId, Promise<AudioBuffer>>();
  private current: { id: FocusSoundId; stop: () => void } | null = null;
  private volume = DEFAULT_FOCUS_SOUND_PREFS.volume;
  private token = 0;
  private previewTimer = 0;

  private context(): AudioContext | null {
    if (this.ctx) return this.ctx;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(this.ctx.destination);
    return this.ctx;
  }

  private buffer(sound: FocusSound): Promise<AudioBuffer> {
    const ctx = this.context()!;
    let pending = this.buffers.get(sound.id);
    if (!pending) {
      pending = sound.kind === 'noise'
        ? Promise.resolve((() => {
          const length = ctx.sampleRate * 8;
          const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
          buffer.copyToChannel(generateNoise(sound.id as 'brown' | 'pink', length), 0);
          return buffer;
        })())
        : fetch(`${import.meta.env.BASE_URL}${sound.src}`)
          .then((r) => {
            if (!r.ok) throw new Error('Sound unavailable');
            return r.arrayBuffer();
          })
          .then((data) => ctx.decodeAudioData(data));
      pending.catch(() => this.buffers.delete(sound.id));
      this.buffers.set(sound.id, pending);
    }
    return pending;
  }

  private ramp(to: number, seconds: number) {
    if (!this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(this.master.gain.value, now);
    this.master.gain.linearRampToValueAtTime(to, now + seconds);
  }

  /** Start (or switch to) a sound for the session, fading in. Ends any preview. */
  play(id: FocusSoundId): Promise<void> {
    this.clearPreview();
    return this.start(id);
  }

  /** True while a Settings preview plays (no session owns the sound). */
  get previewing(): boolean {
    return this.previewTimer !== 0;
  }

  /** A preview may play only when no session is using the player. */
  get canPreview(): boolean {
    return this.current === null || this.previewing;
  }

  /** Play a few seconds of a sound, then fade it out. */
  preview(id: FocusSoundId) {
    this.clearPreview();
    this.previewTimer = window.setTimeout(() => {
      this.previewTimer = 0;
      void this.stop();
    }, PREVIEW_MS);
    void this.start(id);
  }

  endPreview() {
    if (!this.previewing) return;
    this.clearPreview();
    void this.stop();
  }

  private clearPreview() {
    window.clearTimeout(this.previewTimer);
    this.previewTimer = 0;
  }

  private async start(id: FocusSoundId): Promise<void> {
    const sound = FOCUS_SOUNDS.find((s) => s.id === id);
    const ctx = this.context();
    if (!sound || !ctx || !this.master) return;
    if (this.current?.id === id) {
      await this.resume();
      return;
    }
    const token = ++this.token;
    this.stopCurrent();
    const buffer = await this.buffer(sound).catch(() => null);
    if (!buffer || token !== this.token) return;
    this.wake(ctx);
    this.current = { id, stop: sound.kind === 'crossfade' ? this.startCrossfade(buffer) : this.startLoop(buffer) };
    this.ramp(this.volume, FADE_S);
  }

  /**
   * Start the audio clock. A browser may hold it until the next tap (for
   * example after a reload mid-session), so the first tap also wakes it.
   */
  private wake(ctx: AudioContext) {
    if (ctx.state !== 'suspended') return;
    void ctx.resume().catch(() => undefined);
    window.addEventListener('pointerdown', () => {
      if (this.current && ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
    }, { once: true, capture: true });
  }

  private startLoop(buffer: AudioBuffer): () => void {
    const source = this.ctx!.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(this.master!);
    source.start();
    return () => {
      try { source.stop(); } catch { /* already stopped */ }
      source.disconnect();
    };
  }

  /** A recording that isn't a loop: each pass fades into the next over a few seconds. */
  private startCrossfade(buffer: AudioBuffer): () => void {
    const ctx = this.ctx!;
    const fade = Math.min(CROSSFADE_S, buffer.duration / 4);
    const live: { source: AudioBufferSourceNode; gain: GainNode }[] = [];
    let stopped = false;
    const schedule = (at: number) => {
      if (stopped) return;
      const source = ctx.createBufferSource();
      const gain = ctx.createGain();
      source.buffer = buffer;
      source.connect(gain).connect(this.master!);
      const end = at + buffer.duration;
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(1, at + fade);
      gain.gain.setValueAtTime(1, end - fade);
      gain.gain.linearRampToValueAtTime(0, end);
      source.start(at);
      const entry = { source, gain };
      live.push(entry);
      source.onended = () => {
        live.splice(live.indexOf(entry), 1);
        source.disconnect();
        gain.disconnect();
      };
      // Queue the next pass as soon as this one starts, timed by the audio clock.
      const next = end - fade;
      window.setTimeout(() => schedule(next), Math.max(0, (at - ctx.currentTime) * 1000));
    };
    schedule(ctx.currentTime);
    return () => {
      stopped = true;
      for (const { source } of live.splice(0)) {
        try { source.stop(); } catch { /* already stopped */ }
      }
    };
  }

  private stopCurrent() {
    this.current?.stop();
    this.current = null;
  }

  /** Fade out and hold the audio clock (resume picks up where it was). */
  async pause(): Promise<void> {
    if (!this.ctx || !this.current || this.ctx.state !== 'running') return;
    const token = this.token;
    this.ramp(0, FADE_S / 2);
    await new Promise((r) => window.setTimeout(r, (FADE_S / 2) * 1000));
    if (token === this.token && this.master && this.master.gain.value < 0.01) await this.ctx.suspend().catch(() => undefined);
  }

  async resume(): Promise<void> {
    if (!this.ctx || !this.current) return;
    // A newer request: a pause or stop still fading out must not cut the sound.
    this.token++;
    this.wake(this.ctx);
    this.ramp(this.volume, FADE_S);
  }

  /** Fade out and let the sound go. */
  async stop(): Promise<void> {
    if (!this.current) return;
    const token = ++this.token;
    this.ramp(0, FADE_S);
    await new Promise((r) => window.setTimeout(r, FADE_S * 1000));
    if (token === this.token) this.stopCurrent();
  }

  setVolume(volume: number) {
    this.volume = Math.min(1, Math.max(0, volume));
    if (this.current && this.ctx?.state === 'running') this.ramp(this.volume, 0.15);
  }

  get playing(): FocusSoundId | null {
    return this.current?.id ?? null;
  }
}

export const focusSoundPlayer = new FocusSoundPlayer();
