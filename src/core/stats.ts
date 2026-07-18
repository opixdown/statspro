/** Turn raw transcript entries into the numbers the HUD renders. */

import { allTranscripts, readTranscript } from "./transcripts";

export interface Stats {
  model: string; // prettified, e.g. "opus-4.8"
  sessionTotal: number; // tokens in the current session
  windowTotal: number; // tokens across all projects in the window
  tokPerMin: number; // tokens in the last 60s (burn rate)
  timeLeft: number; // seconds until the window frees up
  fillPct: number; // 0..1, windowTotal / budget
}

export interface GatherOptions {
  transcriptPath?: string | null;
  modelHint?: string | null;
  budget5h: number;
  windowHours: number;
}

export function prettyModel(name: string | null | undefined): string {
  if (!name) {
    return "claude";
  }
  const n = name.toLowerCase().replace("claude-", "").replace(/ /g, "-");
  const parts = n.split("-");
  if (parts.length >= 3 && /^\d+$/.test(parts[1]) && /^\d+$/.test(parts[2])) {
    return `${parts[0]}-${parts[1]}.${parts[2]}`;
  }
  return n;
}

export function fmtTokens(n: number): string {
  n = Math.round(n);
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1)}M`;
  }
  if (n >= 1_000) {
    return `${(n / 1_000).toFixed(1)}k`;
  }
  return String(n);
}

export function fmtDuration(seconds: number): string {
  seconds = Math.max(0, Math.floor(seconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}

export function gather(opts: GatherOptions): Stats {
  const now = Date.now();
  const windowStart = now - opts.windowHours * 3600 * 1000;
  const oneMinAgo = now - 60 * 1000;

  // --- current session ---
  let sessionTotal = 0;
  let sessionModel: string | null = null;
  if (opts.transcriptPath) {
    for (const e of readTranscript(opts.transcriptPath)) {
      sessionTotal += e.tokens;
      if (e.model) {
        sessionModel = e.model;
      }
    }
  }

  // --- window + burn rate across every project (same scope for both,
  // so the game's pacing tracks ALL your Claude work, not one window) ---
  let windowTotal = 0;
  let tokPerMin = 0;
  let oldest: number | null = null;
  for (const file of allTranscripts()) {
    // untouched-since-window-start files can't contribute; stat-only skip
    for (const e of readTranscript(file, windowStart)) {
      if (e.ts !== null && e.ts >= windowStart) {
        windowTotal += e.tokens;
        if (e.ts >= oneMinAgo) {
          tokPerMin += e.tokens;
        }
        if (oldest === null || e.ts < oldest) {
          oldest = e.ts;
        }
      }
    }
  }

  const timeLeft =
    oldest !== null
      ? (oldest + opts.windowHours * 3600 * 1000 - now) / 1000
      : opts.windowHours * 3600;

  return {
    model: prettyModel(opts.modelHint || sessionModel),
    sessionTotal,
    windowTotal,
    tokPerMin,
    timeLeft,
    fillPct: opts.budget5h > 0 ? Math.min(1, windowTotal / opts.budget5h) : 0,
  };
}

export type SlotMode =
  | "model"
  | "tokens_total"
  | "tokens_5h"
  | "time_left_5h"
  | "tok_per_min"
  | "context";

/** Render one readout slot as { value, label }. */
export function slotText(mode: SlotMode, s: Stats): { value: string; label: string } {
  switch (mode) {
    case "model":
      return { value: s.model, label: "model" };
    case "tokens_total":
      return { value: `${fmtTokens(s.sessionTotal)} tok`, label: "session" };
    case "tokens_5h":
      return { value: `${fmtTokens(s.windowTotal)} tok`, label: "5h used" };
    case "time_left_5h":
      return { value: `${fmtDuration(s.timeLeft)} left`, label: "5h window" };
    case "tok_per_min":
      return { value: `${fmtTokens(s.tokPerMin)}/min`, label: "burn rate" };
    case "context":
      return { value: `${Math.round(s.fillPct * 100)}%`, label: "used" };
    default:
      return { value: "-", label: "" };
  }
}
