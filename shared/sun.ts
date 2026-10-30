// Sunrise and sunset times (the standard "sunrise equation"), accurate to a
// minute or two, which is plenty for turning lights on at dusk.

const RAD = Math.PI / 180;
const J1970 = 2440587.5;
const J2000 = 2451545;

const toJulian = (ms: number) => ms / 86_400_000 + J1970;
const fromJulian = (j: number) => new Date((j - J1970) * 86_400_000);

/**
 * Sunrise or sunset on the given local calendar day. Returns undefined when the
 * sun doesn't rise or set that day (far north in summer or winter).
 */
export function sunTime(day: Date, lat: number, lon: number, kind: 'sunrise' | 'sunset'): Date | undefined {
  const noon = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 12);
  const n = Math.round(toJulian(noon.getTime()) - J2000 - 0.0009 + lon / 360);
  const jStar = n + 0.0009 - lon / 360;
  const M = (357.5291 + 0.98560028 * jStar) % 360;
  const C = 1.9148 * Math.sin(M * RAD) + 0.02 * Math.sin(2 * M * RAD) + 0.0003 * Math.sin(3 * M * RAD);
  const lambda = (M + C + 180 + 102.9372) % 360;
  const transit = J2000 + jStar + 0.0053 * Math.sin(M * RAD) - 0.0069 * Math.sin(2 * lambda * RAD);
  const decl = Math.asin(Math.sin(lambda * RAD) * Math.sin(23.4397 * RAD));
  const cosH = (Math.sin(-0.833 * RAD) - Math.sin(lat * RAD) * Math.sin(decl)) / (Math.cos(lat * RAD) * Math.cos(decl));
  if (cosH < -1 || cosH > 1) return undefined;
  const h = Math.acos(cosH) / RAD / 360;
  return fromJulian(kind === 'sunrise' ? transit - h : transit + h);
}

/** Major Canadian cities, for picking a location without GPS. */
export const CITIES: { name: string; lat: number; lon: number }[] = [
  { name: 'Calgary, AB', lat: 51.05, lon: -114.07 },
  { name: 'Charlottetown, PE', lat: 46.24, lon: -63.13 },
  { name: 'Edmonton, AB', lat: 53.55, lon: -113.49 },
  { name: 'Fredericton, NB', lat: 45.96, lon: -66.64 },
  { name: 'Halifax, NS', lat: 44.65, lon: -63.58 },
  { name: 'Hamilton, ON', lat: 43.26, lon: -79.87 },
  { name: 'Iqaluit, NU', lat: 63.75, lon: -68.52 },
  { name: 'Kamloops, BC', lat: 50.67, lon: -120.33 },
  { name: 'Kelowna, BC', lat: 49.89, lon: -119.5 },
  { name: 'Kingston, ON', lat: 44.23, lon: -76.49 },
  { name: 'Kitchener-Waterloo, ON', lat: 43.45, lon: -80.49 },
  { name: 'Lethbridge, AB', lat: 49.69, lon: -112.84 },
  { name: 'London, ON', lat: 42.98, lon: -81.25 },
  { name: 'Moncton, NB', lat: 46.09, lon: -64.78 },
  { name: 'Montréal, QC', lat: 45.5, lon: -73.57 },
  { name: 'Nanaimo, BC', lat: 49.17, lon: -123.94 },
  { name: 'Ottawa, ON', lat: 45.42, lon: -75.7 },
  { name: 'Prince George, BC', lat: 53.92, lon: -122.75 },
  { name: 'Québec City, QC', lat: 46.81, lon: -71.21 },
  { name: 'Red Deer, AB', lat: 52.27, lon: -113.81 },
  { name: 'Regina, SK', lat: 50.45, lon: -104.61 },
  { name: 'Saskatoon, SK', lat: 52.13, lon: -106.67 },
  { name: 'Sherbrooke, QC', lat: 45.4, lon: -71.89 },
  { name: 'St. John’s, NL', lat: 47.56, lon: -52.71 },
  { name: 'Sudbury, ON', lat: 46.49, lon: -80.99 },
  { name: 'Thunder Bay, ON', lat: 48.38, lon: -89.25 },
  { name: 'Toronto, ON', lat: 43.65, lon: -79.38 },
  { name: 'Vancouver, BC', lat: 49.28, lon: -123.12 },
  { name: 'Victoria, BC', lat: 48.43, lon: -123.37 },
  { name: 'Whitehorse, YT', lat: 60.72, lon: -135.06 },
  { name: 'Windsor, ON', lat: 42.31, lon: -83.04 },
  { name: 'Winnipeg, MB', lat: 49.9, lon: -97.14 },
  { name: 'Yellowknife, NT', lat: 62.45, lon: -114.37 },
];
