/**
 * Locating user-provided sprite sheets ("bring your own assets").
 *
 * The user pastes enemies.png / bill.png / effects.png into an assets folder;
 * the webview slices them at runtime — no build step, no reinstall. Searched
 * in order:
 *   1. ~/.statspro/assets            (works for every install)
 *   2. <extension>/assets            (F5 dev host)
 *   3. <first workspace>/assets      (running inside the statspro repo)
 */

import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";

export const SHEET_NAMES = ["enemies.png", "bill.png", "effects.png"] as const;
export type SheetName = (typeof SHEET_NAMES)[number];

export const HOME_ASSETS_DIR = path.join(os.homedir(), ".statspro", "assets");

const DROP_README = `StatsPro classic skin
=====================

Paste these three NES Contra sprite sheets into THIS folder (download them
yourself, e.g. from a sprite archive — search "NES Contra"):

  enemies.png   "Contra - Enemies & Bosses - Enemies & Obstacles"
  bill.png      "Contra - Bill" (the full player sheet, BILL/LANCE sections)
  effects.png   the effects sheet (bullet dots, explosion clouds, death rings)

That's it. The StatsPro widget notices them and reloads itself with the
classic look within a couple of seconds. Delete the files to go back.

These sprites are Konami's IP — personal use on your machine only. They are
never uploaded, committed, or shipped anywhere by StatsPro.
`;

/** Make sure ~/.statspro/assets exists and explains itself. */
export function ensureDropFolder(): void {
  try {
    fs.mkdirSync(HOME_ASSETS_DIR, { recursive: true });
    const readme = path.join(HOME_ASSETS_DIR, "README.txt");
    if (!fs.existsSync(readme)) {
      fs.writeFileSync(readme, DROP_README);
    }
  } catch {
    /* non-fatal */
  }
}

function candidateDirs(extensionPath: string): string[] {
  const dirs = [HOME_ASSETS_DIR, path.join(extensionPath, "assets")];
  const ws = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (ws) {
    dirs.push(path.join(ws, "assets"));
  }
  return dirs;
}

/** First directory that contains ALL three sheets, or null. */
export function findAssetsDir(extensionPath: string): string | null {
  for (const dir of candidateDirs(extensionPath)) {
    try {
      if (SHEET_NAMES.every((n) => fs.existsSync(path.join(dir, n)))) {
        return dir;
      }
    } catch {
      /* keep looking */
    }
  }
  return null;
}

/** Directories worth watching for sheet paste/delete events. */
export function watchDirs(extensionPath: string): string[] {
  return candidateDirs(extensionPath).filter((d) => {
    try {
      return fs.statSync(d).isDirectory();
    } catch {
      return false;
    }
  });
}
