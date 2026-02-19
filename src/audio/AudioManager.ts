type SoundName =
  | "cardSlide"
  | "cardPlace"
  | "cardShuffle"
  | "cardFan"
  | "chipLay"
  | "bet"
  | "win"
  | "lose"
  | "notify"
  | "countdown"
  | "gameStart"
  | "reveal"
  | "click";

interface AudioSettings {
  volume: number;
  muted: boolean;
}

const STORAGE_KEY = "pai_gow_audio";

const DEFAULT_SETTINGS: AudioSettings = {
  volume: 0.7,
  muted: false,
};

const SFX_FILES: Partial<Record<SoundName, string[]>> = {
  cardSlide: ["/audio/card-slide-1.ogg", "/audio/card-slide-2.ogg"],
  cardPlace: ["/audio/card-place-1.ogg", "/audio/card-place-2.ogg"],
  cardShuffle: ["/audio/card-shuffle.ogg"],
  cardFan: ["/audio/card-fan-1.ogg"],
  chipLay: ["/audio/chip-lay-1.ogg", "/audio/chip-lay-2.ogg", "/audio/chip-lay-3.ogg"],
};

const PENTATONIC = [261.63, 293.66, 329.63, 392.0, 440.0];
const PENTATONIC_HIGH = PENTATONIC.map((f) => f * 2);
const PENTATONIC_LOW = PENTATONIC.map((f) => f / 2);

class AudioManager {
  private ctx: AudioContext | null = null;
  private settings: AudioSettings;
  private sfxBuffers = new Map<string, AudioBuffer>();
  private gainNode: GainNode | null = null;
  private listeners = new Set<() => void>();
  private loaded = false;
  private settingsSnapshot: AudioSettings;

  constructor() {
    this.settings = this.loadSettings();
    this.settingsSnapshot = { ...this.settings };
  }

  private loadSettings(): AudioSettings {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          volume: typeof parsed.volume === "number" ? parsed.volume : DEFAULT_SETTINGS.volume,
          muted: typeof parsed.muted === "boolean" ? parsed.muted : DEFAULT_SETTINGS.muted,
        };
      }
    } catch {}
    return { ...DEFAULT_SETTINGS };
  }

  private saveSettings() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    } catch {}
    this.settingsSnapshot = { ...this.settings };
    this.listeners.forEach((fn) => fn());
  }

  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  }

  getSettings(): AudioSettings {
    return this.settingsSnapshot;
  }

  private ensureContext(): AudioContext {
    if (!this.ctx || this.ctx.state === "closed") {
      this.ctx = new AudioContext();
      this.gainNode = this.ctx.createGain();
      this.gainNode.connect(this.ctx.destination);
      this.applyVolume();
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
    return this.ctx;
  }

  private applyVolume() {
    if (!this.gainNode || !this.ctx) return;
    const target = this.settings.muted ? 0 : this.settings.volume;
    this.gainNode.gain.setTargetAtTime(target, this.ctx.currentTime, 0.05);
  }

  async preload() {
    if (this.loaded) return;
    this.loaded = true;
    const ctx = this.ensureContext();
    const entries = Object.values(SFX_FILES).flat();
    await Promise.allSettled(
      entries.map(async (url) => {
        try {
          const resp = await fetch(url);
          const buf = await resp.arrayBuffer();
          const decoded = await ctx.decodeAudioData(buf);
          this.sfxBuffers.set(url, decoded);
        } catch {}
      }),
    );
  }

  play(name: SoundName) {
    if (this.settings.muted) return;
    const ctx = this.ensureContext();

    const files = SFX_FILES[name];
    if (files && files.length > 0) {
      const url = files[Math.floor(Math.random() * files.length)];
      const buffer = this.sfxBuffers.get(url);
      if (buffer) {
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(this.gainNode!);
        source.start();
        return;
      }
    }

    this.playSynth(name);
  }

  private playSynth(name: SoundName) {
    const ctx = this.ensureContext();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(this.gainNode!);

    switch (name) {
      case "bet": {
        osc.type = "triangle";
        osc.frequency.setValueAtTime(PENTATONIC[2], now);
        osc.frequency.setValueAtTime(PENTATONIC[4], now + 0.08);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
        break;
      }
      case "win": {
        osc.type = "triangle";
        const notes = [PENTATONIC[0], PENTATONIC[2], PENTATONIC[4], PENTATONIC_HIGH[0]];
        notes.forEach((freq, i) => {
          osc.frequency.setValueAtTime(freq, now + i * 0.12);
        });
        gain.gain.setValueAtTime(0.35, now);
        gain.gain.setValueAtTime(0.35, now + 0.4);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.7);
        osc.start(now);
        osc.stop(now + 0.7);
        break;
      }
      case "lose": {
        osc.type = "sine";
        osc.frequency.setValueAtTime(PENTATONIC[4], now);
        osc.frequency.linearRampToValueAtTime(PENTATONIC_LOW[0], now + 0.4);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
        osc.start(now);
        osc.stop(now + 0.5);
        break;
      }
      case "notify": {
        osc.type = "sine";
        osc.frequency.setValueAtTime(PENTATONIC_HIGH[3], now);
        osc.frequency.setValueAtTime(PENTATONIC_HIGH[4], now + 0.1);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.25);
        break;
      }
      case "countdown": {
        osc.type = "sine";
        osc.frequency.setValueAtTime(PENTATONIC[3], now);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
        osc.start(now);
        osc.stop(now + 0.12);
        break;
      }
      case "gameStart": {
        osc.type = "triangle";
        const melody = [PENTATONIC_LOW[3], PENTATONIC[0], PENTATONIC[2], PENTATONIC[4], PENTATONIC_HIGH[0]];
        melody.forEach((freq, i) => {
          osc.frequency.setValueAtTime(freq, now + i * 0.1);
        });
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.setValueAtTime(0.3, now + 0.45);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.8);
        osc.start(now);
        osc.stop(now + 0.8);
        break;
      }
      case "reveal": {
        osc.type = "triangle";
        osc.frequency.setValueAtTime(PENTATONIC[0], now);
        osc.frequency.setValueAtTime(PENTATONIC[3], now + 0.06);
        osc.frequency.setValueAtTime(PENTATONIC_HIGH[0], now + 0.12);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
        break;
      }
      case "click": {
        osc.type = "square";
        osc.frequency.setValueAtTime(800, now);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
        osc.start(now);
        osc.stop(now + 0.06);
        break;
      }
      default: {
        gain.disconnect();
        break;
      }
    }
  }

  setVolume(v: number) {
    this.settings.volume = Math.max(0, Math.min(1, v));
    this.applyVolume();
    this.saveSettings();
  }

  toggleMute() {
    this.settings.muted = !this.settings.muted;
    this.applyVolume();
    this.saveSettings();
  }

  unlock() {
    this.ensureContext();
    this.preload();
  }
}

export const audioManager = new AudioManager();
export type { SoundName, AudioSettings };
