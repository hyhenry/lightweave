// Pattern helpers for the app: motion labels and starting points for the editor.

import type { Animation, Pattern } from '../../../shared/types.ts';
import { soundEffect } from '../../../shared/sound.ts';

export const ANIMATION_INFO: Record<Animation, { label: string; icon: string; blurb: string }> = {
  static: { label: 'Still', icon: '●', blurb: 'Colors stay put' },
  chase: { label: 'Chase', icon: '➜', blurb: 'Pattern glides along' },
  marquee: { label: 'Marquee', icon: '⋯', blurb: 'Steps like theater lights' },
  twinkle: { label: 'Twinkle', icon: '✦', blurb: 'Lights fade in and out' },
  sparkle: { label: 'Sparkle', icon: '✧', blurb: 'Quick white glints' },
  breathe: { label: 'Breathe', icon: '◐', blurb: 'Gently dims and brightens' },
  wave: { label: 'Wave', icon: '〰', blurb: 'A glow rolls through' },
  colorCycle: { label: 'Color Fade', icon: '◑', blurb: 'All lights fade color to color' },
  sound: { label: 'Sound', icon: '♪', blurb: 'Dances to music' },
};

/** Order of the motion buttons in the editor. */
export const MOTIONS: Animation[] = ['static', 'chase', 'marquee', 'twinkle', 'sparkle', 'breathe', 'wave', 'colorCycle', 'sound'];

/** Motions that can run forward or in reverse. */
export const DIRECTIONAL: Animation[] = ['chase', 'marquee', 'wave', 'colorCycle'];

/** "Chase", or "♪ Bounce Meter" for sound patterns. */
export function motionLabel(p: Pattern) {
  return p.animation === 'sound' ? `♪ ${soundEffect(p.sound).label}` : ANIMATION_INFO[p.animation].label;
}

export function newPattern(): Pattern {
  return {
    id: '',
    name: '',
    category: 'My Patterns',
    blocks: [
      { color: '#FF0000', count: 3 },
      { color: '#FFFFFF', count: 3 },
    ],
    animation: 'static',
    speed: 4,
    direction: 'forward',
    brightness: 100,
    blend: false,
  };
}

/** What the editor starts from: a built-in theme becomes a personal copy. */
export function editableCopy(p: Pattern): Pattern {
  return {
    ...p,
    name: p.builtIn ? `${p.name} (mine)` : p.name,
    category: p.builtIn ? 'My Patterns' : p.category,
    blocks: p.blocks.map((b) => ({ ...b })),
  };
}

export function speedLabel(speed: number) {
  return speed <= 3 ? 'Slow' : speed >= 8 ? 'Fast' : 'Medium';
}
