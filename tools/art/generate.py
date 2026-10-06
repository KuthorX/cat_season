#!/usr/bin/env python3
"""Cross-stitch art generator for Cat Season.

Paints every visual asset as thread on cloth: tile motifs, the aida board,
the linen page texture, stitched titles, the menu cat and particle snips.
It also subsets LXGW WenKai down to the glyphs the game uses.

Re-run from the repo root:  python3 tools/art/generate.py
Needs: Pillow, numpy, fonttools + brotli (for woff2).
"""
from __future__ import annotations

import random
import re
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
PIXEL_FONT = ROOT / "tools/art/fonts/fusion-pixel-12px-proportional-zh_hans.otf.woff2"
PIXEL_PX = 12  # the font's native pixel grid: one font pixel = one stitch
PUBLIC = ROOT / "public/assets"
SRC_ASSETS = ROOT / "src/assets"

# Geometry shared with src/scenes/boardLayout.ts. Keep in sync.
STITCH = 8            # game px per stitch
CELL_STITCHES = 16    # stitches per board cell
BOARD_CELLS = 7
BOARD_ORIGIN = 32     # game px from canvas edge to the first cell
FRAME = 22            # game px of wooden stretcher bar
GAME_SIZE = 960
STRINGS_TS = ROOT / "src/i18n/strings.ts"
STITCHED_DIR = SRC_ASSETS / "art/stitched"
# string id -> (thread colour, squares per font pixel, stitch px in the image)
STITCHED_TEXT = {
    "menu.title": ("#a53f26", 2, 12),
    "menu.start": ("#33241a", 1, 12),
    "end.lostTitle": ("#33241a", 1, 12),
    "end.wonTitle": ("#33241a", 1, 12),
    "end.again": ("#33241a", 1, 12),
}

INK = "#33241a"
PALETTE = {
    "k": INK,
    "w": "#fffaf0",
    # paw: terracotta
    "P": "#c65a30", "p": "#8f3a1f", "R": "#e7a08a",
    # fish: slate blue
    "B": "#3f739c", "b": "#2a5274",
    # yarn: dusty rose
    "Y": "#d27b93", "y": "#9c4d63",
    # bell: brass + madder collar
    "G": "#d9a93c", "g": "#9c7120", "M": "#a53f26",
    # milk: cream glass + spruce cap
    "W": "#f6f1e6", "C": "#2f6b5a", "c": "#1f4a3e",
    # cushion: sage + straw tassels
    "S": "#8fb07f", "s": "#5f8455", "t": "#c99a2a",
    # tuna: tin + plum label
    "T": "#c3c7c9", "u": "#7f878d", "L": "#7d4f86", "l": "#5a3462",
    # star: deep teal
    "N": "#2e8f8a", "n": "#1d625e",
    # ginger cat
    "O": "#d9853b", "o": "#8f4718", "q": "#b8682a", "E": "#f8f1e2", "e": "#c9b796",
}

