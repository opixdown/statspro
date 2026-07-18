/** The retro animated health bar, as a WebviewView docked in the bottom panel
 *  (right next to your Terminal tab, like the VSCode Pets cat). */

import * as crypto from "crypto";
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

  /** Called when the view becomes visible again (extension refreshes then). */
  public onBecameVisible?: () => void;

  constructor(private readonly extUri: vscode.Uri) {}

  /** Whether the widget is actually on screen — no point computing otherwise. */
  get visible(): boolean {
    return this.view?.visible ?? false;
  }

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
    view.onDidChangeVisibility(() => {
      if (view.visible && this.onBecameVisible) {
        this.onBecameVisible();
      }
    });
    if (this.last) {
      this.update(this.last);
    }
    // first resolve counts as becoming visible
    if (this.onBecameVisible) {
      this.onBecameVisible();
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
    const nonce = crypto.randomBytes(16).toString("base64");

    // Optional personal sprite skin (gitignored): inject only if present.
    const localPath = vscode.Uri.joinPath(this.extUri, "media", "sprites.local.js").fsPath;
    const localTag = fs.existsSync(localPath)
      ? `<script nonce="{{nonce}}" src="${this.uri(webview, "sprites.local.js")}"></script>`
      : "";

    return html
      .replace(/{{localSprites}}/g, localTag)
      .replace(/{{cssUri}}/g, this.uri(webview, "panel.css").toString())
      .replace(/{{spritesUri}}/g, this.uri(webview, "sprites.js").toString())
      .replace(/{{engineUri}}/g, this.uri(webview, "engine.js").toString())
      .replace(/{{entitiesUri}}/g, this.uri(webview, "entities.js").toString())
      .replace(/{{directorUri}}/g, this.uri(webview, "director.js").toString())
      .replace(/{{mainUri}}/g, this.uri(webview, "main.js").toString())
      .replace(/{{cspSource}}/g, webview.cspSource)
      .replace(/{{nonce}}/g, nonce);
  }
}
