/** The retro animated health bar, as a WebviewView docked in the bottom panel
 *  (right next to your Terminal tab, like the VSCode Pets cat). */

import * as fs from "fs";
import * as vscode from "vscode";
import { Stats } from "./core/stats";

export interface PanelPayload {
  stats: Stats;
  slots: { value: string; label: string }[];
}

export class HealthViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "statsproView";
  private view?: vscode.WebviewView;
  private last?: PanelPayload;

  constructor(private readonly extUri: vscode.Uri) {}

  resolveWebviewView(view: vscode.WebviewView): void {
    this.view = view;
    view.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extUri, "media")],
    };
    view.webview.html = this.html(view.webview);
    view.webview.onDidReceiveMessage((m) => {
      if (m?.type === "ready" && this.last) {
        this.update(this.last);
      }
    });
    if (this.last) {
      this.update(this.last);
    }
  }

  update(payload: PanelPayload): void {
    this.last = payload;
    this.view?.webview.postMessage({ type: "stats", ...payload });
  }

  private uri(webview: vscode.Webview, ...p: string[]): vscode.Uri {
    return webview.asWebviewUri(vscode.Uri.joinPath(this.extUri, "media", ...p));
  }

  private html(webview: vscode.Webview): string {
    const htmlPath = vscode.Uri.joinPath(this.extUri, "media", "panel.html").fsPath;
    const html = fs.readFileSync(htmlPath, "utf8");
    const nonce = String(Date.now()) + Math.floor(Math.random() * 1e6);
    return html
      .replace(/{{cssUri}}/g, this.uri(webview, "panel.css").toString())
      .replace(/{{jsUri}}/g, this.uri(webview, "panel.js").toString())
      .replace(/{{cspSource}}/g, webview.cspSource)
      .replace(/{{nonce}}/g, nonce);
  }
}
