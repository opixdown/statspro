# StatsPro

Your Claude Code usage as a retro auto-battler, in the VS Code sidebar.
The hero holds the line; enemies charge as you burn tokens; your rolling
5-hour window is the level — boss at 85%, **STAGE CLEAR** at 100%.
100% local: reads `~/.claude/projects` transcripts, nothing leaves your machine.

<img width="298" height="159" alt="image" src="https://github.com/user-attachments/assets/37b83e0f-4e7b-4762-b185-dd7d93524627" />


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

Ships with original pixel art.
Download it here: https://limewire.com/d/6Z7Gm#ZH9xmh8Ep5
and paste them into
`~/.statspro/assets/`:

```
enemies.png   Contra — Enemies & Bosses — Enemies & Obstacles
bill.png      Contra — Bill (full player sheet)
effects.png   Contra — effects (bullets, explosions, rings)
```

That's it — the widget notices and reloads itself in a couple of seconds.
Delete the files to go back. Sheets stay on your machine: never committed,
never shipped.


## Develop

`node tests/sim.js` runs the headles game simulator (6 scenarios) — run it
after any gameplay change.

MIT © 2026 opixdown · Font: Press Start 2P (OFL)
