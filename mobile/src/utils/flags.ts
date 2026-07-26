// Maps an F1 country name (as returned by OpenF1 in race.country) to its
// ISO 3166-1 alpha-2 code, then to a flag emoji. Falls back to a checkered
// flag when the country isn't recognised.

const COUNTRY_TO_ISO: Record<string, string> = {
  australia: 'AU',
  austria: 'AT',
  azerbaijan: 'AZ',
  bahrain: 'BH',
  belgium: 'BE',
  brazil: 'BR',
  canada: 'CA',
  china: 'CN',
  france: 'FR',
  germany: 'DE',
  hungary: 'HU',
  italy: 'IT',
  japan: 'JP',
  mexico: 'MX',
  monaco: 'MC',
  netherlands: 'NL',
  portugal: 'PT',
  qatar: 'QA',
  'saudi arabia': 'SA',
  singapore: 'SG',
  spain: 'ES',
  'united arab emirates': 'AE',
  'united kingdom': 'GB',
  'great britain': 'GB',
  'united states': 'US',
  usa: 'US',
  // The schedule now comes from Jolpica (Ergast), which abbreviates some
  // countries where OpenF1 spelled them out. Verified against the full 2026
  // calendar: Silverstone reports "UK" and Abu Dhabi reports "UAE".
  uk: 'GB',
  uae: 'AE',
};

function isoToFlagEmoji(iso: string): string {
  const base = 0x1f1e6; // regional indicator 'A'
  return iso
    .toUpperCase()
    .split('')
    .map((c) => String.fromCodePoint(base + (c.charCodeAt(0) - 65)))
    .join('');
}

// Flag emoji are built from pairs of regional indicator characters, and the
// platform's emoji font decides whether that pair becomes a flag. Windows does
// not ship flag glyphs at all — Segoe UI Emoji has no flags — so on a Windows
// browser the pair renders as tofu or bare letters. Android and iOS both have
// them, which is why this only shows up now that the app runs on the web.
//
// There is no feature query for this, so we measure: a supported pair collapses
// into one glyph, an unsupported one stays two. Cached because it forces layout.
let flagSupport: boolean | null = null;

function supportsFlagEmoji(): boolean {
  if (flagSupport !== null) return flagSupport;

  // Native has flag glyphs, and there is no document to measure against.
  if (typeof document === 'undefined' || !document.createElement) {
    flagSupport = true;
    return flagSupport;
  }

  try {
    const ctx = document.createElement('canvas').getContext('2d');
    if (!ctx) {
      flagSupport = true;
      return flagSupport;
    }
    ctx.font = '32px sans-serif';
    const pair = ctx.measureText('\u{1F1E6}\u{1F1FA}').width; // AU
    const single = ctx.measureText('\u{1F1E6}').width; // A alone
    // Rendered as one flag => noticeably narrower than two separate glyphs.
    flagSupport = pair < single * 2 - 1;
  } catch {
    // Never let a detection failure break the screen; emoji is the safer guess.
    flagSupport = true;
  }
  return flagSupport;
}

// True when countryFlag() is returning ISO codes rather than emoji, so callers
// can style them as a compact badge instead of at full emoji size.
export function usesTextFallback(): boolean {
  return !supportsFlagEmoji();
}

// Returns the flag for a country name, or 🏁 if unknown.
//
// Where flag emoji don't render, this returns the ISO code instead ("AU"), so
// the row still shows something meaningful rather than an empty gap. The
// chequered flag used for unknown countries is an ordinary emoji, not a
// regional indicator pair, so it renders everywhere and needs no fallback.
export function countryFlag(country?: string): string {
  if (!country) return '🏁';
  const iso = COUNTRY_TO_ISO[country.trim().toLowerCase()];
  if (!iso) return '🏁';
  return supportsFlagEmoji() ? isoToFlagEmoji(iso) : iso;
}
