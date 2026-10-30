// Built-in holiday and everyday themes. Each is a normal Pattern, so any of
// them can be duplicated and tweaked in the editor.

import type { Animation, Pattern } from './types.ts';

const C = {
  red: '#FF0000',
  deepRed: '#B00010',
  green: '#00C020',
  deepGreen: '#007A1E',
  white: '#FFFFFF',
  warm: '#FFB45A',
  softWarm: '#FFC98A',
  cool: '#D8E8FF',
  blue: '#0030FF',
  royal: '#1A3CFF',
  orange: '#FF5A00',
  amber: '#FF8C00',
  gold: '#FFB000',
  purple: '#7A00FF',
  violet: '#B000FF',
  lime: '#7CFF00',
  pink: '#FF2A7A',
  hotPink: '#FF0090',
  blush: '#FF7AA8',
  lavender: '#B48CFF',
  mint: '#7CFFB0',
  sky: '#5AC8FF',
  butter: '#FFE45A',
  teal: '#00D0B0',
  off: '#000000',
};

type Spec = [name: string, blocks: [string, number][], animation?: Animation, speed?: number, extra?: Partial<Pattern>];

/** `idPrefix` keeps theme IDs (and so favorites) stable if a category is renamed. */
function group(category: string, specs: Spec[], idPrefix = category): Pattern[] {
  return specs.map(([name, blocks, animation = 'static', speed = 4, extra = {}]) => ({
    id: `builtin-${idPrefix}-${name}`.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    name,
    category,
    blocks: blocks.map(([color, count]) => ({ color, count })),
    animation,
    speed,
    direction: 'forward',
    brightness: 100,
    blend: false,
    builtIn: true,
    ...extra,
  }));
}

/** Themes for any time of year, no holiday needed. */
export const ANYTIME = 'Everyday & Celebrations';

