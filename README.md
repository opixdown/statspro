# StatsPro — a retro token health bar for Claude Code

StatsPro is a tiny **retro terminal app** that shows how much of your Claude Code
usage you've burned through — a glowing **health bar** with a little character
riding on top. Run it in its own small terminal window, tuck it into a corner of
your screen, and glance over any time to see "how many tokens am I spending?" and
"how long until my 5-hour window frees up?"

```
────────────────────────────────
 STATSPRO                      ▓
              🏃
 ▐██████████████░░░░░░░░░░▌ 58%
 opus-4.8 · 587k · 3h48m
────────────────────────────────
```

The character is **idle** 🧍 when you're calm, **running** 🏃 when you're busy,
and **on fire** 🔥 as you approach the limit. It reads straight from your local
Claude Code transcripts — no network, no account, nothing leaves your machine.

## Run it

```bash
python3 statspro.py
```

That's it — no dependencies, just Python 3. Open a small terminal window, run it,
and drag the window into a corner of your screen. `Ctrl-C` to quit.

Flags: `--once` (draw one frame and exit), `--fps N` (animation speed).

## Bonus: a Claude Code status-line mode

Prefer it pinned to the bottom of your Claude Code terminal instead of a separate
window? `statusline.py` renders the same bar as a Claude Code status line. Add to
`~/.claude/settings.json`:

```json
{ "statusLine": { "type": "command", "command": "python3 /path/to/statusline.py" } }
```

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