MOTIFS: dict[str, list[str]] = {
    "paw": [
        "....kk..kk....",
        "...kPPkkPPk...",
        "...kPPkkPPk...",
        ".kk.kk..kk.kk.",
        "kPPk......kPPk",
        "kPPk.kkkk.kPPk",
        ".kk.kPPPPk.kk.",
        "...kPPRRPPk...",
        "..kPPRRRRPPk..",
        "..kPRRRRRRPk..",
        "..kPRRRRRRPk..",
        "..kpPRRRRPpk..",
        "...kppPPppk...",
        "....kkkkkk....",
    ],
    "fish": [
        "..............",
        "......kkkk....",
        ".....kBBBBk...",
        "k...kBbBBBBk..",
        "kk.kBbBBBkwBk.",
        "kBkBBbBBBkkBBk",
        "kBBBBbBBBBBBBk",
        "kBBBBbBBBBBBkk",
        "kBkBBbBBBBBBk.",
        "kk.kBbBBBBBk..",
        "k...kbbbbbk...",
        ".....kkkkk....",
    ],
    "yarn": [
        "....kkkkk.....",
        "..kkYYyYYkk...",
        ".kYYyYYYyYYk..",
        ".kYyYYYyYYYk..",
        "kYYYYyYYYyYYk.",
        "kyYYyYYYyYYYk.",
        "kYYyYYYyYYYyk.",
        "kYyYYYyYYYyYk.",
        ".kYYYyYYYyYk..",
        ".kYYyYYYyYYk..",
        "..kkYYyYYkk...",
        "....kkkkk.yy..",
        "...........yy.",
        "............y.",
    ],
    "bell": [
        "......kk......",
        ".....kggk.....",
        "....kkkkkk....",
        "...kGGGGGGk...",
        "..kGGwGGGGGk..",
        "..kGwGGGGGgk..",
        "..kGGGGGGGgk..",
        ".kGGGGGGGGGgk.",
        ".kGGGGGGGGGgk.",
        "kGGGGGGGGGGGgk",
        "kMMMMMMMMMMMMk",
        "kMMMMMMMMMMMMk",
        ".kkkkkggkkkkk.",
        "......kk......",
    ],
    "milk": [
        "....kkkkkk....",
        "....kCCCCk....",
        "....kcccck....",
        "....kWWWWk....",
        "...kWWWWWWk...",
        "..kWwWWWWWWk..",
        ".kWwWWWWWWWWk.",
        ".kCCCCCCCCCCk.",
        ".kCWWCCCCWWCk.",
        ".kCCCCCCCCCCk.",
        ".kWwWWWWWWWWk.",
        ".kWWWWWWWWWWk.",
        ".kWWWWWWWWWWk.",
        "..kkkkkkkkkk..",
    ],
    "cushion": [
        "..............",
        ".tkkkkkkkkkkt.",
        ".kSSSSSSSSSSk.",
        ".kSsSSSSSSsSk.",
        ".kSSSSSSSSSSk.",
        ".kSSSSssSSSSk.",
        ".kSSSskkSSSSk.",
        ".kSSSskkSSSSk.",
        ".kSSSSssSSSSk.",
        ".kSSSSSSSSSSk.",
        ".kSsSSSSSSsSk.",
        ".kSSSSSSSSSSk.",
        ".tkkkkkkkkkkt.",
        "..............",
    ],
    "tuna": [
        "...kkkkkkkk...",
        "..kTTTTTTTTk..",
        ".kTuuuuuuuuTk.",
        ".kTTTTTTTTTTk.",
        ".kkkkkkkkkkkk.",
        ".kLLLLLLLLLLk.",
        ".kLwwwwLLLLLk.",
        ".kLwLLwwwwwLk.",
        ".kLwwwwLLLLLk.",
        ".kLLLLLLLLLLk.",
        ".kllllllllllk.",
        ".kkkkkkkkkkkk.",
        ".kTTTTTTTTTTk.",
        "..kkkkkkkkkk..",
    ],
    "star": [
        "......kk......",
        ".....kNNk.....",
        ".....kNNk.....",
        "....kNNNNk....",
        "kkkkkNNNNkkkkk",
        "kNNNNNNNNNNNNk",
        ".kNNNNNwNNNNk.",
        "..kNNNNNNNNk..",
        "...kNNNNNNk...",
        "...kNNNNNNk...",
        "..kNNNnnNNNk..",
        "..kNNk..kNNk..",
        ".kNnk....knNk.",
        ".kkk......kkk.",
    ],
}

