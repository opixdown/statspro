#!/usr/bin/env python3
"""
statspro — a token "health bar" that sits at the bottom of your Claude Code
terminal. Claude Code runs this once per turn, pipes it session JSON on stdin,
and shows whatever it prints as the status line.

           🧍
    ▐██████████░░░░░░░░░░░░░░░░░░▌ 60%
    opus-4.8  ·  300k tok  ·  4h 07m left
"""

import sys
import json
import os
import glob
from datetime import datetime, timezone

# ── config ───────────────────────────────────────────────────────────────────
SLOTS = ["model", "tokens_total", "time_left_5h"]  # the 3 readouts
TOKEN_BUDGET_5H = 1_000_000   # tokens your 5h window is worth (drives fill %)
WINDOW_HOURS = 5
BAR_WIDTH = 28

# ── ansi ─────────────────────────────────────────────────────────────────────
RESET, DIM = "\033[0m", "\033[2m"
ORANGE, YELLOW, RED = "\033[38;5;208m", "\033[38;5;220m", "\033[38;5;196m"
GREY, INK = "\033[38;5;238m", "\033[38;5;252m"

PROJECTS = os.path.expanduser("~/.claude/projects/*/*.jsonl")


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
    return f"{h}h {m:02d}m" if h else f"{m}m"


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


def pretty_model(name):
    if not name:
        return "claude"
    n = name.lower().replace("claude-", "").replace(" ", "-")
    p = n.split("-")
    if len(p) >= 3 and p[1].isdigit() and p[2].isdigit():
        return f"{p[0]}-{p[1]}.{p[2]}"
    return n


def gather(data):
    now = datetime.now(timezone.utc).timestamp()
    win_start, one_min = now - WINDOW_HOURS * 3600, now - 60

    session_total, session_model, per_min = 0, None, 0
    tp = data.get("transcript_path", "")
    for ts, tok, model in scan(tp):
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
    model = (data.get("model", {}) or {}).get("display_name") or session_model
    return {
        "model": pretty_model(model),
        "session_total": session_total,
        "window_total": window_total,
        "per_min": per_min,
        "time_left": time_left,
        "fill": min(1.0, window_total / TOKEN_BUDGET_5H) if TOKEN_BUDGET_5H else 0,
    }


def character(s):
    if s["fill"] >= 0.85:
        return "🔥"
    if s["per_min"] > 5000:
        return "🏃"
    return "🧍"


def slot(mode, s):
    if mode == "model":
        return s["model"]
    if mode == "tokens_total":
        return f"{fmt_tokens(s['session_total'])} tok"
    if mode == "tokens_5h":
        return f"{fmt_tokens(s['window_total'])} tok"
    if mode == "time_left_5h":
        return f"{fmt_dur(s['time_left'])} left"
    if mode == "tok_per_min":
        return f"{fmt_tokens(s['per_min'])}/min"
    if mode == "context":
        return f"{int(s['fill']*100)}%"
    return "-"


def render(s):
    fill = max(0, min(BAR_WIDTH, round(s["fill"] * BAR_WIDTH)))
    pct = s["fill"]
    color = ORANGE if pct < 0.6 else (YELLOW if pct < 0.85 else RED)

    # character sits above the fill edge
    edge = max(0, min(BAR_WIDTH - 1, fill - 1))
    char_line = " " * (4 + edge) + character(s)

    bar = (f"    {GREY}▐{RESET}{color}{'█'*fill}{RESET}{GREY}{'░'*(BAR_WIDTH-fill)}▌{RESET}"
           f" {color}{int(pct*100)}%{RESET}")

    readouts = f"{DIM} · {RESET}".join(f"{INK}{slot(m, s)}{RESET}" for m in SLOTS)
    return f"{char_line}\n{bar}\n    {readouts}"


def main():
    try:
        raw = sys.stdin.read()
        data = json.loads(raw) if raw.strip() else {}
    except Exception:
        data = {}
    try:
        sys.stdout.write(render(gather(data)))
    except Exception as e:
        sys.stdout.write(f"{DIM}statspro: {e}{RESET}")


if __name__ == "__main__":
    main()
