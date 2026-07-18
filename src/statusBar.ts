/** The always-on health bar that lives in VS Code's bottom-right status bar. */

import * as vscode from "vscode";
import { Stats, SlotMode, slotText, fmtTokens, fmtDuration } from "./core/stats";

const FILLED = "▰";
const EMPTY = "▱";
const MINI_WIDTH = 6;

/** Pick the character's mood from how hard we're working. */
export function characterFor(s: Stats): string {
  if (s.fillPct >= 0.85) {
    return "🔥"; // burning — near the limit
  }
  if (s.tokPerMin > 5000) {
    return "🏃"; // running — active burn
  }
  return "🧍"; // idle
}

export class StatusBar {
  private item: vscode.StatusBarItem;

  constructor() {
    this.item = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      1000
    );
    this.item.command = "statspro.openPanel";
    this.item.show();
  }

  update(s: Stats, slots: SlotMode[]): void {
    const filled = Math.round(s.fillPct * MINI_WIDTH);
    const bar = FILLED.repeat(filled) + EMPTY.repeat(MINI_WIDTH - filled);
    const pct = Math.round(s.fillPct * 100);
    const char = characterFor(s);

    // e.g.  🧍 ▰▰▰▰▱▱ 62% · opus-4.8 · 3h 12m
    const tail = slots
      .map((m) => slotText(m, s).value)
      .join(" · ");
    this.item.text = `${char} ${bar} ${pct}% · ${tail}`;

    const md = new vscode.MarkdownString(undefined, true);
    md.appendMarkdown(`**StatsPro** — Claude Code usage\n\n`);
    md.appendMarkdown(`- **Model:** ${s.model}\n`);
    md.appendMarkdown(`- **Session:** ${fmtTokens(s.sessionTotal)} tokens\n`);
    md.appendMarkdown(`- **5h window:** ${fmtTokens(s.windowTotal)} tokens (${pct}%)\n`);
    md.appendMarkdown(`- **Burn rate:** ${fmtTokens(s.tokPerMin)} tok/min\n`);
    md.appendMarkdown(`- **Frees up in:** ${fmtDuration(s.timeLeft)}\n\n`);
    md.appendMarkdown(`_Click to open the retro panel_`);
    this.item.tooltip = md;
  }

  dispose(): void {
    this.item.dispose();
  }
}
