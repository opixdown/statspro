# StatsPro — a retro token health bar for Claude Code

StatsPro is a VS Code extension that shows how much of your Claude Code usage
you've burned through — as a retro **health bar** with a little character riding
on top. It answers the questions "how many tokens am I spending?" and "how long
until my 5-hour window frees up?" without leaving your editor.

It has two faces:

- **Status bar strip** — an always-on mini bar in the bottom-right corner.
  Terminal untouched, glanceable, out of the way.

  ```
  🧍 ▰▰▰▰▱▱ 62% · opus-4.8 · 3h 12m left
  ```

- **Retro panel** — an animated webview (open with a command) where a character
  runs on top of a big glowing bar, with flames when you're burning hard. 🔥

Both read the same data straight from your local Claude Code transcripts
(`~/.claude/projects/*/*.jsonl`) — no network, no account, nothing leaves your
machine.

## What it shows

- **Health bar** — your rolling 5-hour token window, filling orange → yellow → red
- **Character** — idle 🧍 / running 🏃 / burning 🔥 based on how hard you're working
- **Three configurable slots** — by default `model`, `session tokens`, `time left`

## Install (development)

```bash
git clone <your-repo-url> statspro
cd statspro
npm install
npm run compile
```

Then open the folder in VS Code and press **F5** ("Run StatsPro Extension").
A second VS Code window opens with the extension loaded — look at the
bottom-right status bar, and run **"StatsPro: Open Health Bar Panel"** from the
Command Palette (⇧⌘P) for the retro view.

## Settings

| Setting | Default | Meaning |
|---|---|---|
| `statspro.tokenBudget5h` | `2000000` | Tokens your 5-hour window is worth (drives the fill %). Tune to your plan. |
| `statspro.windowHours` | `5` | Length of the rolling usage window. |
| `statspro.refreshSeconds` | `5` | How often to recompute usage. |
| `statspro.slots` | `["model","tokens_total","time_left_5h"]` | The three readouts. |

**Slot modes:** `model`, `tokens_total`, `tokens_5h`, `time_left_5h`,
`tok_per_min`, `context`.

## How it works

```
~/.claude/projects/*/*.jsonl        (Claude Code transcripts)
        │
        ▼
  core/transcripts.ts   → parse lines, pull usage + timestamps
  core/stats.ts         → tally session / 5h window / burn rate
        │
        ├── statusBar.ts → the always-on strip
        └── panel.ts + media/ → the retro animated webview
```

## Roadmap

- [ ] Drop-in custom character sprites (idle / running / burning art)
- [ ] Weekly-limit ring in addition to the 5-hour window
- [ ] Auto-calibrate `tokenBudget5h` from observed resets
- [ ] Publish to the VS Code Marketplace

## License

MIT © 2026 opixdown
