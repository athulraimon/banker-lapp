// Circuit layouts come from the f1-circuits dataset (MIT licensed):
// https://github.com/bacinger/f1-circuits — real GPS traces of every track,
// with length, altitude and first-Grand-Prix year attached.
//
// The traces are fetched on demand from a CDN rather than bundled. Twenty-two
// circuits of coordinates would add a few hundred KB to the bundle that most
// users would never look at, and the app already requires a network connection
// for everything else. React Query caches each one for the session, and the
// service worker keeps it across launches.

// Our races come from Jolpica (Ergast), which uses its own circuit ids. This
// maps them to the f1-circuits ids. Covers the full 2026 calendar plus circuits
// that recently dropped off it, so an older season still renders.
const ERGAST_TO_F1_CIRCUITS: Record<string, string> = {
  albert_park: 'au-1953',
  shanghai: 'cn-2004',
  suzuka: 'jp-1962',
  bahrain: 'bh-2002',
  jeddah: 'sa-2021',
  miami: 'us-2022',
  imola: 'it-1953',
  monaco: 'mc-1929',
  catalunya: 'es-1991',
  madring: 'es-2026',
  villeneuve: 'ca-1978',
  red_bull_ring: 'at-1969',
  silverstone: 'gb-1948',
  hungaroring: 'hu-1986',
  spa: 'be-1925',
  zandvoort: 'nl-1948',
  monza: 'it-1922',
  baku: 'az-2016',
  marina_bay: 'sg-2008',
  americas: 'us-2012',
  rodriguez: 'mx-1962',
  interlagos: 'br-1940',
  vegas: 'us-2023',
  losail: 'qa-2004',
  yas_marina: 'ae-2009',
  // No longer on the calendar, kept so past seasons still draw.
  paulricard: 'fr-1969',
  istanbul: 'tr-2005',
  portimao: 'pt-2008',
  mugello: 'it-1914',
  sochi: 'ru-2014',
  sepang: 'my-1999',
  hockenheimring: 'de-1932',
  nurburgring: 'de-1927',
  indianapolis: 'us-1909',
  estoril: 'pt-1972',
  kyalami: 'za-1961',
  magny_cours: 'fr-1960',
  watkins_glen: 'us-1956',
  galvez: 'ar-1952',
  jacarepagua: 'br-1977',
};

const CDN = 'https://cdn.jsdelivr.net/gh/bacinger/f1-circuits@master/circuits';

export interface CircuitLayout {
  /** SVG path data, already normalised into a 0..100 viewBox. */
  path: string;
  /** Start/finish point in the same coordinate space. */
  start: { x: number; y: number };
  name: string;
  location: string;
  /** Track length in metres. */
  length?: number;
  /** Altitude at start/finish in metres. */
  altitude?: number;
  /** Year of the circuit's first Grand Prix. */
  firstGP?: number;
}

/**
 * Derives the f1-circuits id from a race.
 *
 * The API gives us a circuit *name*, not Ergast's id, so we match on the name
 * and fall back to scanning the id map. Returns null for circuits the dataset
 * doesn't know, which the UI treats as "no layout available" rather than an error.
 */
export function circuitIdFor(circuitName: string, country: string): string | null {
  const slug = circuitName.toLowerCase();

  // Name fragments are more reliable than trying to reverse Ergast's ids.
  const byName: [string, string][] = [
    ['albert park', 'au-1953'],
    ['shanghai', 'cn-2004'],
    ['suzuka', 'jp-1962'],
    ['bahrain', 'bh-2002'],
    ['jeddah', 'sa-2021'],
    ['miami', 'us-2022'],
    ['enzo e dino', 'it-1953'],
    ['monaco', 'mc-1929'],
    ['barcelona', 'es-1991'],
    ['madring', 'es-2026'],
    ['villeneuve', 'ca-1978'],
    ['red bull ring', 'at-1969'],
    ['silverstone', 'gb-1948'],
    ['hungaroring', 'hu-1986'],
    ['spa', 'be-1925'],
    ['zandvoort', 'nl-1948'],
    ['monza', 'it-1922'],
    ['baku', 'az-2016'],
    ['marina bay', 'sg-2008'],
    ['americas', 'us-2012'],
    ['rodr', 'mx-1962'], // Autódromo Hermanos Rodríguez — accent-safe prefix
    ['carlos pace', 'br-1940'],
    ['interlagos', 'br-1940'],
    ['las vegas', 'us-2023'],
    ['losail', 'qa-2004'],
    ['yas marina', 'ae-2009'],
  ];

  for (const [fragment, id] of byName) {
    if (slug.includes(fragment)) return id;
  }

  // Last resort: some callers may already hold an Ergast id.
  return ERGAST_TO_F1_CIRCUITS[slug] ?? null;
}

/**
 * Converts a circuit's GeoJSON LineString into an SVG path in a 0..100 box.
 *
 * Longitude is scaled by cos(latitude) before normalising. Without that
 * correction a degree of longitude is treated as the same distance as a degree
 * of latitude, which squashes tracks horizontally — badly at Silverstone's
 * latitude, and noticeably everywhere outside the tropics.
 */
export function geoJsonToPath(coordinates: [number, number][]): {
  path: string;
  start: { x: number; y: number };
} {
  if (coordinates.length === 0) return { path: '', start: { x: 50, y: 50 } };

  const midLat = coordinates.reduce((sum, c) => sum + c[1], 0) / coordinates.length;
  const lonScale = Math.cos((midLat * Math.PI) / 180);

  const pts = coordinates.map(([lon, lat]) => ({ x: lon * lonScale, y: lat }));

  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  // Preserve aspect ratio: scale both axes by the larger span and centre the
  // smaller one, so a long thin circuit isn't stretched to fill the box.
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;
  const span = Math.max(spanX, spanY);
  const padX = (span - spanX) / 2;
  const padY = (span - spanY) / 2;

  const project = (p: { x: number; y: number }) => ({
    x: ((p.x - minX + padX) / span) * 100,
    // SVG y grows downward; latitude grows upward. Flip so north is up.
    y: 100 - ((p.y - minY + padY) / span) * 100,
  });

  const projected = pts.map(project);
  const round = (n: number) => Math.round(n * 100) / 100;

  const path =
    projected
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${round(p.x)} ${round(p.y)}`)
      .join(' ') + ' Z';

  return { path, start: projected[0] };
}

interface GeoJsonCircuit {
  features: {
    properties: { Name?: string; Location?: string; length?: number; altitude?: number; firstgp?: number };
    geometry: { coordinates: [number, number][] };
  }[];
}

/** Fetches and converts one circuit. Throws so React Query can show an error. */
export async function fetchCircuitLayout(circuitId: string): Promise<CircuitLayout> {
  const res = await fetch(`${CDN}/${circuitId}.geojson`);
  if (!res.ok) throw new Error(`circuit ${circuitId}: HTTP ${res.status}`);

  const data: GeoJsonCircuit = await res.json();
  const feature = data.features?.[0];
  if (!feature) throw new Error(`circuit ${circuitId}: no features`);

  const { path, start } = geoJsonToPath(feature.geometry.coordinates);

  return {
    path,
    start,
    name: feature.properties.Name ?? '',
    location: feature.properties.Location ?? '',
    length: feature.properties.length,
    altitude: feature.properties.altitude,
    firstGP: feature.properties.firstgp,
  };
}
