#!/usr/bin/env python3
"""Build a personal NES sprite skin (media/sprites.local.js) from sheets YOU provide.

StatsPro ships with original pixel art and works out of the box. If you want the
classic NES Contra look on your own machine, obtain these sprite sheets yourself
(e.g. from a sprite-rip archive) and drop them into this assets/ folder:

  enemies.png   "NES - Contra - Enemies & Bosses - Enemies & Obstacles"
  bill.png      "NES - Contra - Bill" (the full Bill/Lance sheet, aka all.png)
  effects.png   the explosion/bullet effects sheet (aka bullets.png)

Then:  python3 assets/build_skin.py     (needs: pip install pillow numpy)

The generated media/sprites.local.js is GITIGNORED on purpose: these sprites are
Konami's IP — fine to use privately, never committed or redistributed. Do not
remove it from .gitignore; release builds must exclude it.
"""

import base64
import io
import os
import sys

try:
    import numpy as np
    from PIL import Image, ImageOps
except ImportError:
    sys.exit("Please: pip install pillow numpy")

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "media", "sprites.local.js")

SHEETS = {
    "enemies": os.path.join(HERE, "enemies.png"),
    "bill": os.path.join(HERE, "bill.png"),
    "effects": os.path.join(HERE, "effects.png"),
}

# (sheet, box, flip_horizontal, downscale_2x)
CUTS = {
    # invaders (face left already)
    "enemyA": ("enemies", (97, 57, 113, 85), False, False),
    "enemyB": ("enemies", (114, 53, 131, 85), False, False),
    "enemyC": ("enemies", (132, 53, 148, 85), False, False),
    # walking riflemen (face right on the sheet -> flip)
    "gunnerA": ("enemies", (1, 17, 25, 49), True, False),
    "gunnerB": ("enemies", (26, 18, 50, 50), True, False),
    # the alien boss walk pair
    "bossA": ("enemies", (479, 17, 503, 49), False, False),
    "bossB": ("enemies", (504, 17, 528, 49), False, False),
    # Bill: standing fire pair + run-and-gun pair
    "heroA": ("bill", (480, 25, 505, 71), False, False),
    "heroB": ("bill", (544, 24, 570, 72), False, False),
    "heroRunA": ("bill", (675, 26, 700, 71), False, False),
    "heroRunB": ("bill", (739, 25, 765, 72), False, False),
    # effects sheet is drawn at 2x — downscale to NES-native
    "bullet": ("effects", (153, 54, 201, 150), False, True),
    "muzzle": ("effects", (165, 252, 195, 288), False, True),
    "boomA": ("effects", (309, 30, 357, 126), False, True),
    "boomB": ("effects", (609, 6, 705, 198), False, True),
    "boomC": ("effects", (363, 6, 555, 198), False, True),
    "deathA": ("effects", (219, 204, 411, 396), False, True),
    "deathB": ("effects", (417, 204, 609, 396), False, True),
    "deathC": ("effects", (615, 204, 807, 396), False, True),
}


def clean(arr):
    """Make plate/background pixels transparent, trim margins."""
    crop = arr.copy()
    # dark cell background
    dark = (crop[..., 0] < 40) & (crop[..., 1] < 40) & (crop[..., 2] < 40)
    # light canvas (effects sheet)
    light = (crop[..., 0] > 195) & (crop[..., 1] > 195) & (crop[..., 2] > 195)
    crop[dark | light] = (0, 0, 0, 0)
    # dominant remaining opaque color = colored plate (blue/red section bg)
    opq = crop[crop[..., 3] == 255]
    if len(opq):
        colors, counts = np.unique(opq.reshape(-1, 4), axis=0, return_counts=True)
        plate = colors[counts.argmax()]
        # only strip it if it's clearly a plate (covers a big share of the crop)
        if counts.max() > crop.shape[0] * crop.shape[1] * 0.25:
            crop[np.all(crop == plate, axis=2)] = (0, 0, 0, 0)
    keep = crop[..., 3] > 0
    ys, xs = np.where(keep)
    if len(ys) == 0:
        raise ValueError("crop came out empty — wrong sheet file?")
    return Image.fromarray(crop[ys.min():ys.max() + 1, xs.min():xs.max() + 1])


def data_uri(im):
    buf = io.BytesIO()
    im.save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


def main():
    sheets = {}
    for key, p in SHEETS.items():
        if not os.path.exists(p):
            sys.exit(f"Missing {p} — see the docstring for which sheets to provide.")
        sheets[key] = Image.open(p).convert("RGBA")

    lines = [
        "// LOCAL ONLY — NES Contra sprites for personal use. Gitignored;",
        "// the public build falls back to the original art in sprites.js.",
        "window.STATSPRO_LOCAL_SPRITES = {",
    ]
    for name, (sheet, box, flip, half) in CUTS.items():
        im = clean(np.array(sheets[sheet].crop(box)))
        if flip:
            im = ImageOps.mirror(im)
        if half:
            im = im.resize((max(1, im.size[0] // 2), max(1, im.size[1] // 2)), Image.NEAREST)
        lines.append(f'  {name}: {{ w: {im.size[0]}, h: {im.size[1]}, uri: "{data_uri(im)}" }},')
        print(f"  {name}: {im.size[0]}x{im.size[1]}")
    lines.append("};")

    with open(OUT, "w") as f:
        f.write("\n".join(lines) + "\n")
    print(f"\nwrote {os.path.normpath(OUT)}")
    print("Reinstall/reload the extension to see it.")


if __name__ == "__main__":
    main()
