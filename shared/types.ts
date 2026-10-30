// Core data model shared by the server and the web app.

/** One run of a single color, e.g. "3 red lights". */
export interface ColorBlock {
  color: string; // "#rrggbb"; "#000000" means lights off (a gap)
  count: number; // how many LEDs in a row get this color
}

export const ANIMATIONS = [
  'static',
  'chase',
  'twinkle',
  'sparkle',
  'breathe',
  'wave',
  'colorCycle',
  'marquee',
] as const;
export type Animation = (typeof ANIMATIONS)[number];

export interface Pattern {
  id: string;
  name: string;
  category: string; // "Halloween", "Christmas", "My Patterns", ...
  blocks: ColorBlock[]; // repeated along the whole strip
  animation: Animation;
  speed: number; // 1 (slow) .. 10 (fast)
  direction: 'forward' | 'reverse';
  brightness: number; // 1..100 (%)
  blend: boolean; // smooth gradients between blocks instead of hard edges
  builtIn?: boolean; // shipped theme; edits are saved as a copy
  createdAt?: number;
  updatedAt?: number;
}

export interface Device {
  id: string;
  name: string;
  host: string; // "192.168.1.50" or "192.168.1.50:8080" (HTTP port); DDP always goes to port 4048
  ledCount: number;
  reverse: boolean; // flip direction (e.g. strip wired from the other end)
}

export interface DeviceStatus {
  online: boolean;
  playing?: { patternId: string; patternName: string; mode: 'static' | 'stream' };
  power?: boolean;
  error?: string;
}
