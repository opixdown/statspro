// @ts-nocheck
// The Director: turns your real Claude usage into game pacing.
//
// It runs a combat rhythm with breathing room, the way real games do:
//
//   PATROL  — quiet; a lone walker now and then
//   ASSAULT — a squad charges in (size scales with intensity)
//   LULL    — a beat of calm after the squad resolves
//
// `intensity` (0..1) is an exponentially-smoothed read of tokens/min, so one
// burst of work doesn't whiplash the game — sustained work heats it up,
// silence cools it down. The boss fight and stage flow sit on top.
//
// Exposes: window.StatsProDirector
(function () {
  "use strict";

  const E = () => window.StatsProEntities;

  const BOSS_AT = 0.85;
  const WIN_AT = 0.995;
  const TPM_HOT = 6000;        // tokens/min that count as "full throttle"
  const EMA = 0.35;            // how fast intensity follows the burn rate
  const WAVES = [
    { at: 0.25, text: "WAVE 2" },
    { at: 0.5, text: "WAVE 3" },
    { at: 0.75, text: "FINAL WAVE" },
  ];

  const lerp = (a, b, t) => a + (b - a) * t;
  const jitter = (n) => Math.floor(n * (0.75 + Math.random() * 0.5));

  class Director {
    constructor() {
      this.BOSS_AT = BOSS_AT;
      this.intensity = 0;
      this.stage = 1;
      this.phase = "patrol";
      this.phaseIn = 30;        // ticks until the next phase decision
      this.squadLeft = 0;       // enemies still to trickle out this assault
      this.squadGapIn = 0;
      this.wavesFired = new Set();
      this.bossAnnounced = false;
      this.eng = null;
    }

    attach(eng) {
      this.eng = eng;
      eng.add(E().Hero());
    }

    /** Interpret fresh stats: fill target, smoothed intensity, stage resets. */
    setStats(stats) {
      const eng = this.eng;
      const prev = eng.target;
      eng.target = Math.max(0, Math.min(1, stats.fillPct));

      const heat = Math.min(1, (stats.tokPerMin || 0) / TPM_HOT);
      this.intensity = this.intensity * (1 - EMA) + heat * EMA;

      eng.mood =
        eng.target >= BOSS_AT ? "burning" :
        this.intensity > 0.4 ? "running" : "idle";

      // opening the panel mid-window: mark already-passed events as done so
      // three waves + a boss don't all detonate on tick one
      if (!this.seeded) {
        this.seeded = true;
        for (const wv of WAVES) {
          if (eng.target >= wv.at) this.wavesFired.add(wv.at);
        }
        if (eng.target >= BOSS_AT) {
          this.bossAnnounced = true;
          eng.add(E().Boss());
        }
      }

      // stage over: the window reset (big drop), or we won and it drained down
      const windowReset = prev - eng.target > 0.1;
      const wonAndDrained = eng.won && eng.target < BOSS_AT;
      if (windowReset || wonAndDrained) this._newStage();
    }

    _newStage() {
      const eng = this.eng;
      eng.reset();
      this.wavesFired.clear();
      for (const wv of WAVES) {
        if (eng.target >= wv.at) this.wavesFired.add(wv.at); // no re-detonation
      }
      this.bossAnnounced = false;
      this.phase = "patrol";
      this.phaseIn = 30;
      this.squadLeft = 0;
      this.stage++;
      eng.add(E().Hero());
      eng.banner("STAGE " + this.stage, 2500);
    }

    /** Called every tick — the heartbeat of the fight. */
    update(eng) {
      this._waves(eng);
      this._rhythm(eng);
      this._bossFight(eng);
    }

    // ── combat rhythm ─────────────────────────────────────────────────
    _rhythm(eng) {
      if (eng.won) return;
      const t = this.intensity;

      switch (this.phase) {
        case "patrol":
          // rare lone walkers while quiet
          if (--this.phaseIn <= 0) {
            this.phase = "assault";
            this.squadLeft = 1 + Math.round(t * 3) + (Math.random() < t ? 1 : 0);
            this.squadGapIn = 0;
          } else if (this.phaseIn % jitter(Math.round(lerp(90, 35, t))) === 0) {
            this._spawnOne(eng);
          }
          break;

        case "assault":
          // trickle the squad out with spacing so they arrive as a unit
          if (this.squadLeft > 0) {
            if (--this.squadGapIn <= 0 && this._spawnOne(eng)) {
              this.squadLeft--;
              this.squadGapIn = jitter(14);
            }
          } else if (eng.query("enemy").length === 0) {
            this.phase = "lull";
            this.phaseIn = jitter(Math.round(lerp(70, 18, t)));
          }
          break;

        case "lull":
          if (--this.phaseIn <= 0) {
            this.phase = "patrol";
            this.phaseIn = jitter(Math.round(lerp(120, 30, t)));
          }
          break;
      }
    }

    _spawnOne(eng) {
      const cap = 2 + Math.round(this.intensity * 4);
      const alive = eng.query("enemy");
      if (alive.length >= cap) return false;
      const { w } = eng.size();
      // never spawn on top of the last arrival still near the edge
      const rightmost = alive.reduce((m, e) => Math.max(m, e.x), -Infinity);
      const x = Math.max(w + 6, rightmost + 14);
      eng.add(E().Enemy(E().pickType(Math.random()), x));
      return true;
    }

    // ── stage events ──────────────────────────────────────────────────
    _waves(eng) {
      for (const wv of WAVES) {
        if (eng.fill >= wv.at && !this.wavesFired.has(wv.at)) {
          this.wavesFired.add(wv.at);
          eng.banner(wv.text, 2200);
          // a squad crashes in to sell the moment
          this.phase = "assault";
          this.squadLeft = 2 + Math.round(this.intensity * 2);
          this.squadGapIn = 0;
        }
      }
    }

    _bossFight(eng) {
      // if the window drained and the boss retreated, allow a re-entrance
      if (this.bossAnnounced && !eng.won && eng.fill < BOSS_AT - 0.05) {
        this.bossAnnounced = false;
      }
      if (eng.fill >= BOSS_AT && !this.bossAnnounced) {
        this.bossAnnounced = true;
        eng.add(E().Boss());
        eng.banner("WARNING!!", 2600);
      }
      if (!eng.won && eng.fill >= WIN_AT) {
        eng.add(E().DeathFx());
        const { w, barTop } = eng.size();
        for (let i = 0; i < 5; i++) {
          eng.add(E().Boom(w * 0.9 - 10 + ((i * 7) % 20), barTop - 6 - ((i * 9) % 26), i));
        }
        eng.win();
      }
    }
  }

  window.StatsProDirector = Director;
})();
