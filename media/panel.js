// @ts-nocheck
// StatsPro webview — receives stats from the extension and drives the retro HUD.
(function () {
  const vscode = acquireVsCodeApi();

  const els = {
    fill: document.getElementById("fill"),
    pct: document.getElementById("pct"),
    character: document.getElementById("character"),
    slots: [
      { val: document.getElementById("slot0-val"), lab: document.getElementById("slot0-lab") },
      { val: document.getElementById("slot1-val"), lab: document.getElementById("slot1-lab") },
      { val: document.getElementById("slot2-val"), lab: document.getElementById("slot2-lab") },
    ],
  };

  // pick the character's mood the same way the status bar does
  function moodFor(stats) {
    if (stats.fillPct >= 0.85) return "burning";
    if (stats.tokPerMin > 5000) return "running";
    return "idle";
  }

  function apply(stats, slots) {
    const pct = Math.max(0, Math.min(100, Math.round(stats.fillPct * 100)));

    // bar fill + color tier
    els.fill.style.width = pct + "%";
    els.fill.classList.toggle("warn", stats.fillPct >= 0.6 && stats.fillPct < 0.85);
    els.fill.classList.toggle("crit", stats.fillPct >= 0.85);
    els.pct.textContent = pct + "%";

    // character rides the fill edge, mood by workload
    els.character.style.left = pct + "%";
    els.character.dataset.state = moodFor(stats);

    // three readouts
    if (Array.isArray(slots)) {
      slots.forEach((cell, i) => {
        if (!els.slots[i]) return;
        els.slots[i].val.textContent = cell.value;
        els.slots[i].lab.textContent = cell.label;
      });
    }
  }

  window.addEventListener("message", (event) => {
    const msg = event.data;
    if (msg && msg.type === "stats") {
      apply(msg.stats, msg.slots);
    }
  });

  // tell the extension we're mounted so it pushes the latest snapshot
  vscode.postMessage({ type: "ready" });
})();
