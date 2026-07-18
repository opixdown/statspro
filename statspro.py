#!/usr/bin/env python3
"""
statspro — a retro token "health bar" that lives in a corner of your terminal.

Run it in its own small terminal window and tuck it into a screen corner:

    python3 statspro.py

It reads your local Claude Code usage and animates a little character riding a
glowing health bar — idle when calm, running when busy, on fire near the limit.

    ────────────────────────────
     STATSPRO                 ▓
                🏃
     ▐████████████░░░░░░░░░░░▌ 61%
              6 1 %
     opus-4.8 · 312k · 3h58m
    ────────────────────────────

Flags:
    --once     draw a single frame and exit (for testing / screenshots)
    --fps N    animation frames per second (default 12)
"""

import sys
import os
import json
import glob
import time
import signal
from datetime import datetime, timezone

# ── config ───────────────────────────────────────────────────────────────────
SLOTS = ["model", "tokens_total", "time_left_5h"]
TOKEN_BUDGET_5H = 1_000_000
WINDOW_HOURS = 5
BAR_WIDTH = 24
REFRESH_SECONDS = 2.0          # how often to re-read usage from disk
PROJECTS = os.path.expanduser("~/.claude/projects/*/*.jsonl")

# ── ansi ─────────────────────────────────────────────────────────────────────
ESC = "\033["
RESET, DIM, BOLD = ESC + "0m", ESC + "2m", ESC + "1m"
ORANGE, YELLOW, RED = ESC + "38;5;208m", ESC + "38;5;220m", ESC + "38;5;196m"
GREY, INK, DARK = ESC + "38;5;238m", ESC + "38;5;252m", ESC + "38;5;236m"
HIDE_CUR, SHOW_CUR = ESC + "?25l", ESC + "?25h"
CLEAR, HOME = ESC + "2J", ESC + "H"
CLR_EOL = ESC + "K"


# ── data ─────────────────────────────────────────────────────────────────────
def parse_ts(ts):
    try:
        return datetime.fromisoformat(ts.replace("Z", "+00:00")).timestamp()
    except Exception:
        return None


def msg_tokens(u):
    # new work only — exclude cache_read (the whole context re-read each turn)
    if not isinstance(u, dict):
        return 0
    return (u.get("input_tokens", 0) + u.get("output_tokens", 0)
            + u.get("cache_creation_input_tokens", 0))


def scan(path):
    try:
        with open(path) as f:
            for line in f:
                if '"usage"' not in line:
                    continue
                try:
                    r = json.loads(line)
                except Exception:
                    continue
                m = r.get("message") or {}
                u = m.get("usage")
                if u:
                    yield parse_ts(r.get("timestamp", "")), msg_tokens(u), m.get("model")
    except Exception:
        return


def newest_session():
    """The most recently touched transcript = the session you're in now."""
    files = glob.glob(PROJECTS)
    if not files:
        return None
    return max(files, key=lambda p: os.path.getmtime(p))


def pretty_model(name):
    if not name:
        return "claude"
    n = name.lower().replace("claude-", "").replace(" ", "-")
    p = n.split("-")
    if len(p) >= 3 and p[1].isdigit() and p[2].isdigit():
        return f"{p[0]}-{p[1]}.{p[2]}"
    return n


def gather():
    now = datetime.now(timezone.utc).timestamp()
    win_start, one_min = now - WINDOW_HOURS * 3600, now - 60

    session_total, session_model, per_min = 0, None, 0
    sess = newest_session()
    if sess:
        for ts, tok, model in scan(sess):
            session_total += tok
            if model:
                session_model = model
            if ts and ts >= one_min:
                per_min += tok

    window_total, oldest = 0, None
    for p in glob.glob(PROJECTS):
        for ts, tok, _ in scan(p):
            if ts and ts >= win_start:
                window_total += tok
                if oldest is None or ts < oldest:
                    oldest = ts

    time_left = (oldest + WINDOW_HOURS * 3600 - now) if oldest else WINDOW_HOURS * 3600
    return {
        "model": pretty_model(session_model),
        "session_total": session_total,
        "window_total": window_total,
        "per_min": per_min,
        "time_left": time_left,
        "fill": min(1.0, window_total / TOKEN_BUDGET_5H) if TOKEN_BUDGET_5H else 0,
    }