# Power-ups and commands are stitched objects too.
TOOLS: dict[str, list[str]] = {
    "snack": [
        "....k....k....",
        ".....k..k.....",
        "......tt......",
        "....kkttkk....",
        "...kWWWWWWk...",
        "..kWWWWWWWWk..",
        "..kWWWsWWWWk..",
        ".kWWWsSsWWWWk.",
        ".kWWsSSSsWWWk.",
        ".kWWWsSsWWWWk.",
        ".kWWWWsWWWWWk.",
        ".kWWWWWWWWWWk.",
        "..kWWWWWWWWk..",
        "...kkkkkkkk...",
    ],
    "wand": [
        "..........kk..",
        ".........kNNk.",
        "........kNnNNk",
        "........kNnNNk",
        ".......kNnNNk.",
        "......kNnNNk..",
        "......knNNk...",
        ".....kgkkk....",
        "....kgk.......",
        "...kgk........",
        "..kgk.........",
        ".kgk..........",
        "kgk...........",
        "kk............",
    ],
    "stamp": [
        ".....kkkk.....",
        "....kGGGGk....",
        "....kGwGgk....",
        ".....kggk.....",
        ".....kggk.....",
        ".....kggk.....",
        "...kkkkkkkk...",
        "..kGGGGGGGGk..",
        "..kMMMMMMMMk..",
        "..kkkkkkkkkk..",
        "..............",
        "...M.M..M.M...",
        "....MM..MM....",
        ".....MMMM.....",
    ],
    "restart": [
        "kk..........kk",
        "kTk........kTk",
        ".kTk......kTk.",
        "..kTk....kTk..",
        "...kTk..kTk...",
        "....kTkkTk....",
        ".....kTTk.....",
        ".....kTTk.....",
        "....kMkkMk....",
        "...kMk..kMk...",
        "..kM.k..k.Mk..",
        ".kM..k..k..Mk.",
        ".kM..k..k..Mk.",
        "..kkk....kkk..",
    ],
    "hint": [
        "....kkk.......",
        "...kMMMk......",
        "..kMwMMMk.....",
        "..kMMMMMk.....",
        "..kMMMMMk.....",
        "...kMMMk......",
        "....kTk.......",
        "....kTk.......",
        "....kTk.......",
        "....kTk.......",
        "....kTk.......",
        "....kTk.......",
        "....kuk.......",
        ".....k........",
    ],
}

CAT = [
    "........o.........o.........................",
    ".......oOo.......oOo........................",
    "......oORRo.....oRROo.......................",
    "......oOROOoooooOOROo.......................",
    ".....oOOOOOOOOOOOOOOOo......................",
    ".....oOOqOOOOOOOOOqOOOooooooooooo...........",
    "....oOOOOOOOOOOOOOOOOOOOOOOOOOOOOoo.........",
    "....oOOkkkOOOOOOkkkOOOqOOOqOOOqOOOOo........",
    "....oOOOOOOOOOOOOOOOOOqOOOqOOOqOOOOOo.......",
    "....oOOOOOOOORROOOOOOOqOOOqOOOqOOOOOOo......",
    ".....oOOOOOOEEEEOOOOOOOOOOOOOOOOOOOOOOo.....",
    "......ooOOOEEEEEEOOOOOqOOOqOOOqOOOOOOOo.....",
    "......eEEEeEEEEEEeEEEEoOOOqOOOqOOOqOOOOOo...",
    ".....eEEEEEeEEEEeEEEEEeOOOOOOOOOOOOOOOOOo...",
    ".....eEEEEEeeeeeeEEEEEeOOOOOOOOOOOOOOOOOo...",
    "......eeeeee.....eeeeeoOOOOOOOOOOOOOOOOo....",
    "...ooooooooooooooooooooOOOOOOOOOOOOOOOOo....",
    "..oOOqOOOqOOOqOOOqOOOqOOOOOOOOOOOOOOOOo.....",
    "..oOOqOOOqOOOqOOOqOOOqOOOOOOOOOOOOOooo......",
    "...ooooooooooooooooooooooooooooooooo........",
]


def rgb(hex_color: str) -> tuple[int, int, int]:
    h = hex_color.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))  # type: ignore[return-value]


def shade(color: tuple[int, int, int], factor: float) -> tuple[int, int, int]:
    return tuple(max(0, min(255, round(c * factor))) for c in color)  # type: ignore[return-value]


def draw_stitch(draw: ImageDraw.ImageDraw, x0: float, y0: float, size: float,
                color: tuple[int, int, int], rnd: random.Random, leg: float = 0.34) -> None:
    """One cross stitch: an under leg (/) then a lighter over leg (\\)."""
    jitter = rnd.uniform(0.94, 1.06)
    base = shade(color, jitter)
    inset = size * 0.14
    width = max(2, round(size * leg))
    a, b = x0 + inset, x0 + size - inset
    c, d = y0 + inset, y0 + size - inset
    draw.line([(a, d), (b, c)], fill=shade(base, 0.72) + (255,), width=width)
    draw.line([(a, c), (b, d)], fill=base + (255,), width=width)
    # twist highlight along the over leg, offset toward the top-right
    off = size * 0.07
    draw.line([(a + off * 2, c - off + off * 2), (b - off * 2, d - off - off * 2)],
              fill=shade(base, 1.22) + (255,), width=max(1, round(width * 0.28)))


