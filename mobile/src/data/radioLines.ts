// Iconic F1 team-radio and commentary lines, shown in place of a plain greeting
// on the dashboard. One is picked at random each time the app is opened.
export const RADIO_LINES = [
  'Lights out and away we go!',
  "It's hammer time.",
  'Leave me alone, I know what I’m doing.',
  'Bwoah.',
  'GP2 engine! GP2!',
  'Multi 21, Seb.',
  "Valtteri, it's James.",
  'Smooth operator.',
  'I am stupid.',
  'Simply lovely.',
  'Fernando is faster than you.',
  'Is that Glock going slowly?!',
  'Not bad for a number two driver.',
  'Charles, we are checking.',
  'Grazie ragazzi!',
  'No risk, full push.',
  'Borderline violence.',
];

export const randomRadioLine = () =>
  RADIO_LINES[Math.floor(Math.random() * RADIO_LINES.length)];
