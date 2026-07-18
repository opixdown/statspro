// @ts-nocheck
// Entity behaviors. Every entity is { kind, z, dead, update(eng), render(ctx, eng) }.
// Enemy variety is data-driven via ENEMY_TYPES — add a row, get a new enemy.
//
// Exposes: window.StatsProEntities
(function () {
  "use strict";

  const CHAR_SCALE = 0.72;   // characters drawn ~25% smaller than native
  const HERO_X = 14;
  const BULLET_SPEED = 4;    // (speeds tuned for the 14fps tick)
  const ENEMY_BULLET_SPEED = 2.2;
  const GAP = 13;            // min spacing between enemies, in GP
  const COOLDOWN = { idle: 14, running: 8, burning: 5 };
  const ACCURACY = { idle: 0.9, running: 0.8, burning: 0.7 }; // rest miss
  const ENGAGE_PCT = 0.8;    // hero opens fire inside this fraction of the field
  const BOSS_X_PCT = 0.9;

  /**
   * The enemy bestiary.
   *   speed    GP/tick range
   *   fires    stops at `standoff` GP from the hero and shoots back
   *   hops     occasionally jumps while charging
   *   weight   spawn likelihood
   */
  const ENEMY_TYPES = {
    runner:  { group: "enemy",  speed: [0.65, 1.0], weight: 4, animRate: 3, hops: true },
    charger: { group: "enemy",  speed: [1.3, 1.7], weight: 2, animRate: 2, hops: true },
    gunner:  { group: "gunner", speed: [1.2, 1.5], weight: 3, animRate: 3,
               fires: true, standoff: [85, 130] },
  };

  function pickType(rand) {
    const total = Object.values(ENEMY_TYPES).reduce((s, t) => s + t.weight, 0);
    let roll = rand * total;
    for (const [key, t] of Object.entries(ENEMY_TYPES)) {
      roll -= t.weight;
      if (roll <= 0) return { key, ...t };
    }
    return { key: "runner", ...ENEMY_TYPES.runner };
  }

  // ── hero ─────────────────────────────────────────────────────────────
  function Hero() {
    return {
      kind: "hero",
      z: 30,
      dead: false,
      muzzle: 0,
      flinch: 0,
      cooldown: 0,
      /** Enemy fire landed near him — he flinches but never falls. */
      hit(eng) {
        this.flinch = 4;
        const { barTop } = eng.size();
        eng.add(Boom(HERO_X + 6, barTop - 8));
      },
      update(eng) {
        if (this.muzzle > 0) this.muzzle--;
        if (this.flinch > 0) this.flinch--;
        if (this.cooldown > 0) {
          this.cooldown--;
          return;
        }
        if (eng.won) return;
        const { w, barTop } = eng.size();
        // engage anything close — or anything dug in and shooting at us
        const inRange = eng
          .query("enemy")
          .some((e) => e.x < w * ENGAGE_PCT || (e.type.fires && !e.moving));
        const bossUp = eng.fill >= eng.director.BOSS_AT;
        if (!inRange && !bossUp) return;

        const miss = Math.random() > ACCURACY[eng.mood];
        eng.add(Bullet(HERO_X + 12, gunY(eng, barTop) - (miss ? 3 : 0), miss));
        this.muzzle = 2;
        this.cooldown = COOLDOWN[eng.mood];
      },
      render(ctx, eng) {
        if (this.flinch > 0 && eng.tickN % 2 === 0) return; // hit flicker
        const { barTop } = eng.size();
        let img;
        if (this.muzzle > 0) {
          // firing pose while the muzzle flashes
          const idle = eng.sprites.hero.idle;
          img = idle[Math.min(1, idle.length - 1)];
        } else {
          // always mid-stride — he's charging through the level
          const run = eng.sprites.hero.run;
          const rate = eng.mood === "idle" ? 3 : 2;
          img = run[Math.floor(eng.tickN / rate) % run.length];
        }
        eng.stand(ctx, img, HERO_X, barTop, CHAR_SCALE);
        if (this.muzzle > 0 && eng.sprites.fx.muzzle) {
          eng.blit(ctx, eng.sprites.fx.muzzle, HERO_X + 14, gunY(eng, barTop), 8);
        }
      },
    };
  }

  function gunY(eng, barTop) {
    const img = eng.sprites.hero.idle[0];
    return barTop - Math.round(img.height * CHAR_SCALE * 0.62);
  }

  // ── enemies ──────────────────────────────────────────────────────────
  function Enemy(type, x) {
    const speed = type.speed[0] + Math.random() * (type.speed[1] - type.speed[0]);
    const standoff = type.standoff
      ? type.standoff[0] + Math.random() * (type.standoff[1] - type.standoff[0])
      : 0;
    return {
      kind: "enemy",
      z: 20,
      dead: false,
      x,
      type,
      speed,
      standoff,
      fireIn: 16 + Math.floor(Math.random() * 16),
      burst: 0,
      seed: Math.floor(Math.random() * 3),
      moving: true,
      yOff: 0,
      vy: 0,
      update(eng) {
        const { w } = eng.size();
        // formation: runners overtake dug-in gunners, but gunners respect
        // EVERYONE ahead (else they all clamp to the same standoff and stack)
        const ahead = eng
          .query("enemy")
          .filter((e) => e !== this && e.x < this.x && (e.moving || this.type.fires))
          .sort((a, b) => b.x - a.x)[0];
        const floor = ahead ? ahead.x + GAP : -Infinity;

        // gunners rush to cover at/behind the hero's engage line, then dig in
        const holdAt = this.type.fires
          ? HERO_X + Math.min(this.standoff, w * 0.75)
          : -Infinity;
        // never step rightward — a formation "correction" must not teleport
        const next = Math.min(this.x, Math.max(this.x - this.speed, floor, holdAt));
        this.moving = next < this.x - 0.05;
        this.x = next;

        // the odd hop while charging (Contra loves a jumping grunt)
        if (this.type.hops && this.moving && this.yOff === 0 && Math.random() < 0.015) {
          this.vy = -2.4;
        }
        if (this.vy !== 0 || this.yOff < 0) {
          this.yOff += this.vy;
          this.vy += 0.6;
          if (this.yOff >= 0) {
            this.yOff = 0;
            this.vy = 0;
          }
        }

        // dug-in gunners fire in short bursts with real pauses
        if (this.type.fires && !this.moving && !eng.won) {
          if (--this.fireIn <= 0) {
            if (this.burst === 0) this.burst = 2 + Math.floor(Math.random() * 2);
            const { barTop } = eng.size();
            eng.add(EnemyBullet(this.x - 8, barTop - 11));
            this.burst--;
            this.fireIn = this.burst > 0 ? 5 : 26 + Math.floor(Math.random() * 20);
          }
        }

        // reaching the hero: it blows up ON him — that's a hit, not a kill
        if (this.x <= HERO_X + 10) {
          const { barTop } = eng.size();
          eng.add(Boom(this.x, barTop - 10));
          const hero = eng.query("hero")[0];
          if (hero) hero.hit(eng);
          this.dead = true;
        }
      },
      render(ctx, eng) {
        const { barTop } = eng.size();
        const group = eng.sprites[this.type.group] || eng.sprites.enemy;
        const frames = group.frames;
        // standing gunners hold one frame; movers animate
        const idx = this.moving
          ? (this.seed + Math.floor(eng.tickN / this.type.animRate)) % frames.length
          : this.seed % frames.length;
        eng.stand(ctx, frames[idx], this.x, barTop + Math.round(this.yOff), CHAR_SCALE);
      },
    };
  }

  // ── bullets ──────────────────────────────────────────────────────────
  function Bullet(x, y, miss) {
    return {
      kind: "bullet",
      z: 40,
      dead: false,
      x,
      y,
      miss: !!miss, // wild shots sail over everyone's heads
      update(eng) {
        const prevX = this.x;
        this.x += BULLET_SPEED;
        const { w, barTop } = eng.size();
        if (!this.miss) {
          // segment check so fast bullets can't tunnel through a body
          const hit = eng
            .query("enemy")
            .find((e) => e.x >= prevX - 4 && e.x <= this.x + 4);
          if (hit) {
            hit.dead = true;
            eng.add(Boom(hit.x, barTop - 12));
            eng.scoreKill();
            this.dead = true;
            return;
          }
          const bossUp = eng.fill >= eng.director.BOSS_AT && !eng.won;
          if (bossUp && this.x >= w * BOSS_X_PCT - 8) {
            eng.add(Boom(w * BOSS_X_PCT - 8, barTop - 12 - (eng.tickN % 14)));
            this.dead = true;
            return;
          }
        }
        if (this.x >= w) this.dead = true;
      },
      render(ctx, eng) {
        const b = eng.sprites.fx.bullet;
        if (b) eng.blit(ctx, b, this.x, this.y, 4);
        else {
          ctx.fillStyle = "#ffe040";
          ctx.fillRect(Math.round(this.x), this.y, 3, 1);
        }
      },
    };
  }

  function EnemyBullet(x, y) {
    return {
      kind: "enemybullet",
      z: 40,
      dead: false,
      x,
      y,
      miss: Math.random() < 0.45, // enemy aim is bad — nearly half sail past
      update(eng) {
        this.x -= ENEMY_BULLET_SPEED;
        if (!this.miss && this.x <= HERO_X + 4) {
          const hero = eng.query("hero")[0];
          if (hero) hero.hit(eng);
          this.dead = true;
        }
        if (this.x < -4) this.dead = true;
      },
      render(ctx, eng) {
        const b = eng.sprites.fx.bullet;
        if (b) eng.blit(ctx, b, this.x, this.y, 3);
        else {
          ctx.fillStyle = "#ff8c1a";
          ctx.fillRect(Math.round(this.x), this.y, 2, 1);
        }
      },
    };
  }

  // ── fx ───────────────────────────────────────────────────────────────
  function Boom(x, y, delay) {
    return {
      kind: "boom",
      z: 50,
      dead: false,
      x,
      y,
      age: -(delay || 0),
      update() {
        if (++this.age >= 9) this.dead = true;
      },
      render(ctx, eng) {
        if (this.age < 0) return;
        const frames = eng.sprites.fx.boom;
        const idx = Math.min(Math.floor(this.age / 3), frames.length - 1);
        eng.blit(ctx, frames[idx], this.x, this.y, 8 + this.age * 1.5);
      },
    };
  }

  function Boss() {
    return {
      kind: "boss",
      z: 15,
      dead: false,
      dying: 0,
      update(eng) {
        if (eng.won) {
          if (++this.dying > 24) this.dead = true; // gone after the fireworks
          return;
        }
        // window drained back below the boss threshold: it retreats
        if (eng.fill < eng.director.BOSS_AT - 0.05) this.dead = true;
      },
      render(ctx, eng) {
        if (this.dying > 4) return; // swallowed by the blast
        if (eng.won && eng.tickN % 4 < 2) return; // flicker
        const { w, barTop } = eng.size();
        const frames = eng.sprites.boss.frames;
        const img = frames[Math.floor(eng.tickN / 3) % frames.length];
        eng.stand(ctx, img, w * BOSS_X_PCT, barTop, CHAR_SCALE + 0.15);
      },
    };
  }

  function DeathFx() {
    return {
      kind: "deathfx",
      z: 60,
      dead: false,
      age: 0,
      update() {
        if (++this.age > 18) this.dead = true;
      },
      render(ctx, eng) {
        const seq = eng.sprites.fx.death;
        if (!seq) return;
        const { w, barTop } = eng.size();
        const idx = Math.min(Math.floor(this.age / 5), seq.length - 1);
        eng.blit(ctx, seq[idx], w * BOSS_X_PCT, barTop - 14, 18 + this.age * 1.5);
      },
    };
  }

  window.StatsProEntities = { Hero, Enemy, Bullet, Boom, Boss, DeathFx, pickType };
})();
