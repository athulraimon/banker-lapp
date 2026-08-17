import React, { useMemo } from 'react';
import Svg, { Rect } from 'react-native-svg';

interface Props {
  // Rows of single-character colour keys; '.' is transparent.
  rows: string[];
  palette: Record<string, string>;
  // Size of one art pixel, in layout pixels.
  cell: number;
}

// Collapses each row into horizontal runs of one colour, so a 38x11 sprite draws
// as a few dozen rects instead of a few hundred. This renders on the boot screen
// before anything else is warm, so the node count is worth caring about.
function runsOf(rows: string[]) {
  const runs: { x: number; y: number; w: number; ch: string }[] = [];
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      if (ch === '.') {
        x += 1;
        continue;
      }
      let w = 1;
      while (x + w < row.length && row[x + w] === ch) w += 1;
      runs.push({ x, y, w, ch });
      x += w;
    }
  });
  return runs;
}

// Draws a character-grid sprite as crisp rectangles.
//
// `cell` is rounded to a whole number on purpose: fractional cells leave hairline
// seams between rects on web, which on pixel art reads as a grid of scratches.
export default function PixelSprite({ rows, palette, cell }: Props) {
  const runs = useMemo(() => runsOf(rows), [rows]);
  const c = Math.max(1, Math.round(cell));

  return (
    <Svg width={rows[0].length * c} height={rows.length * c}>
      {runs.map((r, i) => (
        <Rect
          key={i}
          x={r.x * c}
          y={r.y * c}
          width={r.w * c}
          height={c}
          fill={palette[r.ch]}
        />
      ))}
    </Svg>
  );
}
