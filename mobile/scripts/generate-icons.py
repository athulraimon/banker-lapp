#!/usr/bin/env python3
"""Regenerate every icon, splash and launch image from the pixel car sprite.

The artwork lives in exactly one place — src/theme/pixelCar.ts — and this script
parses that file so the icons can never drift from the mark the app draws at
runtime. Nothing here is hand-authored bitmap data.

    python scripts/generate-icons.py

Outputs (all overwritten):
    public/icons/icon-{192,512}.png            PWA icons, purpose "any"
    public/icons/icon-maskable-{192,512}.png   PWA icons, purpose "maskable"
    public/icons/apple-touch-icon.png          iOS home screen
    public/icons/loading-car.gif               pre-hydration splash animation
    public/favicon.png                         browser tab
    assets/icon.png                            Expo app icon
    assets/adaptive-icon.png                   Android adaptive foreground
    assets/splash-icon.png                     native splash artwork

Requires Pillow:  pip install Pillow
"""
import math
import re
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    sys.exit('Pillow is required: pip install Pillow')

ROOT = Path(__file__).resolve().parent.parent
SPRITE_TS = ROOT / 'src' / 'theme' / 'pixelCar.ts'

CARBON = (13, 12, 9)          # colors.bgCarbon — matches the app background


# --------------------------------------------------------------------------
# Parse the sprite out of the TypeScript source.
# --------------------------------------------------------------------------
def parse_ts():
    src = SPRITE_TS.read_text(encoding='utf-8')

    def rows(name):
        m = re.search(name + r'\s*=\s*\[(.*?)\n\];', src, re.S)
        if not m:
            sys.exit('could not find %s in %s' % (name, SPRITE_TS))
        return re.findall(r"'([^']*)'", m.group(1))

    m = re.search(r'PIXEL_PALETTE[^=]*=\s*\{(.*?)\n\};', src, re.S)
    if not m:
        sys.exit('could not find PIXEL_PALETTE')

    # Palette entries that point at theme tokens are resolved from colors.ts, so
    # the icons pick up a palette change without being edited here.
    colors_src = (ROOT / 'src' / 'theme' / 'colors.ts').read_text(encoding='utf-8')
    tokens = dict(re.findall(r"(\w+)\s*:\s*'(#[0-9A-Fa-f]{3,8})'", colors_src))

    resolved = {}
    for line in m.group(1).splitlines():
        km = re.match(r"\s*(\w)\s*:\s*(.+?),", line)
        if not km:
            continue
        key, expr = km.group(1), km.group(2).strip()
        lit = re.match(r"'(#[0-9A-Fa-f]{6})'", expr)
        tok = re.match(r'colors\.(\w+)', expr)
        if lit:
            resolved[key] = lit.group(1)
        elif tok:
            if tok.group(1) not in tokens:
                sys.exit('colors.%s not found in colors.ts' % tok.group(1))
            resolved[key] = tokens[tok.group(1)]

    def rgb(h):
        h = h.lstrip('#')
        return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))

    body = rows('CAR_BODY')
    frames_block = re.search(r'CAR_WHEEL_FRAMES\s*=\s*\[(.*?)\n\];', src, re.S).group(1)
    frames = [re.findall(r"'([^']*)'", chunk)
              for chunk in re.split(r'\],\s*\[', frames_block)]
    centres = [(int(a), int(b)) for a, b in
               re.findall(r'\{\s*cx:\s*(\d+),\s*cy:\s*(\d+)\s*\}', src)]

    return {k: rgb(v) for k, v in resolved.items()}, body, frames, centres


PALETTE, BODY, WHEEL_FRAMES, CENTRES = parse_ts()
CAR_W, CAR_H = len(BODY[0]), len(BODY)
WHEEL_SPAN = len(WHEEL_FRAMES[0])

# Two extra shades for the icon scene only — the smoke and the road, which are
# animated in the app and so are not part of the car sprite itself.
SMOKE = (158, 148, 129)       # colors.textSecondary
SMOKE_DIM = (94, 88, 77)
ROAD = (138, 111, 24)         # colors.brassDim


def stamp(grid, sprite, cx, cy):
    y0, x0 = cy - len(sprite) // 2, cx - len(sprite[0]) // 2
    for j, line in enumerate(sprite):
        for i, ch in enumerate(line):
            if ch == '.':
                continue
            y, x = y0 + j, x0 + i
            if 0 <= y < len(grid) and 0 <= x < len(grid[0]):
                grid[y][x] = ch


def car(frame=0):
    """The complete car: hull with both wheels stamped on."""
    grid = [list(r) for r in BODY]
    for cx, cy in CENTRES:
        stamp(grid, WHEEL_FRAMES[frame], cx, cy)
    return [''.join(r) for r in grid]


# --------------------------------------------------------------------------
# The icon scene: car, a short smoke trail and a strip of road. The car alone is
# 38x11 — over 3:1 — which floats in the middle of a square icon looking lost.
# The trail and road fill the frame and read as the same picture the loader draws.
# --------------------------------------------------------------------------
SCENE_W, SCENE_H = 44, 14
CAR_X, CAR_Y = 5, 0
ROAD_Y = 12


