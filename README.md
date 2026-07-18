# StatsPro — your Claude Code usage, as a retro auto-battler

StatsPro is a VS Code extension that turns your Claude Code token usage into a
tiny **Contra-style game** that plays itself in your Source Control sidebar.

The hero holds the left flank, running and gunning. Enemies charge in from the
right; gunners dig in and fire back. **The "player" is your AI**: when Claude
sits idle the front is quiet — when you work it hard, the firefight rages.
Your rolling 5-hour token window is the level:

```
  KILLS 023                              64%
   🏃🔫 · · · ➤        👥    👥      👾
 ▐████████████████░░░░░░░░░░░░░▌
 opus-4.8 · 587k · 3h48m
```

- **The health bar** is your real 5-hour token window (orange → yellow → red)
- **Waves** at 25% / 50% / 75% — squads crash in with arcade banners
- **At 85%** the boss stalks in (`WARNING!!`)
- **At 100%** you take it down — `STAGE CLEAR` 🏆 — and when your window
  resets, the next stage begins
- **Kill counter**, muzzle flashes, explosions, misses, hit flinches — a real
  little firefight, paced by a Director that follows your smoothed burn rate

Everything reads from your local Claude Code transcripts (`~/.claude/projects`)
— no network, no account, nothing leaves your machine.

## Install

**From a release (easiest):** grab `statspro-x.y.z.vsix` from
[Releases](https://github.com/opixdown/statspro/releases), then:

```bash
code --install-extension statspro-0.1.0.vsix
```

**From source:**

```bash
git clone https://github.com/opixdown/statspro.git
cd statspro
npm install
npm run compile
npx @vscode/vsce package --no-dependencies
code --install-extension statspro-0.1.0.vsix
```

Then reload VS Code and open the **Source Control** view (`Ctrl/Cmd+Shift+G`) —
the **StatsPro** section is there. Drag its header to reorder; give it height
and it breathes.

## Settings

| Setting | Default | Meaning |
|---|---|---|
| `statspro.plan` | `auto` | Your Claude plan → 5h token budget. `auto` detects it from Claude Code's own config. Presets: `pro` ≈ 1M, `max5x` ≈ 5M, `max20x` ≈ 10M, or `custom`. |
| `statspro.tokenBudget5h` | `2000000` | Custom budget (only when `plan` is `custom`). |
| `statspro.windowHours` | `5` | Length of the rolling usage window. |
| `statspro.refreshSeconds` | `5` | How often usage is recomputed. |
| `statspro.slots` | `["model","tokens_total","time_left_5h"]` | The three readouts under the bar. |

**Slot modes:** `model`, `tokens_total`, `tokens_5h`, `time_left_5h`,
`tok_per_min`, `context`.

## How it works

```
~/.claude/projects/*/*.jsonl          (Claude Code transcripts, read incrementally)
        │
        ▼
  src/core/transcripts.ts   parse + per-file byte-offset cache
  src/core/stats.ts         session / 5h window / burn rate
  src/core/plan.ts          auto-detect your plan from ~/.claude.json
        │  {fillPct, tokPerMin} every 5s
        ▼
  media/director.js         usage → pacing: patrol/assault/lull, waves, boss
  media/entities.js         hero, enemy types, bullets, booms (data-driven)
  media/engine.js           canvas loop, entity lifecycle, the bar
  media/sprites.js          pixel art loading (original art built in)
```

Token counting deliberately excludes `cache_read_input_tokens` — cache reads
replay the whole context every turn and would peg the bar at 100%.

## Tests

A headless simulator drives the whole game logic in Node — no browser needed:

```bash
node tests/sim.js
```

Six scenarios (busy / idle / boss / win / stage-reset / 5000-tick soak) with
invariant checks and pacing metrics. It has already caught real bugs; run it
before sending a PR.

## Art

The repo ships **original pixel art** (a hand-drawn commando, palette-swapped
grunts). The sprite loader also supports a personal, gitignored skin file
(`media/sprites.local.js`) for your own machine — that file never ships and is
excluded from releases.

## Roadmap

- [ ] More enemy types (grenades, jumpers, turrets) and hero poses
- [ ] Alternate themes (Sonic-style runner, dino runner)
- [ ] Weekly-limit meter alongside the 5-hour window
- [ ] Auto-calibrate the budget from observed limit events
- [ ] VS Code Marketplace listing

## License

MIT © 2026 opixdown. Bundled font: Press Start 2P (SIL OFL, see
`media/OFL-PressStart2P.txt`).
