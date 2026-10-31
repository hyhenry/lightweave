// Sound-reactive effects. These run inside WLED itself (it hears the music via
// the AudioReactive usermod), so Lightweave picks the effect and colors and
// WLED does the animating. Effects are looked up by name on each controller
// because effect numbers change between WLED versions.

export type SoundPreview = 'meter' | 'centerMeter' | 'pulse' | 'splash' | 'burst' | 'stream' | 'glow' | 'confetti' | 'juggle' | 'rainbow' | 'fire';

export interface SoundEffect {
  wled: string; // effect name as listed by WLED's /json/effects
  label: string;
  blurb: string;
  preview: SoundPreview;
  usesColors: boolean; // false: the effect picks its own colors
  // Slider values, on top of DEFAULT_PARAMS. All of them are sent every time:
  // WLED doesn't reset sliders when the effect changes.
  params?: { ix?: number; c1?: number; c2?: number; c3?: number; o1?: boolean; o2?: boolean; o3?: boolean };
  // WLED speed range our 1–10 speed maps onto. Where speed is the fade rate, the
  // top end clears the strip in a frame or two, so these stop short of it.
  speed?: [number, number];
}

export const DEFAULT_PARAMS = { ix: 128, c1: 128, c2: 128, c3: 16, o1: false, o2: false, o3: false };

// The particle effects listen to one frequency band (c3 / 2; 0 is the deepest bass)
// and, with o2, compare it to its own recent average, so they fire on bass hits
// rather than whenever the music is loud.
const BASS = { c3: 0, o2: true };

// Only 1D effects: they look right on a roofline strip.
export const SOUND_EFFECTS = {
  bassBurst: { wled: 'PS Sonic Boom', label: 'Bass Burst', blurb: 'Bursts of sparks on every bass hit', preview: 'burst', usesColors: true, params: { ...BASS, c1: 96, c2: 255 } },
  bassStream: { wled: 'PS Sonic Stream', label: 'Bass Stream', blurb: 'Sparks shoot along with the bass', preview: 'stream', usesColors: true, params: { ...BASS, c1: 128, c2: 64 } },
  bounceMeter: { wled: 'Gravcenter', label: 'Bounce Meter', blurb: 'Grows from the middle with the beat', preview: 'centerMeter', usesColors: true },
  volumeMeter: { wled: 'Gravimeter', label: 'Volume Meter', blurb: 'Rises and falls with the volume', preview: 'meter', usesColors: true },
  // Brightness is volume × ix / 64 squeezed into a byte, so more than 64 wraps around and flickers.
  pulseWave: { wled: 'Pixelwave', label: 'Pulse Wave', blurb: 'Waves roll out on every beat', preview: 'pulse', usesColors: true, params: { ix: 64 } },
  // ix is the puddle size: a loud note at 255 lights ~25 LEDs.
  splash: { wled: 'Puddles', label: 'Splash', blurb: 'Pools of color on loud notes', preview: 'splash', usesColors: true, params: { ix: 255 }, speed: [32, 176] },
  // ix / 16 ripples start on each peak; this effect ignores speed.
  ripples: { wled: 'Ripple Peak', label: 'Ripples', blurb: 'Ripples burst on the peaks', preview: 'splash', usesColors: true, params: { ix: 255 } },
  // ix sets the length (squared), so a little above the middle goes a long way.
  centerGlow: { wled: 'Midnoise', label: 'Center Glow', blurb: 'A soft glow that swells with sound', preview: 'glow', usesColors: true, params: { ix: 160 }, speed: [48, 200] },
  confetti: { wled: 'Blurz', label: 'Confetti', blurb: 'Blurry sparks for each note', preview: 'confetti', usesColors: true, speed: [64, 224] },
  // ix / 32 + 1 dots. They move on their own; the sound sets how bright they are.
  juggle: { wled: 'Juggles', label: 'Juggling Dots', blurb: 'Dots dance with the music', preview: 'juggle', usesColors: true, params: { ix: 192 } },
  musicRainbow: { wled: 'Freqwave', label: 'Music Rainbow', blurb: 'Color follows the pitch', preview: 'rainbow', usesColors: false },
  djLight: { wled: 'DJ Light', label: 'DJ Light', blurb: 'Club-style color bursts', preview: 'rainbow', usesColors: false },
  soundFire: { wled: 'Noisefire', label: 'Sound Fire', blurb: 'Flames that leap with the beat', preview: 'fire', usesColors: false },
} satisfies Record<string, SoundEffect>;

export type SoundEffectId = keyof typeof SOUND_EFFECTS;
export const SOUND_EFFECT_IDS = Object.keys(SOUND_EFFECTS) as SoundEffectId[];

export function soundEffect(id: string | undefined): SoundEffect {
  return (SOUND_EFFECTS as Record<string, SoundEffect>)[id ?? ''] ?? SOUND_EFFECTS.bounceMeter;
}

/** WLED's speed (0–255) for a pattern speed of 1 (slow) to 10 (fast). */
export function effectSpeed(fx: SoundEffect, speed: number): number {
  const [lo, hi] = fx.speed ?? [0, 255];
  return Math.round(lo + ((speed - 1) / 9) * (hi - lo));
}
