# StatsPro — project context for Claude

## What this is
A VS Code extension showing a retro **token health bar** for Claude Code usage —
like "VSCode Pets, but it's your usage meter." A small animated widget with a
character that reacts to how hard you're working: idle 🧍 → running 🏃 → burning 🔥.

Owner: opixdown (atharvawaghmare34@gmail.com). Public repo:
https://github.com/opixdown/statspro (branch `master`). Goal: open-source it,
eventually publish to the VS Code Marketplace.

## The vision (settled after several iterations — don't relitigate)
- **The product is the VS Code extension, only.** The widget docks in the
  **Source Control (SCM) sidebar, ABOVE the git graph** — always visible,
  aesthetic, classic/retro, animated.
- Everything else was tried and **removed by the user's decision**: the VS Code
  status-bar strip, the terminal TUI (`statspro.py`), the Claude Code status
  line (`statusline.py`), a web artifact preview (was only a mock), bottom-panel
  and Explorer docks. Don't resurrect them.

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
- `src/extension.ts` — entrypoint; 5s timer; feeds the webview view
- `src/core/transcripts.ts` — jsonl parsing (`sessionFileForWorkspace` maps a
  workspace path to its `~/.claude/projects/<encoded>` dir by replacing `/` and
  `.` with `-`)
- `src/core/stats.ts` — tallies + 3 configurable "slots" (`statspro.slots`)
- `src/panel.ts` — `WebviewViewProvider` (`statsproView`) registered in the
  `scm` view container with `order: -100` (user still drags it above the graph
  manually; VS Code persists that)
- `media/panel.{html,css,js}` — the retro CRT look: scanlines, glowing bar
  (orange→yellow→red at 60%/85%), character rides the fill edge, flames when
  burning. Layout tuned for narrow sidebars (flex-wrap slots).

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
