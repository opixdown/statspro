// @ts-nocheck
// Webview entrypoint: wires extension messages to the engine + readouts.
(function () {
  "use strict";
  const vscode = acquireVsCodeApi();

  const pct = document.getElementById("pct");
  const kills = document.getElementById("kills");
  const banner = document.getElementById("banner");
  const win = document.getElementById("winbanner");
  const slots = [0, 1, 2].map((i) => document.getElementById("slot" + i));

  // banners queue up so a STAGE card is never clobbered by a WAVE card
  const bannerQueue = [];
  let bannerBusy = false;
  function pumpBanners() {
    if (bannerBusy || bannerQueue.length === 0) return;
    bannerBusy = true;
    const { text, ms } = bannerQueue.shift();
    banner.textContent = text;
    banner.classList.add("show");
    setTimeout(() => {
      banner.classList.remove("show");
      bannerBusy = false;
      setTimeout(pumpBanners, 250);
    }, ms);
  }

  window.StatsProSprites.load().then((sprites) => {
    const canvas = document.getElementById("game");
    const director = new window.StatsProDirector();
    const engine = new window.StatsProEngine(canvas, sprites, director, {
      onKills(n) {
        kills.textContent = "KILLS " + String(n).padStart(3, "0");
      },
      onBanner(text, ms) {
        if (bannerQueue.length < 4) bannerQueue.push({ text, ms: ms || 2000 });
        pumpBanners();
      },
      onWin(isWon) {
        win.classList.toggle("show", isWon);
      },
    });

    window.addEventListener("message", (event) => {
      const msg = event.data;
      if (!msg || msg.type !== "stats") return;

      engine.setStats(msg.stats);

      const p = Math.round(msg.stats.fillPct * 100);
      pct.textContent = p + "%";
      pct.className = "pct" + (p >= 85 ? " crit" : p >= 60 ? " warn" : "");

      if (Array.isArray(msg.slots)) {
        msg.slots.forEach((cell, i) => {
          if (!slots[i]) return;
          slots[i].textContent = cell.value;
          slots[i].title = cell.label;
        });
      }
    });

    vscode.postMessage({ type: "ready" });
  });
})();
