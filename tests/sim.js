#!/usr/bin/env node
// Headless simulation harness for the StatsPro retro game.
// Run with:  node tests/sim.js   (no dependencies)
//
// Loads media/engine.js, media/entities.js, media/director.js into a vm
// sandbox with a fake window/canvas/sprites, then drives engine._tick()
// directly for thousands of ticks across six scenarios, asserting
// gameplay invariants. Exits 1 with a clear message on any failure.
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const MEDIA = path.join(__dirname, "..", "media");
const FILES = ["engine.js", "entities.js", "director.js"];
// Known entity kinds (from entities.js). We interact with the engine only
// through query(), so we enumerate kinds rather than touching engine.entities.
const KINDS = ["hero", "enemy", "bullet", "enemybullet", "boom", "boss", "deathfx"];

// ── seeded PRNG (mulberry32) ─────────────────────────────────────────────
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── fake sprites: every sprite is just {width, height} ───────────────────
function frame(w, h) {
  return { width: w, height: h };
}
function makeSprites() {
  return {
    hero: { idle: [frame(25, 32), frame(23, 34)], run: [frame(25, 31), frame(23, 33)] },
    enemy: { frames: [frame(17, 23), frame(18, 23), frame(17, 22)] },
    gunner: { frames: [frame(18, 24), frame(18, 24)] },
    boss: { frames: [frame(34, 40), frame(34, 40)] },
    fx: {
      boom: [frame(11, 11), frame(13, 13), frame(15, 15)],
      death: [frame(20, 20), frame(24, 24), frame(28, 28)],
      flame: [frame(9, 12), frame(9, 12)],
      bullet: frame(9, 9),
      muzzle: frame(5, 8),
    },
  };
}

// ── fake canvas + 2d context ─────────────────────────────────────────────
function makeCanvas() {
  const noop = function () {};
  const ctx = {
    setTransform: noop,
    clearRect: noop,
    fillRect: noop,
    drawImage: noop,
    fillStyle: "",
    imageSmoothingEnabled: false,
  };
  return {
    clientWidth: 300,
    clientHeight: 100,
    width: 0,
    height: 0,
    getContext: function () {
      return ctx;
    },
  };
}

// ── sandbox world ────────────────────────────────────────────────────────
function makeWorld(seed) {
  const sandbox = {};
  sandbox.window = sandbox; // window === globalThis of the sandbox
  sandbox.console = console;
  // Do NOT let the rAF loop run — we drive engine._tick() manually.
  sandbox.requestAnimationFrame = function () {
    return 0;
  };
  vm.createContext(sandbox);
  // Deterministic randomness inside the game realm.
  sandbox.__seededRandom = mulberry32(seed);
  vm.runInContext("Math.random = __seededRandom;", sandbox, {
    filename: "seed-random.js",
  });
  for (const f of FILES) {
    const src = fs.readFileSync(path.join(MEDIA, f), "utf8");
    vm.runInContext(src, sandbox, { filename: f });
  }
  if (!sandbox.StatsProEngine || !sandbox.StatsProEntities || !sandbox.StatsProDirector) {
    console.error("FATAL: game files did not attach StatsProEngine/Entities/Director to window");
    process.exit(1);
  }
  return sandbox;
}

function makeGame(seed) {
  const sandbox = makeWorld(seed);
  const hooks = {
    banners: [],
    wins: [],
    killEvents: [],
  };
  const engine = new sandbox.StatsProEngine(
    makeCanvas(),
    makeSprites(),
    new sandbox.StatsProDirector(),
    {
      onKills: function (n) {
        hooks.killEvents.push(n);
      },
      onBanner: function (text, ms) {
        hooks.banners.push(String(text));
      },
      onWin: function (b) {
        hooks.wins.push(!!b);
      },
    }
  );
  return { engine: engine, hooks: hooks };
}

// ── assertion helpers ────────────────────────────────────────────────────
let currentScenario = "";
function fail(msg) {
  console.error("\nFAIL [" + currentScenario + "]: " + msg);
  process.exit(1);
}
function assert(cond, msg) {
  if (!cond) fail(msg);
}

