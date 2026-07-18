/** StatsPro extension entrypoint: the docked sidebar webview, on a timer. */

import * as fs from "fs";
import * as vscode from "vscode";
import { ensureDropFolder, watchDirs } from "./assets";
import { detectPlan } from "./core/plan";
import { gather, Stats, SlotMode, slotText } from "./core/stats";
import { sessionFileForWorkspace } from "./core/transcripts";
import { HealthViewProvider } from "./panel";

let provider: HealthViewProvider;
let timer: NodeJS.Timeout | undefined;
let watchers: fs.FSWatcher[] = [];

/** Rough 5h-window token budgets per plan; `custom` uses tokenBudget5h. */
const PLAN_BUDGETS: Record<string, number> = {
  pro: 1_000_000,
  max5x: 5_000_000,
  max20x: 10_000_000,
};

function readConfig() {
  const c = vscode.workspace.getConfiguration("statspro");
  let plan = c.get<string>("plan", "auto");
  if (plan === "auto") {
    plan = detectPlan() ?? "pro"; // read from Claude Code's own config
  }
  return {
    budget5h: PLAN_BUDGETS[plan] ?? c.get<number>("tokenBudget5h", 2_000_000),
    windowHours: c.get<number>("windowHours", 5),
    refreshSeconds: Math.max(1, c.get<number>("refreshSeconds", 5)),
    slots: c.get<string[]>("slots", ["model", "tokens_total", "time_left_5h"]) as SlotMode[],
  };
}

function computeStats(): Stats {
  const cfg = readConfig();
  const wsPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  const transcriptPath = wsPath ? sessionFileForWorkspace(wsPath) : null;
  return gather({
    transcriptPath,
    modelHint: null,
    budget5h: cfg.budget5h,
    windowHours: cfg.windowHours,
  });
}

function refresh(force = false): void {
  try {
    if (!force && !provider.visible) {
      return; // widget hidden — skip the transcript scan entirely
    }
    const cfg = readConfig();
    const stats = computeStats();
    provider.update({ stats, slots: cfg.slots.map((m) => slotText(m, stats)) });
  } catch (e) {
    console.error("StatsPro refresh failed:", e);
  }
}

function restartTimer(): void {
  if (timer) {
    clearInterval(timer);
  }
  timer = setInterval(refresh, readConfig().refreshSeconds * 1000);
}

/** When sheets are pasted into (or removed from) an assets folder, the widget
 *  rebuilds itself — the "paste the PNGs and it just works" path. */
function watchAssetFolders(extensionPath: string): void {
  for (const w of watchers) {
    w.close();
  }
  watchers = [];
  let debounce: NodeJS.Timeout | undefined;
  for (const dir of watchDirs(extensionPath)) {
    try {
      const w = fs.watch(dir, (_event, filename) => {
        if (filename && !String(filename).endsWith(".png")) {
          return;
        }
        if (debounce) {
          clearTimeout(debounce);
        }
        debounce = setTimeout(() => {
          provider.rebuild();
          refresh(true);
        }, 600);
      });
      watchers.push(w);
    } catch {
      /* directory may vanish; fine */
    }
  }
}

export function activate(context: vscode.ExtensionContext): void {
  ensureDropFolder(); // ~/.statspro/assets with a README.txt inside
  provider = new HealthViewProvider(context.extensionUri);
  provider.onBecameVisible = () => refresh(true);
  watchAssetFolders(context.extensionUri.fsPath);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(HealthViewProvider.viewType, provider, {
      webviewOptions: { retainContextWhenHidden: true },
    }),
    vscode.commands.registerCommand("statspro.openPanel", () => {
      vscode.commands.executeCommand("statsproView.focus");
    }),
    vscode.commands.registerCommand("statspro.refresh", refresh),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("statspro")) {
        refresh();
        restartTimer();
      }
    }),
    { dispose: () => timer && clearInterval(timer) },
    { dispose: () => watchers.forEach((w) => w.close()) }
  );

  refresh();
  restartTimer();
}

export function deactivate(): void {
  if (timer) {
    clearInterval(timer);
  }
}
