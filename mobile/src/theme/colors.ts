// Vintage Racing palette.
//
// Warm carbon and parchment cream in place of pure black and white, with brass,
// oxblood and British racing green doing the work neon red / teal / gold used to:
//   · brass  — value and progress (scores, countdowns, the "next up" accent)
//   · oxblood — the single primary action on a screen (save, hero CTA)
//   · green  — "open" / positive / a correct pick
//
// The original semantic keys are kept (bgCarbon, f1Red, accentGreen, …) and
// remapped to vintage values so every screen picks up the new look; f1Red now
// resolves to oxblood. New tokens below cover the redesigned surfaces.
export const colors = {
  // Base surfaces
  bgCarbon: '#0d0c09',      // page / root background (warm carbon)
  bgPhone: '#141210',       // app frame background
  bgCard: '#1A1815',        // card / row surface
  bgCardHeader: '#211E1A',  // slightly raised header / input surface

  // Primary action (oxblood) — one per screen
  f1Red: '#A8291C',
  f1RedHover: '#8f2318',
  oxblood: '#A8291C',
  oxbloodFg: '#F8F3E7',

  // Text on carbon
  textPrimary: '#F3EDE0',   // parchment cream
  textSecondary: '#9E9481', // muted sand
  textMuted: '#6f685c',     // faint

  // Lines
  borderColor: '#33302A',
  borderStrong: '#4d4636',
  borderFaint: '#262320',

  // Accents
  accentGreen: '#6FBF95',   // green text / "open" / positive
  racingGreen: '#2F6B4F',   // green fill
  accentGold: '#C9A227',    // brass
  brass: '#C9A227',
  brassDim: '#8a6f18',
  cream: '#F3EDE0',
  redText: '#E6907F',       // soft oxblood for "miss" / "locks" copy

  // Extra vintage surfaces
  surfaceAlt: '#2A2621',    // plates / chips / empty slots
  inputBg: '#211E1A',
  heroTop: '#1D1B15',       // hero card gradient
  heroBottom: '#171512',

  // Status Colors
  statusOpen: '#6FBF95',
  statusLocked: '#E6907F',
  statusCompleted: '#9E9481',
};
