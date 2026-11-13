// Inside Home Assistant (the sidebar panel or the Companion app), Lightweave is
// shown in an Ingress iframe on Home Assistant's own origin, so it can read the
// CSS variables of the user's active Home Assistant theme from the parent page
// and use them for its own colors. Anywhere else (direct port, local dev, the
// home-screen shortcut) nothing is read and the built-in palette stays.

/** Lightweave's color tokens and the Home Assistant variables they follow, in order of preference. */
export const HA_TOKEN_MAP: Record<string, string[]> = {
  '--bg': ['--primary-background-color'],
  '--surface': ['--ha-card-background', '--card-background-color'],
  '--surface-2': ['--secondary-background-color'],
  '--line': ['--divider-color'],
  '--text': ['--primary-text-color'],
  '--muted': ['--secondary-text-color'],
  '--accent': ['--primary-color'],
  '--accent-ink': ['--text-primary-color'],
  '--danger': ['--error-color'],
  '--ok': ['--success-color'],
};

/**
 * Maps a Home Assistant theme to Lightweave tokens. `get` returns a variable's
 * value ('' when unset). Returns null when this isn't a Home Assistant page; a
 * token whose variables are all unset is left out, so it keeps its default.
 */
export function mapHaTheme(get: (name: string) => string): Record<string, string> | null {
  if (!get('--primary-background-color').trim()) return null;
  const tokens: Record<string, string> = {};
  for (const [token, vars] of Object.entries(HA_TOKEN_MAP)) {
    for (const name of vars) {
      const value = get(name).trim();
      if (value) {
        tokens[token] = value;
        break;
      }
    }
  }
  return tokens;
}

/** Relative luminance (0–1) of an `rgb()`/`rgba()` string, or null if it can't be parsed. */
export function luminance(rgb: string): number | null {
  const m = rgb.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
  if (!m) return null;
  const [r, g, b] = m.slice(1, 4).map((c) => {
    const s = Number(c) / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const APPLIED = Object.keys(HA_TOKEN_MAP);

/** Home Assistant's typography variables, copied as-is; styles.css maps them onto Lightweave's type tokens. */
export const HA_TYPOGRAPHY_VARS = [
  '--ha-font-family-body',
  '--ha-font-size-xs',
  '--ha-font-size-s',
  '--ha-font-size-m',
  '--ha-font-size-l',
  '--ha-font-size-xl',
  '--ha-font-weight-body',
  '--ha-font-weight-medium',
  '--ha-font-weight-action',
  '--ha-font-weight-heading',
];

/** Home Assistant ships Roboto itself; these are used when its @font-face rules can't be copied. */
const ROBOTO_FALLBACK = [
  [400, 'Regular'],
  [500, 'Medium'],
  [700, 'Bold'],
]
  .map(
    ([weight, file]) =>
      `@font-face{font-family:"Roboto";font-display:swap;font-weight:${weight};font-style:normal;` +
      `src:local("Roboto ${file}"),local("Roboto-${file}"),url(/static/fonts/roboto/Roboto-${file}.woff2) format("woff2")}`,
  )
  .join('\n');

/**
 * Web fonts don't carry into an iframe, so copy Home Assistant's @font-face rules
 * (Roboto, or a theme's own font) into this page. Their URLs are on the same origin.
 */
function adoptParentFonts(doc: Document): void {
  const rules: string[] = [];
  const sheets = [...Array.from(doc.styleSheets), ...(doc.adoptedStyleSheets ?? [])];
  for (const sheet of sheets) {
    try {
      for (const rule of Array.from(sheet.cssRules)) {
        if (rule instanceof (doc.defaultView?.CSSFontFaceRule ?? CSSFontFaceRule)) rules.push(rule.cssText);
      }
    } catch {
      // A cross-origin stylesheet; its rules can't be read.
    }
  }
  const style = document.createElement('style');
  style.dataset.haFonts = '';
  style.textContent = rules.some((r) => /roboto/i.test(r)) ? rules.join('\n') : `${rules.join('\n')}\n${ROBOTO_FALLBACK}`;
  document.head.appendChild(style);
}

function applyTypography(style: CSSStyleDeclaration): void {
  const root = document.documentElement;
  for (const name of HA_TYPOGRAPHY_VARS) {
    const value = style.getPropertyValue(name).trim();
    if (value) root.style.setProperty(name, value);
    else root.style.removeProperty(name);
  }
}

function parentThemeElement(): Element | null {
  try {
    if (window.parent === window) return null;
    const doc = window.parent.document; // throws when the parent isn't same-origin
    return doc.querySelector('home-assistant') ?? doc.documentElement;
  } catch {
    return null;
  }
}

function apply(source: Element): void {
  const style = getComputedStyle(source);
  applyTypography(style);
  const tokens = mapHaTheme((name) => style.getPropertyValue(name));
  const root = document.documentElement;
  for (const token of APPLIED) root.style.removeProperty(token);
  root.style.removeProperty('color-scheme');
  root.removeAttribute('data-ha-theme');
  if (!tokens) return;
  root.setAttribute('data-ha-theme', '');
  for (const [token, value] of Object.entries(tokens)) root.style.setProperty(token, value);

  // Light or dark form controls, from how bright the theme's background really is.
  const probe = document.createElement('span');
  probe.style.color = tokens['--bg'];
  probe.style.display = 'none';
  document.body.appendChild(probe);
  const lum = luminance(getComputedStyle(probe).color);
  probe.remove();
  if (lum !== null) root.style.setProperty('color-scheme', lum > 0.4 ? 'light' : 'dark');
}

/** Follows the Home Assistant theme when running inside it; does nothing otherwise. Call before rendering. */
export function followHomeAssistantTheme(): void {
  const source = parentThemeElement();
  if (!source) return;
  document.documentElement.setAttribute('data-ha-embedded', '');
  try {
    adoptParentFonts(source.ownerDocument);
  } catch {
    // Fonts fall back to the system font.
  }
  const refresh = () => {
    try {
      apply(source);
    } catch {
      // Home Assistant page went away or changed; keep whatever is applied.
    }
  };
  refresh();

  // Home Assistant restyles its root when the theme or light/dark mode changes.
  try {
    const observer = new MutationObserver(refresh);
    const targets = new Set([source, source.ownerDocument.documentElement]);
    for (const el of targets) observer.observe(el, { attributes: true, attributeFilter: ['style', 'class'] });
  } catch {
    // Not observable; the checks below still catch most changes.
  }
  // "Auto" themes follow the device, and the user may change theme in another view.
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', refresh);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refresh();
  });
}
