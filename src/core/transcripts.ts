/**
 * Reading Claude Code transcript files under `~/.claude/projects`.
 *
 * Every assistant line carries a `message.usage` object and a `timestamp`; those
 * two things are the raw material for every number StatsPro shows.
 */

import * as fs from "fs";
import * as os from "os";
import * as path from "path";

export interface Entry {
  ts: number | null; // epoch ms
  tokens: number;
  model: string | null;
}

const PROJECTS_DIR = path.join(os.homedir(), ".claude", "projects");

function parseTs(ts: unknown): number | null {
  if (typeof ts !== "string") {
    return null;
  }
  const ms = Date.parse(ts);
  return Number.isNaN(ms) ? null : ms;
}

function messageTokens(usage: any): number {
  if (!usage || typeof usage !== "object") {
    return 0;
  }
  // Count *new* work only: prompt + output + fresh cache writes. We deliberately
  // exclude `cache_read_input_tokens` — those are the whole context re-read every
  // turn, so they repeat and dwarf everything, which would peg the bar at 100%.
  return (
    (usage.input_tokens || 0) +
    (usage.output_tokens || 0) +
    (usage.cache_creation_input_tokens || 0)
  );
}

/** Parse one transcript file into a list of assistant-message entries. */
export function readTranscript(file: string): Entry[] {
  const out: Entry[] = [];
  let text: string;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch {
    return out;
  }
  for (const line of text.split("\n")) {
    if (!line.includes('"usage"')) {
      continue;
    }
    let rec: any;
    try {
      rec = JSON.parse(line);
    } catch {
      continue;
    }
    const msg = rec.message || {};
    if (!msg.usage) {
      continue;
    }
    out.push({
      ts: parseTs(rec.timestamp),
      tokens: messageTokens(msg.usage),
      model: msg.model || null,
    });
  }
  return out;
}

/**
 * Find the current session's transcript for a workspace folder.
 *
 * Claude Code stores a project's sessions under a folder whose name is the
 * absolute workspace path with every `/` and `.` turned into `-`
 * (e.g. `/Users/me/Desktop/statspro` -> `-Users-me-Desktop-statspro`).
 * The "current" session is the most recently modified `.jsonl` in there.
 */
export function sessionFileForWorkspace(wsPath: string): string | null {
  const encoded = wsPath.replace(/[/.]/g, "-");
  const dir = path.join(PROJECTS_DIR, encoded);
  let names: string[];
  try {
    names = fs.readdirSync(dir);
  } catch {
    return null;
  }
  let newest: string | null = null;
  let newestMtime = -1;
  for (const name of names) {
    if (!name.endsWith(".jsonl")) {
      continue;
    }
    const full = path.join(dir, name);
    try {
      const m = fs.statSync(full).mtimeMs;
      if (m > newestMtime) {
        newestMtime = m;
        newest = full;
      }
    } catch {
      /* ignore */
    }
  }
  return newest;
}

/** Every transcript path across every project. */
export function allTranscripts(): string[] {
  const files: string[] = [];
  let projects: string[];
  try {
    projects = fs.readdirSync(PROJECTS_DIR);
  } catch {
    return files;
  }
  for (const proj of projects) {
    const dir = path.join(PROJECTS_DIR, proj);
    let entries: string[];
    try {
      entries = fs.readdirSync(dir);
    } catch {
      continue;
    }
    for (const name of entries) {
      if (name.endsWith(".jsonl")) {
        files.push(path.join(dir, name));
      }
    }
  }
  return files;
}
