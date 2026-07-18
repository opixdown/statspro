/**
 * Auto-detect the user's Claude plan from Claude Code's own config
 * (`~/.claude.json` → `oauthAccount.organizationRateLimitTier`, e.g.
 * "default_claude_max_20x"). Re-checked lazily every 10 minutes.
 */

import * as fs from "fs";
import * as os from "os";
import * as path from "path";

export type Plan = "pro" | "max5x" | "max20x";

const CONFIG_PATH = path.join(os.homedir(), ".claude.json");
const TTL_MS = 10 * 60 * 1000;

let cached: Plan | null = null;
let checkedAt = 0;

export function detectPlan(): Plan | null {
  const now = Date.now();
  if (now - checkedAt < TTL_MS) {
    return cached;
  }
  checkedAt = now;
  cached = null;
  try {
    const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
    const acct = cfg?.oauthAccount ?? {};
    const tier: string = (
      acct.userRateLimitTier ||
      acct.organizationRateLimitTier ||
      ""
    ).toLowerCase();
    const orgType: string = (acct.organizationType || "").toLowerCase();

    if (tier.includes("20x")) {
      cached = "max20x";
    } else if (tier.includes("5x")) {
      cached = "max5x";
    } else if (tier.includes("pro") || orgType.includes("pro")) {
      cached = "pro";
    } else if (orgType.includes("max")) {
      cached = "max5x"; // max org but unknown multiplier — assume the smaller
    }
  } catch {
    /* config unreadable — stay null, caller falls back */
  }
  return cached;
}