def render_grid(grid: list[str], stitch_px: int, canvas_cells: tuple[int, int] | None = None,
                palette: dict[str, str] = PALETTE, seed: int = 7, supersample: int = 4,
                leg: float = 0.34) -> Image.Image:
    rows = len(grid)
    cols = max(len(r) for r in grid)
    cw, ch = canvas_cells or (cols, rows)
    ox, oy = (cw - cols) // 2, (ch - rows) // 2
    s = stitch_px * supersample
    img = Image.new("RGBA", (cw * s, ch * s), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    rnd = random.Random(seed)
    for y, row in enumerate(grid):
        for x, ch_ in enumerate(row):
            if ch_ == "." or ch_ == " ":
                continue
            draw_stitch(draw, (x + ox) * s, (y + oy) * s, s, rgb(palette[ch_]), rnd, leg)
    return img.resize((cw * stitch_px, ch * stitch_px), Image.Resampling.LANCZOS)


def weave_noise(h: int, w: int, rnd: np.random.Generator, strength: float) -> np.ndarray:
    rows = rnd.normal(0, strength, (h, 1))
    cols = rnd.normal(0, strength, (1, w))
    fine = rnd.normal(0, strength * 0.6, (h, w))
    # slubs: occasional thicker threads along rows
    slub = np.zeros((h, w))
    for _ in range(max(1, h // 18)):
        y = rnd.integers(0, h)
        x = rnd.integers(0, w)
        length = rnd.integers(w // 12, w // 4)
        xs = (np.arange(length) + x) % w
        slub[y, xs] -= strength * 1.4
    return rows + cols + fine + slub


def linen_texture(width: int = 1600, height: int = 1000) -> Image.Image:
    """One cut of oatmeal linen: plain weave with slubs."""
    rnd = np.random.default_rng(11)
    base = np.array(rgb("#d8c8a6"), dtype=float)
    n = weave_noise(height, width, rnd, 0.018)
    yy, xx = np.mgrid[0:height, 0:width].astype(float)
    weave = np.where(((xx // 2) + (yy // 2)) % 2 == 0, 0.01, -0.01)
    f = 1 + n + weave
    arr = np.clip(base[None, None, :] * f[..., None], 0, 255).astype(np.uint8)
    return Image.fromarray(arr, "RGB")


def aida_piece(width: int, height: int, fray: int, seed: int) -> Image.Image:
    """A cut piece of aida: woven ground with stitch holes and loose threads on every edge."""
    rnd = np.random.default_rng(seed)
    prnd = random.Random(seed)
    img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    w, h = width - fray * 2, height - fray * 2
    base = np.array(rgb("#efe6d2"), dtype=float)
    n = weave_noise(h, w, rnd, 0.02)
    yy, xx = np.mgrid[0:h, 0:w]
    gx, gy = xx % STITCH, yy % STITCH
    holes = (gx <= 1) & (gy <= 1)
    channel = ((gx <= 0) | (gy <= 0)) & ~holes
    f = 1 + n - holes * 0.16 - channel * 0.045
    arr = np.clip(base[None, None, :] * f[..., None], 0, 255).astype(np.uint8)
    alpha = np.full((h, w, 1), 255, np.uint8)
    img.paste(Image.fromarray(np.concatenate([arr, alpha], axis=2), "RGBA"), (fray, fray))

    draw = ImageDraw.Draw(img)
    thread = rgb("#e4d8bf")
    x0, y0, x1, y1 = fray, fray, width - fray, height - fray
    for side in range(4):
        horizontal = side < 2
        for pos in range(x0 if horizontal else y0, x1 if horizontal else y1, 3):
            if prnd.random() >= 0.55:
                continue
            if fray < 6:
                break
            length = prnd.randint(3, fray - 3)
            col = shade(thread, prnd.uniform(0.9, 1.04)) + (255,)
            wob = prnd.randint(-1, 1)
            if side == 0:
                draw.line([(pos, y0), (pos + wob, y0 - length)], fill=col, width=1)
            elif side == 1:
                draw.line([(pos, y1 - 1), (pos + wob, y1 + length)], fill=col, width=1)
            elif side == 2:
                draw.line([(x0, pos), (x0 - length, pos + wob)], fill=col, width=1)
            else:
                draw.line([(x1 - 1, pos), (x1 + length, pos + wob)], fill=col, width=1)
    return img


def wood_bar(length: int, depth: int, seed: int, color: str = "#a8743f") -> np.ndarray:
    """Oak stretcher bar: long grain streaks, a lighter top face and a darker inner bevel."""
    rnd = np.random.default_rng(seed)
    yy, xx = np.mgrid[0:depth, 0:length].astype(float)
    grain = np.sin(yy * 1.7 + np.sin(xx / 37.0 + seed) * 2.2 + rnd.normal(0, 0.15, (depth, length)))
    streak = rnd.normal(0, 1, (depth, 1)) * 0.05
    base = np.array(rgb(color), dtype=float)
    f = 1 + grain * 0.06 + streak + rnd.normal(0, 0.02, (depth, length))
    f[: max(1, depth // 6)] *= 1.12          # outer edge catches light
    f[-3:] *= 0.72                            # bevel where the bar meets the cloth
    return np.clip(base[None, None, :] * f[..., None], 0, 255)


def board_texture() -> Image.Image:
    """Aida stretched in a square wooden frame; cells sit on the same 8 px stitch grid."""
    img = aida_piece(GAME_SIZE - 32, GAME_SIZE - 32, 0, 5)
    canvas = Image.new("RGBA", (GAME_SIZE, GAME_SIZE), (0, 0, 0, 0))
    canvas.paste(img, (16, 16))
    arr = np.array(canvas).astype(float)
    bar = wood_bar(GAME_SIZE, FRAME, 3)
    n = GAME_SIZE
    for side in range(4):
        b = bar if side % 2 == 0 else wood_bar(GAME_SIZE, FRAME, 4)
        for d in range(FRAME):
            lo, hi = d, n - d          # mitred corners
            row = b[d, lo:hi]
            if side == 0:
                arr[d, lo:hi, :3] = row
                arr[d, lo:hi, 3] = 255
            elif side == 1:
                arr[n - 1 - d, lo:hi, :3] = row
                arr[n - 1 - d, lo:hi, 3] = 255
            elif side == 2:
                arr[lo:hi, d, :3] = row
                arr[lo:hi, d, 3] = 255
            else:
                arr[lo:hi, n - 1 - d, :3] = row
                arr[lo:hi, n - 1 - d, 3] = 255
    # brass tacks holding the cloth along the inside of the frame
    img = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGBA")
    draw = ImageDraw.Draw(img)
    for p in range(64, n - 63, 104):
        for cx, cy in ((p, FRAME // 2), (p, n - 1 - FRAME // 2), (FRAME // 2, p), (n - 1 - FRAME // 2, p)):
            draw.ellipse([cx - 4, cy - 4, cx + 4, cy + 4], fill=rgb("#8a6a2a") + (255,))
            draw.ellipse([cx - 3, cy - 3, cx + 2, cy + 2], fill=rgb("#c9a356") + (255,))
            draw.point((cx - 1, cy - 1), fill=rgb("#f0dca0") + (255,))
    arr = np.array(img).astype(float)
    # the frame casts a thin shadow onto the cloth
    for k, a in enumerate((0.26, 0.14, 0.06)):
        e0, e1 = FRAME + k, n - FRAME - 1 - k
        arr[e0, e0:e1 + 1, :3] *= 1 - a
        arr[e1, e0:e1 + 1, :3] *= 1 - a
        arr[e0:e1 + 1, e0, :3] *= 1 - a
        arr[e0:e1 + 1, e1, :3] *= 1 - a
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGBA")


def aida_tile() -> Image.Image:
    """64 px square of aida (8 stitches) for CSS backgrounds that must line up with the board's grid."""
    return aida_piece(64, 64, 0, 17).convert("RGB")


def frame_piece() -> Image.Image:
    """96 px walnut stretcher frame with an empty middle, sliced at 22 px as a CSS border-image."""
    size = 96
    arr = np.zeros((size, size, 4), float)
    for side in range(4):
        b = wood_bar(size, FRAME, 3 + side, "#6e4a2c")
        for d in range(FRAME):
            lo, hi = d, size - d
            row = b[d, lo:hi]
            if side == 0:
                arr[d, lo:hi, :3], arr[d, lo:hi, 3] = row, 255
            elif side == 1:
                arr[size - 1 - d, lo:hi, :3], arr[size - 1 - d, lo:hi, 3] = row, 255
            elif side == 2:
                arr[lo:hi, d, :3], arr[lo:hi, d, 3] = row, 255
            else:
                arr[lo:hi, size - 1 - d, :3], arr[lo:hi, size - 1 - d, 3] = row, 255
    img = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGBA")
    draw = ImageDraw.Draw(img)
    for cx, cy in ((size // 2, FRAME // 2), (size // 2, size - 1 - FRAME // 2),
                   (FRAME // 2, size // 2), (size - 1 - FRAME // 2, size // 2)):
        draw.ellipse([cx - 4, cy - 4, cx + 4, cy + 4], fill=rgb("#8a6a2a") + (255,))
        draw.ellipse([cx - 3, cy - 3, cx + 2, cy + 2], fill=rgb("#c9a356") + (255,))
    return img


def handkerchief() -> Image.Image:
    """The end-of-game swatch: a small aida square with a madder hem worked in cross stitch."""
    size = 62 * STITCH + 2 * 10
    img = aida_piece(size, size, 10, 9)
    hem = ["M" * 60] + ["M" + "." * 58 + "M"] * 58 + ["M" * 60]
    border = render_grid(hem, STITCH, seed=9, supersample=4)
    img.alpha_composite(border, (10 + STITCH, 10 + STITCH))
    return img


# Bold numerals, two stitches per stroke, 6x9 (comma 3x9).
DIGITS = {
    "0": [".####.", "##..##", "##..##", "##..##", "##..##", "##..##", "##..##", "##..##", ".####."],
    "1": ["..##..", ".###..", "####..", "..##..", "..##..", "..##..", "..##..", "..##..", "######"],
    "2": [".####.", "##..##", "....##", "....##", "...##.", "..##..", ".##...", "##....", "######"],
    "3": [".####.", "##..##", "....##", "..###.", "....##", "....##", "....##", "##..##", ".####."],
    "4": ["...##.", "..###.", ".####.", "##.##.", "##.##.", "######", "...##.", "...##.", "...##."],
    "5": ["######", "##....", "##....", "#####.", "....##", "....##", "....##", "##..##", ".####."],
    "6": ["..###.", ".##...", "##....", "#####.", "##..##", "##..##", "##..##", "##..##", ".####."],
    "7": ["######", "....##", "....##", "...##.", "...##.", "..##..", "..##..", ".##...", ".##..."],
    "8": [".####.", "##..##", "##..##", ".####.", "##..##", "##..##", "##..##", "##..##", ".####."],
    "9": [".####.", "##..##", "##..##", "##..##", ".#####", "....##", "....##", "...##.", ".###.."],
    ",": ["...", "...", "...", "...", "...", ".##", ".##", "..#", ".#."],
    "×": ["......", "......", "##..##", ".####.", "..##..", ".####.", "##..##", "......", "......"],
}
# Order must match GLYPHS in src/ui/stitchedNumber.ts
DIGIT_ORDER = "0123456789,×"


def digit_sheet(color: str) -> Image.Image:
    """Sprite strip of stitched glyphs, each in a 7x9 stitch slot (6 wide + 1 gap)."""
    rows = []
    for y in range(9):
        row = ""
        for ch in DIGIT_ORDER:
            glyph = DIGITS[ch][y].replace("#", "D")
            row += glyph.ljust(7, ".")
        rows.append(row)
    return render_grid(rows, 14, palette={"D": color}, seed=13, leg=0.44)


def pixel_font() -> ImageFont.FreeTypeFont:
    """Fusion Pixel at its native 12 px, unpacked from WOFF2 so FreeType can read it."""
    import io

    from fontTools.ttLib import TTFont

    font = TTFont(str(PIXEL_FONT))
    font.flavor = None
    buf = io.BytesIO()
    font.save(buf)
    buf.seek(0)
    return ImageFont.truetype(buf, PIXEL_PX)


def text_grid(text: str, scale: int = 1) -> list[str]:
    """Charts text from the pixel font: every lit font pixel becomes scale x scale stitches."""
    font = pixel_font()
    left, top, right, bottom = font.getbbox(text)
    img = Image.new("L", (right - left, bottom - top), 0)
    draw = ImageDraw.Draw(img)
    draw.fontmode = "1"  # no anti-aliasing: pixels are either stitched or not
    draw.text((-left, -top), text, font=font, fill=255)
    arr = np.array(img)
    rows = ["".join("M" if v >= 128 else "." for v in row) for row in arr]
    return ["".join(ch * scale for ch in row) for row in rows for _ in range(scale)]


def read_strings() -> dict[str, dict[str, str]]:
    """Pull the zh and en tables out of src/i18n/strings.ts (single-quoted literals only)."""
    source = STRINGS_TS.read_text(encoding="utf-8")
    zh_block = source[source.index("const zh = {"):source.index("} as const;")]
    en_block = source[source.index("const en: Record"):source.index("export const STRINGS")]
    pattern = re.compile(r"'([\w.]+)':\s*'((?:[^'\\]|\\.)*)'")
    return {"zh": dict(pattern.findall(zh_block)), "en": dict(pattern.findall(en_block))}


def stitched_text() -> None:
    """Stitch the display strings (titles, big buttons) for both locales and record what was stitched."""
    import json

    STITCHED_DIR.mkdir(parents=True, exist_ok=True)
    tables = read_strings()
    manifest: dict[str, dict[str, dict[str, object]]] = {}
    for sid, (color, scale, stitch_px) in STITCHED_TEXT.items():
        manifest[sid] = {}
        for locale in ("zh", "en"):
            text = tables[locale][sid]
            grid = text_grid(text, scale)
            img = render_grid(grid, stitch_px, palette={"M": color}, seed=len(text), leg=0.4)
            img.save(STITCHED_DIR / f"{sid}.{locale}.webp", lossless=True, quality=100, method=6)
            # cols/rows let CSS size every stitched string to one shared stitch pitch
            manifest[sid][locale] = {"text": text, "cols": len(grid[0]), "rows": len(grid)}
    (STITCHED_DIR / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
                                                encoding="utf-8")


def particle_x() -> Image.Image:
    return render_grid(["W"], 32, palette={"W": "#ffffff"}, seed=3)


def particle_thread() -> Image.Image:
    s = 4
    img = Image.new("RGBA", (40 * s, 40 * s), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    pts = [(6, 30), (12, 18), (20, 24), (26, 12), (34, 10)]
    draw.line([(x * s, y * s) for x, y in pts], fill=(255, 255, 255, 255), width=3 * s, joint="curve")
    return img.resize((40, 40), Image.Resampling.LANCZOS)


def used_characters() -> str:
    chars: set[str] = set(chr(c) for c in range(0x20, 0x7F))
    chars.update("·—–’“”…×，。、：；！？（）／")
    for path in (ROOT / "src").rglob("*.ts"):
        if path.name.endswith(".test.ts"):
            continue
        for ch in path.read_text(encoding="utf-8"):
            if ord(ch) > 0x7E:
                chars.add(ch)
    return "".join(sorted(chars))


def subset_font() -> None:
    """Ship only the pixel-font glyphs the UI can show, and record them for the coverage test."""
    from fontTools import subset
    from fontTools.ttLib import TTFont

    charset = used_characters()
    cmap = TTFont(str(PIXEL_FONT)).getBestCmap()
    missing = [ch for ch in charset if ord(ch) not in cmap]
    if missing:
        raise SystemExit(f"pixel font lacks glyphs: {''.join(missing)}")
    (SRC_ASSETS / "fonts/ui-charset.txt").write_text(charset, encoding="utf-8")
    options = subset.Options()
    options.flavor = "woff2"
    font = subset.load_font(str(PIXEL_FONT), options)
    subsetter = subset.Subsetter(options)
    subsetter.populate(text=charset)
    subsetter.subset(font)
    subset.save_font(font, str(SRC_ASSETS / "fonts/pixel-subset.woff2"), options)


def sewing_button(color: str, thread: str) -> Image.Image:
    """A big four-hole sewing button, sewn on with a cross of thread."""
    k, size = 4, 128
    img = Image.new("RGBA", (size * k, size * k), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    c = rgb(color)
    r = size * k // 2 - 2 * k
    cx = cy = size * k // 2
    draw.ellipse([cx - r + 3 * k, cy - r + 5 * k, cx + r + 3 * k, cy + r + 5 * k], fill=(51, 36, 26, 70))
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=shade(c, 0.82) + (255,))
    draw.ellipse([cx - r + 6 * k, cy - r + 6 * k, cx + r - 6 * k, cy + r - 6 * k], fill=c + (255,))
    draw.ellipse([cx - r + 14 * k, cy - r + 14 * k, cx + r - 14 * k, cy + r - 14 * k], fill=shade(c, 0.9) + (255,))
    # rim highlight, upper left
    draw.arc([cx - r + 2 * k, cy - r + 2 * k, cx + r - 2 * k, cy + r - 2 * k], 190, 260,
             fill=shade(c, 1.3) + (255,), width=3 * k)
    hole, gap = 7 * k, 15 * k
    holes = [(cx - gap, cy - gap), (cx + gap, cy - gap), (cx - gap, cy + gap), (cx + gap, cy + gap)]
    for hx, hy in holes:
        draw.ellipse([hx - hole, hy - hole, hx + hole, hy + hole], fill=shade(c, 0.45) + (255,))
    t = rgb(thread) + (255,)
    for (ax, ay), (bx, by) in ((holes[0], holes[3]), (holes[1], holes[2])):
        draw.line([(ax, ay), (bx, by)], fill=shade(rgb(thread), 0.75) + (255,), width=6 * k)
        draw.line([(ax, ay - k), (bx, by - k)], fill=t, width=4 * k)
    return img.resize((size, size), Image.Resampling.LANCZOS)


def main() -> None:
    (PUBLIC / "tiles").mkdir(parents=True, exist_ok=True)
    (PUBLIC / "fx").mkdir(parents=True, exist_ok=True)
    (PUBLIC / "board").mkdir(parents=True, exist_ok=True)
    (SRC_ASSETS / "art").mkdir(parents=True, exist_ok=True)
    (SRC_ASSETS / "fonts").mkdir(parents=True, exist_ok=True)

    for i, (kind, grid) in enumerate(MOTIFS.items()):
        # tiles are painted at 2x game resolution: 16 px per stitch, 16x16 cell
        render_grid(grid, STITCH * 2, (CELL_STITCHES, CELL_STITCHES), seed=i + 1).save(
            PUBLIC / f"tiles/tile-{kind}.webp", lossless=True, quality=100, method=6)
    board_texture().save(PUBLIC / "board/board.webp", quality=88, method=6)
    particle_x().save(PUBLIC / "fx/fx-stitch.png", optimize=True)
    particle_thread().save(PUBLIC / "fx/fx-thread.png", optimize=True)

    linen_texture().save(SRC_ASSETS / "art/linen.webp", quality=90, method=6)
    handkerchief().save(SRC_ASSETS / "art/handkerchief.webp", quality=90, method=6)
    digit_sheet(PALETTE["k"]).save(SRC_ASSETS / "art/digits-ink.webp", lossless=True, quality=100, method=6)
    digit_sheet("#a53f26").save(SRC_ASSETS / "art/digits-madder.webp", lossless=True, quality=100, method=6)
    # the menu cat is charted at double count (each square worked as 2x2 stitches)
    big_cat = ["".join(ch * 2 for ch in row) for row in CAT for _ in range(2)]
    render_grid(big_cat, 12, seed=42).save(SRC_ASSETS / "art/menu-cat.webp", lossless=True, quality=100, method=6)
    aida_tile().save(SRC_ASSETS / "art/aida-tile.webp", quality=92, method=6)
    sewing_button("#a53f26", "#f3dcc2").save(SRC_ASSETS / "art/sewing-button.webp", lossless=True, quality=100, method=6)
    frame_piece().save(SRC_ASSETS / "art/frame-wood.webp", lossless=True, quality=100, method=6)
    for name, grid in TOOLS.items():
        render_grid(grid, 16, seed=len(name)).save(SRC_ASSETS / f"art/tool-{name}.webp", lossless=True, quality=100, method=6)
    stitched_text()
    subset_font()
    print("art generated")


if __name__ == "__main__":
    main()
