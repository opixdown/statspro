// @ts-nocheck
// Runtime skin builder: slices user-provided sprite sheets (enemies.png,
// bill.png, effects.png) right in the webview — no build step. The extension
// injects window.STATSPRO_ASSETS = { enemies, bill, effects } webview URIs
// when the sheets exist; sprites.js calls StatsProSkin.build(...) with them.
//
// Exposes: window.StatsProSkin
(function () {
  "use strict";

  // (sheet, box [x0,y0,x1,y1], flipHorizontal, downscale2x)
  const CUTS = {
    enemyA: ["enemies", [97, 57, 113, 85], false, false],
    enemyB: ["enemies", [114, 53, 131, 85], false, false],
    enemyC: ["enemies", [132, 53, 148, 85], false, false],
    gunnerA: ["enemies", [1, 17, 25, 49], true, false],
    gunnerB: ["enemies", [26, 18, 50, 50], true, false],
    bossA: ["enemies", [479, 17, 503, 49], false, false],
    bossB: ["enemies", [504, 17, 528, 49], false, false],
    heroA: ["bill", [480, 25, 505, 71], false, false],
    heroB: ["bill", [544, 24, 570, 72], false, false],
    heroRunA: ["bill", [675, 26, 700, 71], false, false],
    heroRunB: ["bill", [739, 25, 765, 72], false, false],
    bullet: ["effects", [153, 54, 201, 150], false, true],
    muzzle: ["effects", [165, 252, 195, 288], false, true],
    boomA: ["effects", [309, 30, 357, 126], false, true],
    boomB: ["effects", [609, 6, 705, 198], false, true],
    boomC: ["effects", [363, 6, 555, 198], false, true],
    deathA: ["effects", [219, 204, 411, 396], false, true],
    deathB: ["effects", [417, 204, 609, 396], false, true],
    deathC: ["effects", [615, 204, 807, 396], false, true],
  };

  function loadImage(uri) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("failed to load sheet: " + uri));
      img.src = uri;
    });
  }

  /** Crop a box out of a sheet, strip backgrounds, trim, flip/scale. */
  function cut(sheet, [x0, y0, x1, y1], flip, half) {
    const w = x1 - x0;
    const h = y1 - y0;
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(sheet, x0, y0, w, h, 0, 0, w, h);
    const id = ctx.getImageData(0, 0, w, h);
    const d = id.data;

    // background stripping: dark cells, light canvas, then the dominant
    // remaining color if it covers enough area (the blue/red section plates)
    const counts = new Map();
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2], a = d[i + 3];
      if (a === 0) continue;
      if ((r < 40 && g < 40 && b < 40) || (r > 195 && g > 195 && b > 195)) {
        d[i + 3] = 0;
        continue;
      }
      const key = (r << 16) | (g << 8) | b;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    let plate = -1;
    let plateN = 0;
    for (const [key, n] of counts) {
      if (n > plateN) {
        plateN = n;
        plate = key;
      }
    }
    if (plateN > w * h * 0.25) {
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] !== 0 && (((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]) === plate)) {
          d[i + 3] = 0;
        }
      }
    }

    // trim transparent margins
    let minX = w, minY = h, maxX = -1, maxY = -1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (d[(y * w + x) * 4 + 3] > 0) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) throw new Error("crop came out empty — wrong sheet variant?");
    ctx.putImageData(id, 0, 0);

    let tw = maxX - minX + 1;
    let th = maxY - minY + 1;
    let out = document.createElement("canvas");
    out.width = tw;
    out.height = th;
    const octx = out.getContext("2d");
    octx.imageSmoothingEnabled = false;
    if (flip) {
      octx.translate(tw, 0);
      octx.scale(-1, 1);
    }
    octx.drawImage(c, minX, minY, tw, th, 0, 0, tw, th);

    if (half) {
      const hw = Math.max(1, Math.floor(tw / 2));
      const hh = Math.max(1, Math.floor(th / 2));
      const small = document.createElement("canvas");
      small.width = hw;
      small.height = hh;
      const sctx = small.getContext("2d");
      sctx.imageSmoothingEnabled = false;
      sctx.drawImage(out, 0, 0, hw, hh);
      out = small;
    }
    return out;
  }

  /**
   * Build the full sprite override map from sheet URIs.
   * Returns { heroIdle, heroRun, enemy, gunner, boss, fx } (all canvases),
   * or throws if the sheets can't be read.
   */
  async function build(uris) {
    const [enemies, bill, effects] = await Promise.all([
      loadImage(uris.enemies),
      loadImage(uris.bill),
      loadImage(uris.effects),
    ]);
    const sheets = { enemies, bill, effects };
    const s = {};
    for (const [name, [sheet, box, flip, half]] of Object.entries(CUTS)) {
      s[name] = cut(sheets[sheet], box, flip, half);
    }
    return {
      heroIdle: [s.heroA, s.heroB],
      heroRun: [s.heroRunA, s.heroRunB],
      enemy: [s.enemyA, s.enemyB, s.enemyC],
      gunner: [s.gunnerA, s.gunnerB],
      boss: [s.bossA, s.bossB],
      fx: {
        bullet: s.bullet,
        muzzle: s.muzzle,
        boom: [s.boomA, s.boomB, s.boomC],
        death: [s.deathA, s.deathB, s.deathC],
      },
    };
  }

  window.StatsProSkin = { build };
})();