export const BUILT_IN_THEMES: Pattern[] = [
  ...group(ANYTIME, [
    ['Warm White', [[C.warm, 1]]],
    ['Soft Glow', [[C.softWarm, 1]], 'static', 4, { brightness: 45 }],
    ['Bright White', [[C.cool, 1]]],
    ['Gold Accent', [[C.warm, 3], [C.off, 2]]],
    ['Rainbow Drift', [[C.red, 4], [C.orange, 4], [C.butter, 4], [C.green, 4], [C.sky, 4], [C.purple, 4]], 'chase', 3, { blend: true }],
  ], 'Everyday'),
  ...group(ANYTIME, [
    ['Birthday Party', [[C.hotPink, 2], [C.butter, 2], [C.sky, 2], [C.lime, 2]], 'marquee', 6],
    ['Pride', [[C.red, 3], [C.orange, 3], [C.butter, 3], [C.green, 3], [C.royal, 3], [C.violet, 3]], 'chase', 3],
    ['Under the Sea', [[C.teal, 3], [C.blue, 3], [C.sky, 2]], 'wave', 2, { blend: true }],
    ['Game Day', [[C.royal, 3], [C.gold, 3]], 'chase', 6],
  ], 'Celebrations'),
  ...group('Sound Reactive', [
    ['Party Meter', [[C.green, 1], [C.butter, 1], [C.red, 1]], 'sound', 5, { sound: 'volumeMeter' }],
    ['Bounce to the Beat', [[C.hotPink, 1], [C.violet, 1], [C.sky, 1]], 'sound', 5, { sound: 'bounceMeter' }],
    ['Neon Pulse', [[C.hotPink, 1], [C.sky, 1], [C.violet, 1]], 'sound', 5, { sound: 'pulseWave' }],
    ['Warm Glow Beat', [[C.warm, 1], [C.amber, 1], [C.orange, 1]], 'sound', 4, { sound: 'centerGlow' }],
    ['Ocean Ripples', [[C.teal, 1], [C.blue, 1], [C.sky, 1]], 'sound', 4, { sound: 'ripples' }],
    ['Confetti Party', [[C.hotPink, 1], [C.butter, 1], [C.sky, 1]], 'sound', 6, { sound: 'confetti' }],
    ['Juggling Lights', [[C.red, 1], [C.green, 1], [C.royal, 1]], 'sound', 5, { sound: 'juggle' }],
    ['Monster Splash', [[C.orange, 1], [C.purple, 1], [C.lime, 1]], 'sound', 5, { sound: 'splash' }],
    ['Jingle Bounce', [[C.red, 1], [C.white, 1], [C.green, 1]], 'sound', 5, { sound: 'bounceMeter' }],
    ['Canada Beat', [[C.red, 1], [C.white, 1]], 'sound', 5, { sound: 'volumeMeter' }],
    ['Music Rainbow', [[C.red, 1]], 'sound', 5, { sound: 'musicRainbow' }],
    ['DJ Light', [[C.red, 1]], 'sound', 6, { sound: 'djLight' }],
    ['Sound Fire', [[C.orange, 1]], 'sound', 5, { sound: 'soundFire' }],
  ]),
  ...group('Halloween', [
    ['Pumpkin Patch', [[C.orange, 3], [C.purple, 3]]],
    ['Jack-o’-Lantern', [[C.orange, 4], [C.off, 1]]],
    ['Witchy', [[C.purple, 2], [C.lime, 2]], 'twinkle', 4],
    ['Haunted Flicker', [[C.orange, 1]], 'sparkle', 7],
    ['Candy Corn', [[C.butter, 2], [C.orange, 2], [C.white, 2]], 'chase', 3],
    ['Monster Mash', [[C.lime, 2], [C.purple, 2], [C.orange, 2]], 'marquee', 5],
    ['Spooky Breath', [[C.purple, 4], [C.orange, 4]], 'breathe', 3, { blend: true }],
    ['Ghostly', [[C.cool, 1], [C.off, 3]], 'twinkle', 2],
    ['Poison Apple', [[C.lime, 3], [C.deepRed, 3]], 'breathe', 4],
    ['Bonfire', [[C.orange, 2], [C.red, 1], [C.amber, 2]], 'sparkle', 6, { blend: true }],
    ['Graveyard Fog', [[C.violet, 3], [C.teal, 3]], 'wave', 2, { blend: true }],
  ]),
  ...group('Remembrance Day', [
    ['Poppy', [[C.red, 4], [C.off, 1]], 'static', 4, { brightness: 70 }],
    ['Poppy Field', [[C.red, 3], [C.deepRed, 2]], 'static', 4, { brightness: 70 }],
    ['Lest We Forget', [[C.red, 3], [C.white, 1]], 'breathe', 1, { brightness: 70 }],
    ['Silent Vigil', [[C.softWarm, 1]], 'breathe', 1, { brightness: 50 }],
  ]),
  ...group('Hanukkah', [
    ['Hanukkah', [[C.royal, 3], [C.white, 3]]],
    ['Hanukkah Glow', [[C.royal, 3], [C.white, 3]], 'breathe', 3],
    ['Eight Nights', [[C.royal, 2], [C.white, 1], [C.sky, 2], [C.white, 1]], 'chase', 2],
    ['Menorah Light', [[C.gold, 1], [C.royal, 3]], 'twinkle', 3],
    ['Silver & Blue', [[C.cool, 2], [C.blue, 2]], 'wave', 3, { blend: true }],
  ]),
  ...group('Winter', [
    ['Northern Lights', [[C.green, 4], [C.teal, 3], [C.purple, 3]], 'wave', 2, { blend: true }],
    ['Frosty', [[C.white, 2], [C.sky, 2]], 'wave', 3, { blend: true }],
    ['Snowflakes', [[C.white, 1], [C.off, 2]], 'twinkle', 3],
    ['Ice Blue', [[C.sky, 1]]],
  ]),
  ...group('Christmas', [
    ['Classic Red & Green', [[C.red, 3], [C.green, 3]]],
    ['Candy Cane', [[C.red, 3], [C.white, 3]], 'chase', 3],
    ['Old-Fashioned Bulbs', [[C.red, 1], [C.green, 1], [C.blue, 1], [C.amber, 1], [C.purple, 1]]],
    ['Warm Christmas', [[C.warm, 3], [C.red, 1], [C.warm, 3], [C.green, 1]]],
    ['Twinkling Tree', [[C.green, 3], [C.red, 1], [C.green, 3], [C.gold, 1]], 'twinkle', 4],
    ['Snowfall', [[C.cool, 1], [C.sky, 1]], 'sparkle', 6, { blend: true }],
    ['Icicles', [[C.white, 2], [C.sky, 3], [C.blue, 3]], 'chase', 5, { blend: true }],
    ['Santa’s Workshop', [[C.red, 2], [C.white, 1], [C.green, 2], [C.white, 1]], 'marquee', 4],
    ['Gingerbread', [[C.amber, 2], [C.white, 1], [C.red, 1]]],
    ['Mistletoe', [[C.deepGreen, 3], [C.white, 1]]],
    ['Northern Star', [[C.gold, 1], [C.off, 2], [C.white, 1], [C.off, 2]], 'twinkle', 3],
    ['Sugar Plum', [[C.hotPink, 2], [C.lavender, 2], [C.white, 1]], 'twinkle', 4],
    ['Christmas Morning', [[C.red, 2], [C.green, 2], [C.gold, 2]], 'colorCycle', 3],
  ]),
  ...group('New Year’s Eve', [
    ['New Year’s Eve', [[C.gold, 2], [C.white, 2], [C.purple, 1]], 'sparkle', 8],
    ['Champagne', [[C.gold, 3], [C.white, 1]], 'sparkle', 6],
    ['Countdown', [[C.white, 1], [C.gold, 1], [C.purple, 1]], 'marquee', 8],
    ['Midnight', [[C.royal, 3], [C.gold, 1]], 'twinkle', 4],
  ]),
  ...group('Valentine’s Day', [
    ['Sweetheart', [[C.red, 3], [C.pink, 3], [C.white, 2]]],
    ['Love Notes', [[C.hotPink, 2], [C.red, 2]], 'twinkle', 4],
    ['Heartbeat', [[C.red, 1]], 'breathe', 6],
    ['Roses', [[C.deepRed, 3], [C.pink, 2], [C.deepGreen, 1]]],
    ['Cupid', [[C.blush, 2], [C.white, 1]], 'chase', 3],
    ['Be Mine', [[C.hotPink, 2], [C.red, 2], [C.blush, 2]], 'colorCycle', 3],
  ]),
  ...group('St. Patrick’s Day', [
    ['Shamrock', [[C.green, 3], [C.white, 1], [C.deepGreen, 3], [C.gold, 1]]],
    ['Lucky Chase', [[C.green, 3], [C.gold, 1]], 'chase', 4],
    ['Pot of Gold', [[C.gold, 2], [C.green, 2]], 'sparkle', 5],
    ['Irish Flag', [[C.green, 3], [C.white, 3], [C.orange, 3]]],
    ['Emerald Isle', [[C.green, 3], [C.mint, 2], [C.deepGreen, 3]], 'wave', 3, { blend: true }],
  ]),
  ...group('Easter', [
    ['Pastel Eggs', [[C.blush, 2], [C.lavender, 2], [C.mint, 2], [C.butter, 2], [C.sky, 2]]],
    ['Spring Garden', [[C.mint, 2], [C.blush, 2], [C.butter, 2]], 'wave', 3, { blend: true }],
    ['Easter Basket', [[C.butter, 2], [C.mint, 2], [C.blush, 2], [C.lavender, 2]], 'twinkle', 3],
    ['Spring Tulips', [[C.pink, 3], [C.butter, 1], [C.green, 1]]],
    ['Daffodils', [[C.butter, 3], [C.white, 1], [C.green, 1]]],
    ['Jelly Beans', [[C.pink, 1], [C.lime, 1], [C.orange, 1], [C.purple, 1], [C.butter, 1], [C.sky, 1]], 'marquee', 4],
  ]),
  ...group('Victoria Day', [
    ['Victoria Day', [[C.red, 3], [C.white, 3]]],
    ['May Long Weekend', [[C.sky, 2], [C.lime, 2], [C.butter, 2]], 'wave', 3, { blend: true }],
    ['May Long Fireworks', [[C.red, 1], [C.white, 1], [C.gold, 1]], 'sparkle', 9],
    ['Spring Blossoms', [[C.blush, 2], [C.white, 1], [C.mint, 1]], 'twinkle', 3],
  ]),
  ...group('Canada Day', [
    ['Red & White', [[C.red, 3], [C.white, 3]]],
    ['Maple Leaf', [[C.red, 2], [C.white, 1], [C.red, 2], [C.off, 1]]],
    ['O Canada', [[C.red, 3], [C.white, 3]], 'chase', 3],
    ['Flag Wave', [[C.red, 4], [C.white, 8], [C.red, 4]], 'chase', 2],
    ['True North', [[C.red, 2], [C.white, 2]], 'wave', 3, { blend: true }],
    ['Canada Day Fireworks', [[C.red, 1], [C.white, 1]], 'sparkle', 9],
  ]),
  // Orange for Orange Shirt Day / Every Child Matters; kept calm and steady.
  ...group('Truth & Reconciliation', [
    ['Every Child Matters', [[C.orange, 1]], 'static', 4, { brightness: 75 }],
    ['Orange Shirt Day', [[C.orange, 3], [C.white, 1]], 'static', 4, { brightness: 75 }],
    ['Healing Light', [[C.orange, 3], [C.softWarm, 2]], 'wave', 1, { blend: true, brightness: 70 }],
    ['Gentle Remembrance', [[C.orange, 1]], 'breathe', 1, { brightness: 70 }],
    ['Candlelight Vigil', [[C.amber, 1], [C.orange, 1]], 'twinkle', 2, { brightness: 65 }],
  ]),
  ...group('Thanksgiving', [
    ['Harvest', [[C.orange, 2], [C.gold, 2], [C.deepRed, 2]]],
    ['Autumn Leaves', [[C.amber, 3], [C.deepRed, 2], [C.gold, 2]], 'twinkle', 3],
    ['Maple Harvest', [[C.red, 2], [C.orange, 2], [C.gold, 2]], 'wave', 2, { blend: true }],
    ['Cornucopia', [[C.amber, 2], [C.deepRed, 1], [C.gold, 2], [C.deepGreen, 1]]],
    ['Cranberry', [[C.deepRed, 3], [C.warm, 1]]],
    ['Cozy Hearth', [[C.warm, 2], [C.amber, 1]], 'twinkle', 2],
  ]),
];