// ── per-scenario metrics tracker ─────────────────────────────────────────
function makeTracker(name) {
  return {
    name: name,
    ticks: 0,
    seenEnemies: new Map(), // entity -> firstSeen tick
    enemyLifetimes: [],
    seenBullets: new Set(),
    seenEnemyBullets: new Set(),
    kindsEverSeen: new Set(),
    maxEnemies: 0,
    maxBullets: 0,
    maxEnemyBullets: 0,
    maxTotalEntities: 0,
    totalKills: 0,
    _prevKills: 0,
    everSawEnemy: false,

    // Call after every engine._tick(). Checks universal invariants and
    // accumulates metrics. Scenario-specific caps are asserted here too.
    observe: function (engine, caps) {
      this.ticks++;
      const counts = {};
      let total = 0;
      for (const kind of KINDS) {
        const list = engine.query(kind);
        counts[kind] = list.length;
        total += list.length;
        if (list.length > 0) this.kindsEverSeen.add(kind);
        for (const e of list) {
          if (typeof e.x === "number" && Number.isNaN(e.x))
            fail("entity kind=" + kind + " has NaN x at tick " + engine.tickN);
          if (typeof e.y === "number" && Number.isNaN(e.y))
            fail("entity kind=" + kind + " has NaN y at tick " + engine.tickN);
        }
      }
      if (Number.isNaN(engine.fill) || Number.isNaN(engine.target))
        fail("engine.fill/target is NaN at tick " + engine.tickN);

      // The hero must always exist exactly once.
      assert(
        counts.hero === 1,
        "hero count is " + counts.hero + " (expected exactly 1) at tick " + engine.tickN
      );

      if (counts.enemy > 0) this.everSawEnemy = true;
      this.maxEnemies = Math.max(this.maxEnemies, counts.enemy);
      this.maxBullets = Math.max(this.maxBullets, counts.bullet);
      this.maxEnemyBullets = Math.max(this.maxEnemyBullets, counts.enemybullet);
      this.maxTotalEntities = Math.max(this.maxTotalEntities, total);

      if (caps) {
        if (caps.maxBullets !== undefined)
          assert(
            counts.bullet <= caps.maxBullets,
            "bullet count " + counts.bullet + " exceeds cap " + caps.maxBullets +
              " at tick " + engine.tickN
          );
        if (caps.maxEnemies !== undefined)
          assert(
            counts.enemy <= caps.maxEnemies,
            "enemy count " + counts.enemy + " exceeds cap " + caps.maxEnemies +
              " at tick " + engine.tickN
          );
        if (caps.maxTotal !== undefined)
          assert(
            total < caps.maxTotal,
            "total entity count " + total + " reached cap " + caps.maxTotal +
              " at tick " + engine.tickN
          );
      }

      // spawn tracking + enemy lifetimes (identity-based)
      const liveEnemies = new Set(engine.query("enemy"));
      for (const e of liveEnemies) {
        if (!this.seenEnemies.has(e)) this.seenEnemies.set(e, engine.tickN);
      }
      for (const [e, born] of this.seenEnemies) {
        if (!liveEnemies.has(e)) {
          this.enemyLifetimes.push(engine.tickN - born);
          this.seenEnemies.delete(e);
        }
      }
      for (const b of engine.query("bullet")) this.seenBullets.add(b);
      for (const b of engine.query("enemybullet")) this.seenEnemyBullets.add(b);
      // prune dead bullets so the sets stay small on long soaks
      for (const b of this.seenBullets) if (b.dead) this.seenBullets.delete(b);
      for (const b of this.seenEnemyBullets) if (b.dead) this.seenEnemyBullets.delete(b);
      // total kills across stage resets (engine.kills zeroes on reset)
      if (engine.kills >= this._prevKills) {
        this.totalKills += engine.kills - this._prevKills;
      } else {
        this.totalKills += engine.kills; // counter was reset, then re-accumulated
      }
      this._prevKills = engine.kills;
    },

    // spawn totals need identity sets that survive pruning
    totalEnemySpawns: 0,
    totalHeroShots: 0,
  };
}

// Wrap observe to count spawns without keeping dead objects alive forever.
function attachSpawnCounters(tracker) {
  const inner = tracker.observe.bind(tracker);
  const knownEnemies = new WeakSet();
  const knownBullets = new WeakSet();
  tracker.observe = function (engine, caps) {
    for (const e of engine.query("enemy")) {
      if (!knownEnemies.has(e)) {
        knownEnemies.add(e);
        tracker.totalEnemySpawns++;
      }
    }
    for (const b of engine.query("bullet")) {
      if (!knownBullets.has(b)) {
        knownBullets.add(b);
        tracker.totalHeroShots++;
      }
    }
    inner(engine, caps);
  };
  return tracker;
}

