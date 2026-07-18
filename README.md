# StatsPro

Your Claude Code usage as a retro auto-battler, in the VS Code sidebar.
The hero holds the line; enemies charge as you burn tokens; your rolling
5-hour window is the level — boss at 85%, **STAGE CLEAR** at 100%.
100% local: reads `~/.claude/projects` transcripts, nothing leaves your machine.

```
  KILLS 023                          64%
   🏃🔫 · · · ➤       👥    👥    👾
 ▐████████████████░░░░░░░░░░░▌
 opus-4.8 · 587k · 3h48m
```

## Install

Download the `.vsix` from [Releases](https://github.com/opixdown/statspro/releases), then:

```bash
code --install-extension statspro-0.1.0.vsix
```

Reload VS Code → open **Source Control** (`Ctrl/Cmd+Shift+G`) → StatsPro is there.

Or from source:

```bash
git clone https://github.com/opixdown/statspro.git && cd statspro
npm install && npm run compile
npx @vscode/vsce package --no-dependencies
code --install-extension statspro-0.1.0.vsix
```

## Classic sprites (optional)

Ships with original pixel art. For the classic NES look, download these three
sheets yourself (search "NES Contra" on a sprite archive) and paste them into
`~/.statspro/assets/`:

```
enemies.png   Contra — Enemies & Bosses — Enemies & Obstacles
bill.png      Contra — Bill (full player sheet)
effects.png   Contra — effects (bullets, explosions, rings)
```

That's it — the widget notices and reloads itself in a couple of seconds.
Delete the files to go back. Sheets stay on your machine: never committed,
never shipped.

## Settings

| Setting | Default | |
|---|---|---|
| `statspro.plan` | `auto` | Detects your Claude plan (Pro / Max 5x / Max 20x) for the 5h budget; or set it yourself, or `custom` + `statspro.tokenBudget5h`. |
| `statspro.slots` | model · tokens · time left | The three readouts under the bar. |

## Develop

`node tests/sim.js` runs the headless game simulator (6 scenarios) — run it
after any gameplay change.

MIT © 2026 opixdown · Font: Press Start 2P (OFL)
