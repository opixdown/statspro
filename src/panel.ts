/** The retro animated webview: big bar + character running on top. */

import * as fs from "fs";
import * as vscode from "vscode";
import { Stats } from "./core/stats";

export interface PanelPayload {
  stats: Stats;
  slots: { value: string; label: string }[];
}

export class HealthPanel {
  public static current: HealthPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private readonly extUri: vscode.Uri;
  private disposables: vscode.Disposable[] = [];
  private lastPayload: PanelPayload | undefined;

  static show(extUri: vscode.Uri): void {
    if (HealthPanel.current) {
      HealthPanel.current.panel.reveal(vscode.ViewColumn.Beside);
      return;
    }
    const panel = vscode.window.createWebviewPanel(
      "statsproPanel",
      "StatsPro",
      { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(extUri, "media")],
      }
    );
    HealthPanel.current = new HealthPanel(panel, extUri);
  }

  private constructor(panel: vscode.WebviewPanel, extUri: vscode.Uri) {
    this.panel = panel;
    this.extUri = extUri;
    this.panel.webview.html = this.html();
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    // when the webview signals it's ready, push whatever we last computed
    this.panel.webview.onDidReceiveMessage(
      (m) => {
        if (m?.type === "ready" && this.lastPayload) {
          this.update(this.lastPayload);
        }
      },
      null,
      this.disposables
    );
  }

  update(payload: PanelPayload): void {
    this.lastPayload = payload;
    this.panel.webview.postMessage({ type: "stats", ...payload });
  }

  private uri(...p: string[]): vscode.Uri {
    return this.panel.webview.asWebviewUri(
      vscode.Uri.joinPath(this.extUri, "media", ...p)
    );
  }

  private html(): string {
    const htmlPath = vscode.Uri.joinPath(this.extUri, "media", "panel.html").fsPath;
    let html = fs.readFileSync(htmlPath, "utf8");
    const nonce = String(Date.now()) + Math.floor(Math.random() * 1e6);
    return html
      .replace(/{{cssUri}}/g, this.uri("panel.css").toString())
      .replace(/{{jsUri}}/g, this.uri("panel.js").toString())
      .replace(/{{cspSource}}/g, this.panel.webview.cspSource)
      .replace(/{{nonce}}/g, nonce);
  }

  dispose(): void {
    HealthPanel.current = undefined;
    this.panel.dispose();
    while (this.disposables.length) {
      this.disposables.pop()?.dispose();
    }
  }
}
