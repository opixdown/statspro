/** The retro game webview, docked in the Source Control sidebar. */

import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { findAssetsDir, SHEET_NAMES } from "./assets";
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
    this.applyHtml(view);
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
    if (this.onBecameVisible) {
      this.onBecameVisible(); // first resolve counts as becoming visible
    }
  }

  /** Re-render the webview from scratch (e.g. sheets appeared in assets/). */
  rebuild(): void {
    if (this.view) {
      this.applyHtml(this.view);
    }
  }

  update(payload: PanelPayload): void {
    this.last = payload;
    this.view?.webview.postMessage({ type: "stats", ...payload });
  }

  private applyHtml(view: vscode.WebviewView): void {
    const assetsDir = findAssetsDir(this.extUri.fsPath);
    const roots = [vscode.Uri.joinPath(this.extUri, "media")];
    if (assetsDir) {
      roots.push(vscode.Uri.file(assetsDir));
    }
    view.webview.options = {
      enableScripts: true,
      localResourceRoots: roots,
    };
    view.webview.html = this.html(view.webview, assetsDir);
  }

  private uri(webview: vscode.Webview, ...p: string[]): vscode.Uri {
    return webview.asWebviewUri(vscode.Uri.joinPath(this.extUri, "media", ...p));
  }

  private html(webview: vscode.Webview, assetsDir: string | null): string {
    const htmlPath = vscode.Uri.joinPath(this.extUri, "media", "panel.html").fsPath;
    const html = fs.readFileSync(htmlPath, "utf8");
    const nonce = crypto.randomBytes(16).toString("base64");

    // user-provided sheets: hand the webview their URIs for runtime slicing
    let assetsBoot = "";
    if (assetsDir) {
      const [enemies, bill, effects] = SHEET_NAMES.map((n) =>
        webview.asWebviewUri(vscode.Uri.file(path.join(assetsDir, n))).toString()
      );
      const json = JSON.stringify({ enemies, bill, effects });
      assetsBoot = `<script nonce="{{nonce}}">window.STATSPRO_ASSETS = ${json};</script>`;
    }

    // pre-generated personal skin file (optional, gitignored)
    const localPath = vscode.Uri.joinPath(this.extUri, "media", "sprites.local.js").fsPath;
    const localTag = fs.existsSync(localPath)
      ? `<script nonce="{{nonce}}" src="${this.uri(webview, "sprites.local.js")}"></script>`
      : "";

    return html
      .replace(/{{assetsBoot}}/g, assetsBoot)
      .replace(/{{localSprites}}/g, localTag)
      .replace(/{{cssUri}}/g, this.uri(webview, "panel.css").toString())
      .replace(/{{skinUri}}/g, this.uri(webview, "skin.js").toString())
      .replace(/{{spritesUri}}/g, this.uri(webview, "sprites.js").toString())
      .replace(/{{engineUri}}/g, this.uri(webview, "engine.js").toString())
      .replace(/{{entitiesUri}}/g, this.uri(webview, "entities.js").toString())
      .replace(/{{directorUri}}/g, this.uri(webview, "director.js").toString())
      .replace(/{{mainUri}}/g, this.uri(webview, "main.js").toString())
      .replace(/{{cspSource}}/g, webview.cspSource)
      .replace(/{{nonce}}/g, nonce);
  }
}
