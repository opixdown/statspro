# StatsPro — project context for Claude

## What this is
A VS Code extension showing a retro **token health bar** for Claude Code usage —
like "VSCode Pets, but it's your usage meter." A small animated widget with a
character that reacts to how hard you're working: idle 🧍 → running 🏃 → burning 🔥.

Owner: opixdown (atharvawaghmare34@gmail.com). Public repo:
https://github.com/opixdown/statspro (branch `master`). Goal: open-source it,
eventually publish to the VS Code Marketplace.

## The vision (settled after several iterations — don't relitigate)
- **The product is the VS Code extension, only** — docked in the **Source
  Control (SCM) sidebar, ABOVE the git graph**.
- **It's a game now**: a Contra-style auto-battler where the hero holds the
  left flank and enemies invade from the right, paced by real usage (the AI is
  the player). The 5h window is the level; boss at 85%; STAGE CLEAR at 100%.
- Earlier forms tried and **removed by the user's decision**: status-bar strip,
  terminal TUI, Claude Code status line, web preview, bottom-panel/Explorer
  docks. Don't resurrect them.
- **Sprites:** the public repo ships ONLY original art (in `media/sprites.js`).
  The user's machine has a gitignored `media/sprites.local.js` with NES Contra
  rips for personal use — it must NEVER be committed or shipped in a public
  release vsix (build release artifacts with that file moved aside).
- Future theme ideas the user wants someday: Sonic-style runner, dino runner.

## How it works
Reads Claude Code transcripts at `~/.claude/projects/*/*.jsonl`. Each assistant
line has `message.usage` + `timestamp`. **Token counting rule:** count
`input_tokens + output_tokens + cache_creation_input_tokens` and **exclude
`cache_read_input_tokens`** (cache reads repeat the whole context every turn and
would peg the bar at 100% — this was a real bug, keep the exclusion).

Numbers computed (src/core/stats.ts):
- session total tokens (newest transcript for the workspace)
- rolling 5h-window total across ALL projects
- burn rate (tokens in last 60s), time until window frees up
- fill % = windowTotal / `statspro.tokenBudget5h` (default 1M, needs calibration
  to the user's real plan ceiling)

## Architecture
- `src/extension.ts` — entrypoint; 5s timer (skips when view hidden); plan
  presets (`statspro.plan`, auto-detected via `src/core/plan.ts` from
  `~/.claude.json` → `oauthAccount.organizationRateLimitTier`)
- `src/core/transcripts.ts` — jsonl parsing with an incremental per-file cache
  (byte offsets; only appended bytes re-read; stat-only skip for stale files)
- `src/core/stats.ts` — session / 5h-window / burn-rate tallies + 3 slots
- `src/panel.ts` — `WebviewViewProvider` (`statsproView`) in the `scm`
  container; injects `sprites.local.js` tag only if the file exists
- `media/engine.js` — canvas loop (14fps ticks, clamped catch-up), entity
  lifecycle, bar rendering
- `media/entities.js` — Hero/Enemy/Bullet/Boom/Boss behaviors; `ENEMY_TYPES`
  table is data-driven (add a row = new enemy)
- `media/director.js` — usage → pacing brain: patrol/assault/lull rhythm,
  EMA intensity, waves, boss fight, stage resets
- `media/sprites.js` — art loading; original art inline as pixel grids
- `tests/sim.js` — headless Node simulator (6 scenarios + soak): run
  `node tests/sim.js` after ANY gameplay change; it catches real regressions.

## Build / install loop
```bash
npm run compile
npx --yes @vscode/vsce package --no-dependencies --allow-missing-repository
code --install-extension statspro-0.1.0.vsix --force
# then: Cmd+Shift+P → "Reload Window" in VS Code (required every reinstall)
```
Gotchas already hit: `*/` inside a JSDoc comment breaks the block comment;
`activationEvents: ["onStartupFinished"]` is required or nothing activates;
`.vscodeignore` excludes the Python files from the vsix.

## Commit style
Commit as `-c user.name="opixdown" -c user.email="atharvawaghmare34@gmail.com"`.
**Never add a `Co-Authored-By: Claude` trailer** — the user explicitly doesn't
want it; commits are theirs alone.

## Next up (user's stated priorities)
1. **Character art** — user wants to design real sprites (idle/running/burning,
   "Sonic-like"); currently placeholder emoji. Drop into `media/`.
2. Calibrate `statspro.tokenBudget5h` to the real plan limit.
3. Polish retro look in the narrow SCM sidebar; keep it "cool aesthetic classic."
4. Marketplace prep (icon.png, repo field in package.json, publish).