// ── tick driver ──────────────────────────────────────────────────────────
const RENDER_EVERY = 50; // exercise _render with the stub ctx now and then

function runTicks(engine, tracker, n, caps, everyTick) {
  for (let i = 0; i < n; i++) {
    if (everyTick) everyTick(i);
    engine._tick();
    tracker.observe(engine, caps);
    if (engine.tickN % RENDER_EVERY === 0) {
      try {
        engine._render();
      } catch (err) {
        fail("_render crashed at tick " + engine.tickN + ": " + (err && err.stack));
      }
    }
  }
}

function avg(arr) {
  if (!arr.length) return 0;
  return arr.reduce(function (s, v) { return s + v; }, 0) / arr.length;
}

// ═════════════════════════════════════════════════════════════════════════
// Scenarios
// ═════════════════════════════════════════════════════════════════════════
const results = [];
const metrics = [];

function record(tracker, note) {
  metrics.push({
    scenario: tracker.name,
    ticks: tracker.ticks,
    spawns: tracker.totalEnemySpawns,
    kills: tracker.totalKills,
    maxEnemies: tracker.maxEnemies,
    maxBullets: tracker.maxBullets,
    maxEnemyBullets: tracker.maxEnemyBullets,
    maxEntities: tracker.maxTotalEntities,
    heroShots: tracker.totalHeroShots,
    avgEnemyLifeTicks: Math.round(avg(tracker.enemyLifetimes) * 10) / 10,
    note: note || "",
  });
}

function pass(name) {
  results.push(name);
  console.log("PASS  " + name);
}

// ── Scenario 1: busy session ─────────────────────────────────────────────
let spawns1 = 0;
(function scenario1() {
  currentScenario = "1 busy session";
  const g = makeGame(0xc0ffee);
  const t = attachSpawnCounters(makeTracker("1 busy"));
  const caps = { maxBullets: 200, maxEnemies: 20 };
  runTicks(g.engine, t, 600, caps, function (i) {
    if (i % 50 === 0) g.engine.setStats({ fillPct: 0.3, tokPerMin: 8000 });
  });
  assert(t.everSawEnemy, "no enemies ever spawned in a busy session");
  assert(t.totalKills > 0, "no kills after 600 busy ticks (kills=" + t.totalKills + ")");
  spawns1 = t.totalEnemySpawns;
  record(t);
  pass(currentScenario);
})();

// ── Scenario 2: idle session ─────────────────────────────────────────────
(function scenario2() {
  currentScenario = "2 idle session";
  const g = makeGame(0xdecaf1);
  const t = attachSpawnCounters(makeTracker("2 idle"));
  runTicks(g.engine, t, 600, { maxBullets: 200, maxEnemies: 20 }, function (i) {
    if (i % 50 === 0) g.engine.setStats({ fillPct: 0.1, tokPerMin: 0 });
  });
  assert(
    t.totalEnemySpawns < spawns1 * 0.5,
    "idle session spawned " + t.totalEnemySpawns +
      " enemies; expected far fewer than busy session's " + spawns1
  );
  record(t, "spawns vs busy: " + t.totalEnemySpawns + " / " + spawns1);
  pass(currentScenario);
})();