# ── formatting ───────────────────────────────────────────────────────────────
def fmt_tokens(n):
    n = int(n)
    if n >= 1_000_000:
        return f"{n/1_000_000:.1f}M"
    if n >= 1_000:
        return f"{n/1_000:.1f}k"
    return str(n)


def fmt_dur(sec):
    sec = max(0, int(sec))
    h, m = sec // 3600, (sec % 3600) // 60
    return f"{h}h{m:02d}m" if h else f"{m}m"


def slot(mode, s):
    return {
        "model": s["model"],
        "tokens_total": fmt_tokens(s["session_total"]),
        "tokens_5h": fmt_tokens(s["window_total"]),
        "time_left_5h": fmt_dur(s["time_left"]),
        "tok_per_min": f"{fmt_tokens(s['per_min'])}/m",
        "context": f"{int(s['fill']*100)}%",
    }.get(mode, "-")


# ── character ────────────────────────────────────────────────────────────────
def mood(s):
    if s["fill"] >= 0.85:
        return "burning"
    if s["per_min"] > 5000:
        return "running"
    return "idle"


# per-mood animation frames (glyph, vertical offset 0=up/1=down)
CHAR_FRAMES = {
    "idle":    [("🧍", 0), ("🧍", 1), ("🧍", 1), ("🧍", 0)],
    "running": [("🏃", 0), ("🏃", 1)],
    "burning": [("🔥", 0), ("🔥", 1)],
}
FLAME_FRAMES = ["🔥", "🔥 ", " 🔥"]


# ── rendering ────────────────────────────────────────────────────────────────
def color_for(pct):
    return ORANGE if pct < 0.6 else (YELLOW if pct < 0.85 else RED)


def render(s, frame):
    pct = s["fill"]
    col = color_for(pct)
    fill = max(0, min(BAR_WIDTH, round(pct * BAR_WIDTH)))
    edge = max(0, min(BAR_WIDTH - 1, fill - 1))
    m = mood(s)

    frames = CHAR_FRAMES[m]
    glyph, voff = frames[frame % len(frames)]
    pad = " " * (2 + edge)

    # two rows so the character can bob up/down; flames sit above when burning
    top = pad + (glyph if voff == 0 else " ")
    if m == "burning":
        top = " " * (2 + edge) + FLAME_FRAMES[frame % len(FLAME_FRAMES)]
    mid_char = pad + (glyph if voff == 1 else " ")

    bar = (f" {GREY}▐{RESET}{col}{'█'*fill}{RESET}{DARK}{'░'*(BAR_WIDTH-fill)}"
           f"{GREY}▌{RESET} {col}{BOLD}{int(pct*100)}%{RESET}")

    readouts = f"{DIM} · {RESET}".join(f"{INK}{slot(x, s)}{RESET}" for x in SLOTS)

    rule = f"{DARK}{'─'*(BAR_WIDTH+8)}{RESET}"
    title = f" {ORANGE}{BOLD}STATSPRO{RESET}"
    blink = f"{col}▓{RESET}" if (frame // 6) % 2 == 0 else " "
    title = f" {ORANGE}{BOLD}STATSPRO{RESET}" + " " * (BAR_WIDTH - 5) + blink

    return [rule, title, top, mid_char, bar, f" {readouts}", rule]


# ── loop ─────────────────────────────────────────────────────────────────────
def draw(lines):
    out = [HOME]
    for ln in lines:
        out.append(ln + CLR_EOL + "\n")
    out.append(ESC + "J")  # clear anything below
    sys.stdout.write("".join(out))
    sys.stdout.flush()


def run(fps):
    interval = 1.0 / max(1, fps)
    refresh_every = max(1, int(REFRESH_SECONDS * fps))
    stats = gather()
    frame = 0
    sys.stdout.write(HIDE_CUR + CLEAR)
    try:
        while True:
            if frame % refresh_every == 0:
                stats = gather()
            draw(render(stats, frame))
            frame += 1
            time.sleep(interval)
    finally:
        sys.stdout.write(SHOW_CUR + "\n")
        sys.stdout.flush()


def once():
    for ln in render(gather(), 0):
        sys.stdout.write(ln + "\n")


def main():
    args = sys.argv[1:]
    if "--once" in args:
        once()
        return
    fps = 12
    if "--fps" in args:
        try:
            fps = int(args[args.index("--fps") + 1])
        except Exception:
            pass
    signal.signal(signal.SIGINT, lambda *_: (_ for _ in ()).throw(KeyboardInterrupt))
    try:
        run(fps)
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