def scene(frame=0):
    grid = [['.'] * SCENE_W for _ in range(SCENE_H)]

    # road dashes, grounding the car and filling the base of the frame
    for x in range(SCENE_W):
        if x % 6 < 3:
            grid[ROAD_Y][x] = 'R'

    # just a hint of exhaust smoke — the full drifting trail belongs to the
    # loader, and at 192px a long plume is indistinguishable from lint
    for px, py, size, shade in [(3, 7, 1, 'S'), (0, 6, 2, 's')]:
        for dy in range(size):
            for dx in range(size):
                x, y = px + dx, py + dy
                if 0 <= x < SCENE_W and 0 <= y < SCENE_H:
                    grid[y][x] = shade

    for j, line in enumerate(car(frame)):
        for i, ch in enumerate(line):
            if ch != '.':
                grid[CAR_Y + j][CAR_X + i] = ch

    return [''.join(r) for r in grid]


FULL_PALETTE = dict(PALETTE)
FULL_PALETTE.update({'S': SMOKE, 's': SMOKE_DIM, 'R': ROAD})


def render(rows, scale, bg=None):
    h, w = len(rows), len(rows[0])
    mode = 'RGB' if bg else 'RGBA'
    im = Image.new(mode, (w, h), bg if bg else (0, 0, 0, 0))
    for y, line in enumerate(rows):
        for x, ch in enumerate(line):
            col = FULL_PALETTE.get(ch)
            if col:
                im.putpixel((x, y), col if bg else col + (255,))
    return im.resize((w * scale, h * scale), Image.Resampling.NEAREST)


def square(rows, size, fill, bg=CARBON, transparent=False):
    """Centre a sprite on a square canvas at the largest whole-pixel scale.

    Whole-pixel scaling is the point: a fractional scale resamples the art and
    every edge goes soft, which is the one thing pixel art cannot survive.
    """
    w, h = len(rows[0]), len(rows)
    scale = max(1, int(size * fill / w))
    if h * scale > size * fill:
        scale = max(1, int(size * fill / h))
    art = render(rows, scale)
    canvas = Image.new('RGBA', (size, size),
                       (0, 0, 0, 0) if transparent else bg + (255,))
    canvas.paste(art, ((size - art.width) // 2, (size - art.height) // 2), art)
    return canvas


def write(img, rel):
    path = ROOT / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path)
    print('  %-42s %sx%s' % (rel, img.width, img.height))


print('Generating icons from %s' % SPRITE_TS.relative_to(ROOT))

SCENE = scene()

# --- PWA icons ------------------------------------------------------------
# "any" icons fill the frame; maskable ones must survive being cropped to a
# circle, so the art is kept inside the 80% safe zone. For a wide sprite that
# means fitting the whole diagonal, not just the width.
write(square(SCENE, 192, 0.88), 'public/icons/icon-192.png')
write(square(SCENE, 512, 0.88), 'public/icons/icon-512.png')
diag_fill = 0.80 / math.hypot(1, SCENE_H / SCENE_W)
write(square(SCENE, 192, diag_fill), 'public/icons/icon-maskable-192.png')
write(square(SCENE, 512, diag_fill), 'public/icons/icon-maskable-512.png')
write(square(SCENE, 180, 0.88), 'public/icons/apple-touch-icon.png')

# --- favicon: the car alone, no scene; at 64px the trail is unreadable mush --
write(square(car(), 64, 0.94), 'public/favicon.png')

# --- Expo native app icons ------------------------------------------------
write(square(SCENE, 1024, 0.86), 'assets/icon.png')
# Android crops the adaptive foreground hard and applies its own mask, so this
# needs the safe zone and a transparent background.
write(square(SCENE, 1024, diag_fill * 0.92, transparent=True), 'assets/adaptive-icon.png')
write(square(SCENE, 1024, 0.62), 'assets/splash-icon.png')

# --- pre-hydration splash animation --------------------------------------
# Shown by +html.tsx in the gap between the page painting and the JS bundle
# running. Same two-frame wheel swap and drifting smoke as PixelCarLoader.
GIF_W, GIF_H = 56, 17
NF = 16
gif_frames = []
for f in range(NF):
    grid = [['.'] * GIF_W for _ in range(GIF_H)]

    shift = (f * 2) % 6
    for x in range(GIF_W):
        if (x + shift) % 6 < 3:
            grid[CAR_H + 2][x] = 'R'

    for p in range(4):
        t = ((f + p * 4) % NF) / NF
        px, py = int(13 - t * 13), 8 - int(t * 3)
        size = 1 + int(t * 2)
        shade = 'S' if t < 0.45 else 's'
        for dy in range(size):
            for dx in range(size):
                x, y = px + dx, py + dy
                if 0 <= x < GIF_W and 0 <= y < GIF_H:
                    grid[y][x] = shade

    bob = 1 if (f // 4) % 2 == 0 else 0
    for j, line in enumerate(car(f % 2)):
        for i, ch in enumerate(line):
            if ch != '.':
                y, x = bob + j, 16 + i
                if 0 <= y < GIF_H and 0 <= x < GIF_W:
                    grid[y][x] = ch

    gif_frames.append(render([''.join(r) for r in grid], 4, bg=CARBON))

out = ROOT / 'public' / 'icons' / 'loading-car.gif'
gif_frames[0].save(out, save_all=True, append_images=gif_frames[1:],
                   duration=90, loop=0, optimize=True)
print('  %-42s %sx%s (%d frames)'
      % ('public/icons/loading-car.gif', gif_frames[0].width,
         gif_frames[0].height, NF))
print('Done.')
