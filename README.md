# StatsPro — a retro token health bar for Claude Code

StatsPro is a VS Code extension that shows how much of your Claude Code usage
you've burned through — a retro, animated **health bar** with a little character
riding on top, docked right in your Source Control sidebar. Think *VSCode Pets,
but it's your usage meter*.

```
            🏃
 ▐██████████████░░░░░░░░░░▌ 58%
 opus-4.8 · 587k · 3h48m left
```

- **Health bar** — your rolling 5-hour token window, glowing orange → yellow → red
- **Character** — idle 🧍 when you're calm, running 🏃 when you're busy,
  on fire 🔥 as you approach the limit
- **Three configurable slots** — model · session tokens · time left (swappable)

It reads straight from your local Claude Code transcripts
(`~/.claude/projects`) — no network, no account, nothing leaves your machine.

## Install (from source)

```bash
git clone https://github.com/opixdown/statspro.git
cd statspro
npm install
npm run compile
npx @vscode/vsce package --no-dependencies
code --install-extension statspro-0.1.0.vsix
```

Reload VS Code, open the **Source Control** view (`Ctrl/Cmd+Shift+G`), and the
**StatsPro** section is there — drag its header wherever you like; VS Code
remembers your layout.

## Settings

| Setting | Default | Meaning |
|---|---|---|
| `statspro.tokenBudget5h` | `1000000` | Tokens your 5-hour window is worth (drives the fill %). Tune to your plan. |
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
  src/core/transcripts.ts   → parse lines, pull usage + timestamps
  src/core/stats.ts         → tally session / 5h window / burn rate
        │
        ▼
  src/panel.ts + media/     → the retro animated sidebar widget
```

## Roadmap

- [ ] Real pixel-art character sprites (idle / running / burning)
- [ ] Weekly-limit ring in addition to the 5-hour window
- [ ] Auto-calibrate `tokenBudget5h` from observed resets
- [ ] Publish to the VS Code Marketplace

## License

MIT © 2026 opixdown
