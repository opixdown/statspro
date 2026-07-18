/** StatsPro extension entrypoint: the docked sidebar webview, on a timer. */

import * as vscode from "vscode";
import { gather, Stats, SlotMode, slotText } from "./core/stats";
import { sessionFileForWorkspace } from "./core/transcripts";
import { HealthViewProvider } from "./panel";

let provider: HealthViewProvider;
let timer: NodeJS.Timeout | undefined;

function readConfig() {
  const c = vscode.workspace.getConfiguration("statspro");
  return {
    budget5h: c.get<number>("tokenBudget5h", 1_000_000),
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

function refresh(): void {
  try {
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

export function activate(context: vscode.ExtensionContext): void {
  provider = new HealthViewProvider(context.extensionUri);

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
    { dispose: () => timer && clearInterval(timer) }
  );

  refresh();
  restartTimer();
}

export function deactivate(): void {
  if (timer) {
    clearInterval(timer);
  }
}
