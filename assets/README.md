# Classic sprite skin (bring your own assets)

StatsPro works out of the box with its built-in original pixel art. If you want
the classic NES look on **your own machine**, you can build a personal sprite
skin from sheets you download yourself. The skin stays local: it's gitignored
and never included in releases.

## Steps

1. **Download these three sprite sheets** (e.g. from a sprite-ripping archive
   like The Spriters Resource — search "NES Contra"):

   | Save as | Sheet to look for |
   |---|---|
   | `enemies.png` | *Contra — Enemies & Bosses — Enemies & Obstacles* |
   | `bill.png` | *Contra — Bill* (the full player sheet with BILL / LANCE sections) |
   | `effects.png` | *Contra — effects* (bullet dots, explosion clouds, death rings) |

2. **Paste all three into this `assets/` folder** with exactly those names:

   ```
   statspro/
     assets/
       enemies.png
       bill.png
       effects.png
   ```

3. **Run the builder** (needs Python 3 with Pillow + NumPy):

   ```bash
   pip install pillow numpy
   python3 assets/build_skin.py
   ```

   You should see a list of extracted sprites (`heroA: 25x46`, `bossA: ...`)
   and `wrote media/sprites.local.js`.

4. **Rebuild + reinstall the extension**, then reload VS Code:

   ```bash
   npx @vscode/vsce package --no-dependencies
   code --install-extension statspro-0.1.0.vsix --force
   ```
   (`Cmd/Ctrl+Shift+P` → "Reload Window")

The game now uses the classic sprites. To go back to the built-in art, delete
`media/sprites.local.js` and reinstall.

## Troubleshooting

- **"Missing assets/…png"** — a sheet is absent or misnamed; names must match
  exactly.
- **"crop came out empty — wrong sheet file?"** — you downloaded a different
  variant of the sheet; the cut coordinates assume the exact sheets named
  above (the common ones for these searches).
- Sprites look wrong/offset — same cause; grab the standard variant of the
  sheet.

## Rules

These sprites are Konami's IP. Personal use on your machine is your business —
but never commit them, never remove them from `.gitignore`, and never include
them in a release or the Marketplace build. The public project ships only
original art.
