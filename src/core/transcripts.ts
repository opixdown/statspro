/**
 * Reading Claude Code transcript files under `~/.claude/projects`.
 *
 * Every assistant line carries a `message.usage` object and a `timestamp`; those
 * two things are the raw material for every number StatsPro shows.
 *
 * Reads are INCREMENTAL: per file we cache parsed entries plus the byte offset
 * we've consumed. On refresh we stat() everything, re-read only appended bytes
 * of files that grew, and skip untouched files entirely — so the 5-second poll
 * costs a handful of stat calls, not a full re-parse of months of transcripts.
 */

import * as fs from "fs";
import * as os from "os";
import * as path from "path";

export interface Entry {
  ts: number | null; // epoch ms
  tokens: number;
  model: string | null;
}

interface CacheSlot {
  size: number;
  mtimeMs: number;
  offset: number; // bytes fully parsed
  carry: string; // trailing partial line
  entries: Entry[];
  lastMtimeMs: number; // newest entry timestamp proxy
}

const PROJECTS_DIR = path.join(os.homedir(), ".claude", "projects");
const cache = new Map<string, CacheSlot>();

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
  // exclude `cache_read_input_tokens` — those re-read the whole context every
  // turn, repeat endlessly, and would peg the bar at 100%.
  return (
    (usage.input_tokens || 0) +
    (usage.output_tokens || 0) +
    (usage.cache_creation_input_tokens || 0)
  );
}

/** Parse whole lines out of a text chunk into entries. */
function parseLines(text: string, into: Entry[]): void {
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
    into.push({
      ts: parseTs(rec.timestamp),
      tokens: messageTokens(msg.usage),
      model: msg.model || null,
    });
  }
}

/**
 * Entries for one transcript, incrementally maintained.
 * `minMtimeMs`: if the file hasn't been touched since then AND we have a cache,
 * the cached entries are returned without any file I/O beyond stat().
 */
export function readTranscript(file: string, minMtimeMs = 0): Entry[] {
  let st: fs.Stats;
  try {
    st = fs.statSync(file);
  } catch {
    cache.delete(file);
    return [];
  }

  const slot = cache.get(file);
  if (slot && st.size === slot.size && st.mtimeMs === slot.mtimeMs) {
    return slot.entries; // untouched
  }
  if (slot && st.mtimeMs < minMtimeMs) {
    return slot.entries; // stale file, cached view is good enough
  }

  // grew in place: read only the appended bytes
  if (slot && st.size > slot.size) {
    try {
      const fd = fs.openSync(file, "r");
      const buf = Buffer.alloc(st.size - slot.offset);
      fs.readSync(fd, buf, 0, buf.length, slot.offset);
      fs.closeSync(fd);
      const text = slot.carry + buf.toString("utf8");
      const lastNl = text.lastIndexOf("\n");
      parseLines(text.slice(0, lastNl + 1), slot.entries);
      slot.carry = lastNl >= 0 ? text.slice(lastNl + 1) : text;
      slot.offset = st.size;
      slot.size = st.size;
      slot.mtimeMs = st.mtimeMs;
      return slot.entries;
    } catch {
      cache.delete(file); // fall through to full read
    }
  }

  // full (re)read: new file, shrunk file, or failed incremental
  const fresh: CacheSlot = {
    size: st.size,
    mtimeMs: st.mtimeMs,
    offset: st.size,
    carry: "",
    entries: [],
    lastMtimeMs: st.mtimeMs,
  };
  try {
    const text = fs.readFileSync(file, "utf8");
    const lastNl = text.lastIndexOf("\n");
    parseLines(text.slice(0, lastNl + 1), fresh.entries);
    fresh.carry = lastNl >= 0 ? text.slice(lastNl + 1) : text;
  } catch {
    return [];
  }
  cache.set(file, fresh);
  return fresh.entries;
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