// ── Scenarios 3-5 share one engine: boss -> win -> stage reset ───────────
(function scenarios3to5() {
  const g = makeGame(0xb055ed);
  const engine = g.engine;
  const hooks = g.hooks;

  // Scenario 3: boss appears.
  // NOTE: the director deliberately seeds already-passed events on the very
  // first setStats (opening the panel at fill>=0.85 adds the boss silently,
  // with no "WARNING!!" — see director.js "seeded" branch). So to exercise
  // the announced-boss path we open below the threshold, then climb to 0.86.
  currentScenario = "3 boss fight";
  const t3 = attachSpawnCounters(makeTracker("3 boss"));
  engine.setStats({ fillPct: 0.5, tokPerMin: 5000 });
  runTicks(engine, t3, 20, { maxBullets: 200, maxEnemies: 25 });
  engine.setStats({ fillPct: 0.86, tokPerMin: 5000 });
  runTicks(engine, t3, 280, { maxBullets: 200, maxEnemies: 25 });
  assert(engine.query("boss").length === 1, "expected exactly one boss entity, got " +
    engine.query("boss").length);
  const warnings = hooks.banners.filter(function (b) { return b === "WARNING!!"; }).length;
  assert(warnings === 1, 'banner "WARNING!!" seen ' + warnings + " times (expected exactly 1)");
  record(t3);
  pass(currentScenario);

  // Scenario 4: win
  currentScenario = "4 win";
  const t4 = attachSpawnCounters(makeTracker("4 win"));
  engine.setStats({ fillPct: 1.0, tokPerMin: 5000 });
  runTicks(engine, t4, 200, { maxBullets: 200, maxEnemies: 25 });
  assert(engine.won === true, "engine.won is not true after fill hit 1.0");
  assert(
    hooks.wins.indexOf(true) !== -1,
    "onWin hook never called with true (calls: " + JSON.stringify(hooks.wins) + ")"
  );
  assert(
    t4.kindsEverSeen.has("deathfx"),
    "no 'deathfx' entity ever appeared during the win"
  );
  record(t4);
  pass(currentScenario);

  // Scenario 5: stage reset
  currentScenario = "5 stage reset";
  const t5 = attachSpawnCounters(makeTracker("5 reset"));
  const bannersBefore = hooks.banners.length;
  engine.setStats({ fillPct: 0.05, tokPerMin: 0 });
  // Assertions immediately after the reset, before any tick:
  assert(engine.won === false, "engine.won still true after stage reset");
  assert(engine.kills === 0, "kills not reset to 0 after stage reset (kills=" + engine.kills + ")");
  const heroes = engine.query("hero").length;
  assert(heroes === 1, "hero count after reset is " + heroes + " (expected exactly 1, not duplicated)");
  const newBanners = hooks.banners.slice(bannersBefore);
  assert(
    newBanners.indexOf("STAGE 2") !== -1,
    'banner "STAGE 2" not seen after reset (saw: ' + JSON.stringify(newBanners) + ")"
  );
  // Then keep running to make sure the new stage is stable.
  runTicks(engine, t5, 200, { maxBullets: 200, maxEnemies: 25 });
  assert(engine.won === false, "engine spuriously re-won after stage reset to fillPct 0.05");
  record(t5, "post-reset banners: " + JSON.stringify(hooks.banners.slice(bannersBefore)));
  pass(currentScenario);
})();

// ── Scenario 6: long soak, seeded random stat changes ────────────────────
(function scenario6() {
  currentScenario = "6 long soak (5000 ticks)";
  const g = makeGame(0x50a4ed);
  const t = attachSpawnCounters(makeTracker("6 soak"));
  const pick = mulberry32(1234567); // host-side PRNG, reproducible
  const presets = [
    { fillPct: 0.3, tokPerMin: 8000 },  // busy
    { fillPct: 0.1, tokPerMin: 0 },     // idle
    { fillPct: 0.86, tokPerMin: 5000 }, // boss
    { fillPct: 0.5, tokPerMin: 3000 },  // mid
    { fillPct: 1.0, tokPerMin: 6000 },  // win-level
    { fillPct: 0.05, tokPerMin: 0 },    // near-empty (forces stage resets)
  ];
  runTicks(g.engine, t, 5000, { maxTotal: 100 }, function (i) {
    if (i % 100 === 0) {
      const p = presets[Math.floor(pick() * presets.length)];
      g.engine.setStats(p);
    }
  });
  record(t);
  pass(currentScenario);
})();

// ── report ───────────────────────────────────────────────────────────────
console.log("\nAll " + results.length + " scenarios passed.\n");
console.log("Metrics:");
const header = [
  "scenario", "ticks", "spawns", "kills", "maxEnemies", "maxBullets",
  "maxEnemyBullets", "maxEntities", "heroShots", "avgEnemyLifeTicks",
];
console.log(header.join("\t"));
for (const m of metrics) {
  console.log(header.map(function (k) { return m[k]; }).join("\t") + (m.note ? "\t# " + m.note : ""));
}
process.exit(0);
