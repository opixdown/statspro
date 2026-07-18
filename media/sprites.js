// @ts-nocheck
// Sprite assets for the StatsPro game.
//
// Default art is original pixel work (ship-safe). If media/sprites.local.js
// exists (gitignored, personal machines only), it defines
// window.STATSPRO_LOCAL_SPRITES with image data-URIs that skin the enemies
// and boss; the hero is always the original commando.
//
// Exposes: window.StatsProSprites.load() -> Promise<SpriteSet>
//   SpriteSet = {
//     hero:  { idle: [c], run: [c], burn: [c] },  // c = offscreen canvas
//     enemy: { frames: [c] },
//     boss:  { frames: [c] },
//     fx:    { boom: [c], flame: [c] },
//   }
(function () {
  "use strict";

  // ── palette (NES-ish, ~7 colors + fx) ──────────────────────────────
  const PALETTE = {
    K: "#101010", // outline / boots
    S: "#f0a06a", // skin
    R: "#e03018", // bandana red
    N: "#2c4a8c", // navy shirt
    O: "#6e7a30", // olive pants
    G: "#8c94a0", // gun metal
    W: "#ffffff", // eye / muzzle
    F: "#ff9018", // flame orange
    Y: "#ffe040", // flame yellow
    P: "#8c2020", // fallback-enemy shirt (dark red)
    D: "#3c3428", // fallback-boss hide
    T: "#c8b090", // fallback-boss teeth/claws
  };

  // ── the commando (16x18 frames, drawn row-strings) ─────────────────
  const HERO_IDLE_A = [
    "................",
    "......KKKK......",
    "...RRKRRRRK.....",
    "....RKRRRRK.....",
    ".....KSSSSK.....",
    ".....KSWSSK.....",
    ".....KSSSSK.....",
    "....KNNNNNNK....",
    "....KNNNNNNK....",
    "....KNNNSSGGGGGW",
    "....KNNNNNNK....",
    "....KKKKKKKK....",
    ".....KOOOOK.....",
    ".....KOOOOK.....",
    ".....KOK.KOK....",
    ".....KOK.KOK....",
    "....KKK..KKK....",
    "................",
  ];
  const HERO_IDLE_B = HERO_IDLE_A.map((r, i) =>
    i === 2 ? "....RKRRRRK....." : i === 3 ? "...RRKRRRRK....." : r
  );
  const HERO_RUN_A = [
    "................",
    ".......KKKK.....",
    "....RRKRRRRK....",
    ".....RKRRRRK....",
    "......KSSSSK....",
    "......KSWSSK....",
    "......KSSSSK....",
    ".....KNNNNNNK...",
    ".....KNNNNNNK...",
    ".....KNNSSGGGGGW",
    ".....KNNNNNNK...",
    ".....KKKKKKK....",
    "......KOOOOK....",
    ".....KOOKKOOK...",
    "....KOOK..KOOK..",
    "...KOK......KOK.",
    "...KKK......KKK.",
    "................",
  ];
  const HERO_RUN_B = [
    "................",
    ".......KKKK.....",
    "....RRKRRRRK....",
    ".....RKRRRRK....",
    "......KSSSSK....",
    "......KSWSSK....",
    "......KSSSSK....",
    ".....KNNNNNNK...",
    ".....KNNNNNNK...",
    ".....KNNSSGGGGGW",
    ".....KNNNNNNK...",
    ".....KKKKKKK....",
    "......KOOOK.....",
    "......KOOOK.....",
    "......KOK.......",
    "......KOK.......",
    ".....KKKK.......",
    "................",
  ];
  const HERO_RUN_C = [
    "................",
    ".......KKKK.....",
    "....RRKRRRRK....",
    ".....RKRRRRK....",
    "......KSSSSK....",
    "......KSWSSK....",
    "......KSSSSK....",
    ".....KNNNNNNK...",
    ".....KNNNNNNK...",
    ".....KNNSSGGGGGW",
    ".....KNNNNNNK...",
    ".....KKKKKKK....",
    "......KOOOOK....",
    "....KOOKKOOK....",
    "...KOOK...KOOK..",
    "..KOK.......KOK.",
    "..KKK.......KKKK",
    "................",
  ];

  // ── fx: explosion + flame (small starbursts) ───────────────────────
  const BOOM_A = [
    "...Y....",
    ".F.Y.F..",
    "..FYF...",
    "YYFWFYY.",
    "..FYF...",
    ".F.Y.F..",
    "...Y....",
  ];
  const BOOM_B = [
    "F..Y..F.",
    "........",
    "..FWF...",
    "Y.WWW.Y.",
    "..FWF...",
    "........",
    "F..Y..F.",
  ];
  const FLAME_A = [
    "..F.Y...",
    ".FYFYF..",
    "..FYF...",
  ];
  const FLAME_B = [
    "...Y....",
    "..YFY...",
    ".FYFYF..",
  ];

  // ── fallback enemy: mirrored, recolored commando (faces left) ──────
  function mirror(grid) {
    return grid.map((row) => row.split("").reverse().join(""));
  }
  function recolor(grid, map) {
    return grid.map((row) => row.replace(/./g, (ch) => map[ch] || ch));
  }
  const ENEMY_MAP = { N: "P", R: "O" }; // red shirt, olive cap
  const FALLBACK_ENEMY = [
    mirror(recolor(HERO_RUN_A, ENEMY_MAP)),
    mirror(recolor(HERO_RUN_B, ENEMY_MAP)),
    mirror(recolor(HERO_RUN_C, ENEMY_MAP)),
  ];

  // ── fallback boss: original hunched alien (18x24, 2 frames) ────────
  const BOSS_A = [
    "..................",
    "....KKKKKK........",
    "..KKDDDDDDKK......",
    ".KDDDDDDDDDDK.....",
    ".KDDWKDDDDDDK.....",
    ".KDDDDDDDDDDDK....",
    "..KDDTKTKTDDDK....",
    "..KDTTTTTTTDDK....",
    "...KKDDDDDDDDK....",
    "....KDDDDDDDKK....",
    "...KDDDDDDDK......",
    "..KDDDKKDDDDK.....",
    ".KDDDK..KDDDDK....",
    ".KDDK....KDDDK....",
    ".KDK......KDDK....",
    ".KDK......KDDK....",
    "KTTK......KTTK....",
    "..................",
  ];
  const BOSS_B = BOSS_A.map((r, i) => (i >= 12 && i <= 16 ? BOSS_A[i === 16 ? 12 : i + 1] : r));

  // ── grid -> offscreen canvas ───────────────────────────────────────
  function decode(grid) {
    const h = grid.length;
    const w = grid[0].length;
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d");
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const ch = grid[y][x];
        if (ch === ".") continue;
        ctx.fillStyle = PALETTE[ch] || "#f0f";
        ctx.fillRect(x, y, 1, 1);
      }
    }
    return c;
  }

  // data-URI -> offscreen canvas (for the optional local skin)
  function decodeUri(entry) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement("canvas");
        c.width = entry.w;
        c.height = entry.h;
        c.getContext("2d").drawImage(img, 0, 0);
        resolve(c);
      };
      img.onerror = reject;
      img.src = entry.uri;
    });
  }

  async function load() {
    const set = {
      hero: {
        idle: [HERO_IDLE_A, HERO_IDLE_B].map(decode),
        run: [HERO_RUN_A, HERO_RUN_B, HERO_RUN_C].map(decode),
      },
      enemy: { frames: FALLBACK_ENEMY.map(decode) },
      gunner: { frames: FALLBACK_ENEMY.map(decode) }, // skinnable second type
      boss: { frames: [BOSS_A, BOSS_B].map(decode) },
      fx: {
        boom: [BOOM_A, BOOM_B].map(decode),
        flame: [FLAME_A, FLAME_B].map(decode),
      },
    };

    // 1st priority: sheets the user pasted into the assets folder — sliced
    // live in the webview (see skin.js). Nothing to build or install.
    if (window.STATSPRO_ASSETS && window.StatsProSkin) {
      try {
        const skin = await window.StatsProSkin.build(window.STATSPRO_ASSETS);
        set.hero.idle = skin.heroIdle;
        set.hero.run = skin.heroRun;
        set.enemy.frames = skin.enemy;
        set.gunner.frames = skin.gunner;
        set.boss.frames = skin.boss;
        set.fx.bullet = skin.fx.bullet;
        set.fx.muzzle = skin.fx.muzzle;
        set.fx.boom = skin.fx.boom;
        set.fx.death = skin.fx.death;
        return set;
      } catch (e) {
        console.warn("statspro: runtime skin failed, falling back", e);
      }
    }

    // 2nd: a pre-generated personal skin file (never in the public repo) —
    // any group it defines overrides the built-in art.
    const local = window.STATSPRO_LOCAL_SPRITES;
    if (local) {
      const grab = async (keys) => {
        if (!keys.every((k) => local[k])) return null;
        return Promise.all(keys.map((k) => decodeUri(local[k])));
      };
      try {
        const hero = await grab(["heroA", "heroB"]);
        if (hero) {
          set.hero.idle = hero;
          set.hero.run = hero;
        }
        const heroRun = await grab(["heroRunA", "heroRunB"]);
        if (heroRun) set.hero.run = heroRun;
        const enemy = await grab(["enemyA", "enemyB", "enemyC"]);
        if (enemy) set.enemy.frames = enemy;
        const gunner = await grab(["gunnerA", "gunnerB"]);
        if (gunner) set.gunner.frames = gunner;
        const boss = await grab(["bossA", "bossB"]);
        if (boss) set.boss.frames = boss;
        const boom = await grab(["boomA", "boomB", "boomC"]);
        if (boom) set.fx.boom = boom;
        const death = await grab(["deathA", "deathB", "deathC"]);
        if (death) set.fx.death = death;
        const shot = await grab(["bullet", "muzzle"]);
        if (shot) {
          set.fx.bullet = shot[0];
          set.fx.muzzle = shot[1];
        }
      } catch (e) {
        console.warn("statspro: local sprite skin failed, using built-in art", e);
      }
    }
    return set;
  }

  window.StatsProSprites = { load };
})();
