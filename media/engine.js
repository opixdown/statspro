// @ts-nocheck
// Engine core: canvas management, fixed-step game loop, entity lifecycle,
// and the health-bar rendering. Gameplay lives in entities.js; pacing and
// events live in director.js.
//
// Exposes: window.StatsProEngine
(function () {
  "use strict";

  const TICK_MS = 70;  // ~14 fps logic — smooth but still chunky-retro
  const SCALE = 2;     // css px per game pixel (GP)
  const BAR_H = 12;
  const PAD_X = 4;

  const COLORS = {
    fill: "#ff8c1a",
    fillWarn: "#ffd23f",
    fillCrit: "#ff4040",
    frame: "rgba(128, 136, 150, 0.9)",
    track: "rgba(128, 136, 150, 0.16)",
  };

  class Engine {
    /**
     * @param canvas   the game canvas
     * @param sprites  SpriteSet from sprites.js
     * @param director pacing brain from director.js
     * @param hooks    { onKills(n), onBanner(text, ms|null), onWin(bool) }
     */
    constructor(canvas, sprites, director, hooks) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      this.sprites = sprites;
      this.director = director;
      this.hooks = hooks || {};

      this.entities = [];
      this.fill = 0;      // rendered fill, eases toward target
      this.target = 0;    // real fill from stats
      this.mood = "idle"; // idle | running | burning
      this.tickN = 0;
      this.kills = 0;
      this.won = false;

      this._live = false;
      this._acc = 0;
      this._last = 0;
      director.attach(this);
      requestAnimationFrame((t) => this._loop(t));
    }

    /** Fresh stats from the extension — the director interprets them. */
    setStats(stats) {
      if (!this._live) {
        this._live = true;
        this.fill = Math.max(0, Math.min(1, stats.fillPct)); // snap on open
      }
      this.director.setStats(stats);
    }

    // ── entities ──────────────────────────────────────────────────────
    add(entity) {
      this.entities.push(entity);
      return entity;
    }
    query(kind) {
      return this.entities.filter((e) => e.kind === kind && !e.dead);
    }
    /** Clear the battlefield (new stage); the director re-adds the hero. */
    reset() {
      this.entities = [];
      this.kills = 0;
      this.won = false;
      this.fill = this.target; // don't let the old bar ease down and re-trip events
      this._emitKills();
      if (this.hooks.onWin) this.hooks.onWin(false);
    }

    scoreKill() {
      this.kills++;
      this._emitKills();
    }
    _emitKills() {
      if (this.hooks.onKills) this.hooks.onKills(this.kills);
    }

    win() {
      if (this.won) return;
      this.won = true;
      if (this.hooks.onWin) this.hooks.onWin(true);
    }

    banner(text, ms) {
      if (this.hooks.onBanner) this.hooks.onBanner(text, ms);
    }

    // ── geometry ──────────────────────────────────────────────────────
    size() {
      const w = Math.floor(this.canvas.clientWidth / SCALE);
      const h = Math.floor(this.canvas.clientHeight / SCALE);
      return { w, h, barW: w - PAD_X * 2, barTop: h - BAR_H };
    }

    /** Draw a sprite with its feet on `bottom`, centered on x, scaled. */
    stand(ctx, img, x, bottom, scale) {
      const dw = Math.round(img.width * scale);
      const dh = Math.round(img.height * scale);
      ctx.drawImage(img, Math.round(x - dw / 2), Math.round(bottom - dh + 1), dw, dh);
      return dh;
    }

    /** Draw a sprite centered at (cx, cy), targetH game-px tall. */
    blit(ctx, img, cx, cy, targetH) {
      const s = targetH / img.height;
      const dw = Math.round(img.width * s);
      const dh = Math.round(img.height * s);
      ctx.drawImage(img, Math.round(cx - dw / 2), Math.round(cy - dh / 2), dw, dh);
    }

    // ── loop ──────────────────────────────────────────────────────────
    _loop(ts) {
      this._acc += ts - (this._last || ts);
      this._last = ts;
      // if the tab was hidden for minutes, drop the backlog instead of
      // fast-forwarding thousands of ticks in one frame
      this._acc = Math.min(this._acc, TICK_MS * 5);
      while (this._acc >= TICK_MS) {
        this._acc -= TICK_MS;
        this._tick();
      }
      this._render();
      requestAnimationFrame((t) => this._loop(t));
    }

    _tick() {
      this.tickN++;
      const d = this.target - this.fill;
      this.fill += Math.abs(d) < 0.002 ? d : d * 0.2;

      this.director.update(this);
      for (const e of this.entities) {
        if (!e.dead) e.update(this);
      }
      this.entities = this.entities.filter((e) => !e.dead);
    }

    _render() {
      const dpr = window.devicePixelRatio || 1;
      const cw = this.canvas.clientWidth * dpr;
      const chh = this.canvas.clientHeight * dpr;
      if (this.canvas.width !== cw || this.canvas.height !== chh) {
        this.canvas.width = cw;
        this.canvas.height = chh;
      }
      const ctx = this.ctx;
      // clear the FULL backing store first (a GP-rounded clear leaves slivers)
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.setTransform(SCALE * dpr, 0, 0, SCALE * dpr, 0, 0);
      ctx.imageSmoothingEnabled = false;
      const { w, h, barW, barTop } = this.size();

      this._renderBackdrop(ctx, w, barTop);
      this._renderBar(ctx, barW, barTop);
      const sorted = [...this.entities].sort((a, b) => (a.z || 0) - (b.z || 0));
      for (const e of sorted) {
        if (!e.dead) e.render(ctx, this);
      }
    }

    /** Two layers of drifting dust for parallax depth — cheap, subtle. */
    _renderBackdrop(ctx, w, barTop) {
      ctx.fillStyle = "rgba(128, 136, 150, 0.14)";
      for (let i = 0; i < 14; i++) {
        const x = (i * 97 + 31 - this.tickN * 0.4) % w;
        const y = (i * 53) % Math.max(1, barTop - 8);
        ctx.fillRect(Math.round(x < 0 ? x + w : x), y, 1, 1);
      }
      ctx.fillStyle = "rgba(128, 136, 150, 0.24)";
      for (let i = 0; i < 8; i++) {
        const x = (i * 131 + 67 - this.tickN * 0.9) % w;
        const y = (i * 71 + 13) % Math.max(1, barTop - 6);
        ctx.fillRect(Math.round(x < 0 ? x + w : x), y, 1, 1);
      }
    }

    _renderBar(ctx, barW, barTop) {
      const fillCol =
        this.fill >= 0.85 ? COLORS.fillCrit :
        this.fill >= 0.6 ? COLORS.fillWarn : COLORS.fill;
      ctx.fillStyle = COLORS.frame;
      ctx.fillRect(PAD_X - 2, barTop, barW + 4, BAR_H);
      ctx.fillStyle = "rgba(20,20,20,0.85)";
      ctx.fillRect(PAD_X, barTop + 2, barW, BAR_H - 4);
      ctx.fillStyle = COLORS.track;
      ctx.fillRect(PAD_X, barTop + 2, barW, BAR_H - 4);
      ctx.fillStyle = fillCol;
      const fw = Math.round(this.fill * barW);
      for (let x = 0; x < fw; x += 5) {
        ctx.fillRect(PAD_X + x, barTop + 2, Math.min(4, fw - x), BAR_H - 4);
      }
    }
  }

  window.StatsProEngine = Engine;
})();
