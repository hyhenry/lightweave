// Sound-reactive effects. These run inside WLED itself (it hears the music via
// the AudioReactive usermod), so Lightweave picks the effect and colors and
// WLED does the animating. Effects are looked up by name on each controller
// because effect numbers change between WLED versions.

export type SoundPreview = 'meter' | 'centerMeter' | 'pulse' | 'splash' | 'glow' | 'confetti' | 'juggle' | 'rainbow' | 'fire';

export interface SoundEffect {
  wled: string; // effect name as listed by WLED's /json/effects
  label: string;
  blurb: string;
  preview: SoundPreview;
  usesColors: boolean; // false: the effect picks its own colors
  params?: { ix?: number; c1?: number; c2?: number; c3?: number };
}

// Only 1D effects: they look right on a roofline strip.
export const SOUND_EFFECTS = {
  bounceMeter: { wled: 'Gravcenter', label: 'Bounce Meter', blurb: 'Grows from the middle with the beat', preview: 'centerMeter', usesColors: true },
  volumeMeter: { wled: 'Gravimeter', label: 'Volume Meter', blurb: 'Rises and falls with the volume', preview: 'meter', usesColors: true },
  pulseWave: { wled: 'Pixelwave', label: 'Pulse Wave', blurb: 'Waves roll out on every beat', preview: 'pulse', usesColors: true, params: { ix: 64 } },
  splash: { wled: 'Puddles', label: 'Splash', blurb: 'Pools of color on loud notes', preview: 'splash', usesColors: true },
  ripples: { wled: 'Ripple Peak', label: 'Ripples', blurb: 'Ripples burst on the peaks', preview: 'splash', usesColors: true },
  centerGlow: { wled: 'Midnoise', label: 'Center Glow', blurb: 'A soft glow that swells with sound', preview: 'glow', usesColors: true, params: { ix: 128 } },
  confetti: { wled: 'Blurz', label: 'Confetti', blurb: 'Blurry sparks for each note', preview: 'confetti', usesColors: true },
  juggle: { wled: 'Juggles', label: 'Juggling Dots', blurb: 'Dots dance with the music', preview: 'juggle', usesColors: true },
  musicRainbow: { wled: 'Freqwave', label: 'Music Rainbow', blurb: 'Color follows the pitch', preview: 'rainbow', usesColors: false },
  djLight: { wled: 'DJ Light', label: 'DJ Light', blurb: 'Club-style color bursts', preview: 'rainbow', usesColors: false },
  soundFire: { wled: 'Noisefire', label: 'Sound Fire', blurb: 'Flames that leap with the beat', preview: 'fire', usesColors: false },
} satisfies Record<string, SoundEffect>;

export type SoundEffectId = keyof typeof SOUND_EFFECTS;
export const SOUND_EFFECT_IDS = Object.keys(SOUND_EFFECTS) as SoundEffectId[];

export function soundEffect(id: string | undefined): SoundEffect {
  return (SOUND_EFFECTS as Record<string, SoundEffect>)[id ?? ''] ?? SOUND_EFFECTS.bounceMeter;
}
