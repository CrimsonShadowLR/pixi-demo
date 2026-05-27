import { Application, Container, Graphics, Ticker } from "pixi.js";
import type { HeroDef, LevelDef, GameHooks, HudState } from "@/game/types";
import { Maze } from "@/game/Maze";
import { Player } from "@/game/Player";
import { Enemy } from "@/game/Enemy";
import { Projectile } from "@/game/Projectile";
import { createInput, type InputHandle } from "@/game/input";

interface Relic {
  x: number;
  y: number;
  view: Graphics;
}

interface Fx {
  view: Graphics;
  life: number;
  max: number;
}

const VISION_RADIUS = 240;
// Darkness outside the vision circle. Kept partial so the maze stays readable
// (explored layout is still dimly visible) instead of pitch black.
const FOG_ALPHA = 0.5;

/**
 * Runs one level for one hero. Owns the Pixi scene graph, the ticker loop, all
 * combat resolution, and win/lose detection. Construct, then call destroy() when
 * unmounting or restarting.
 */
export class Game {
  private readonly app: Application;
  private readonly level: LevelDef;
  private readonly hero: HeroDef;
  private readonly hooks: GameHooks;

  private readonly world = new Container();
  private readonly fxLayer = new Container();
  private readonly maze: Maze;
  private readonly player: Player;
  private enemies: Enemy[] = [];
  private projectiles: Projectile[] = [];
  private relics: Relic[] = [];
  private fx: Fx[] = [];
  private readonly totalEnemies: number;
  private readonly totalRelics: number;

  private readonly fog = new Graphics();
  private readonly light = new Graphics();
  private fogEnabled = true;

  private readonly input: InputHandle;
  private over = false;
  private hudTimer = 0;
  private lastProgress = "";
  private timeLeft: number; // ms remaining on a timed level (0 if untimed)

  constructor(app: Application, level: LevelDef, hero: HeroDef, hooks: GameHooks) {
    this.app = app;
    this.level = level;
    this.hero = hero;
    this.hooks = hooks;
    this.input = createInput();

    this.timeLeft = level.timeLimitMs ?? 0;
    this.maze = new Maze(level);
    this.player = new Player(hero, this.maze.start.x, this.maze.start.y);

    // Scene graph: world (camera-panned) -> maze, relics, entities, fx.
    this.world.addChild(this.maze.view);
    for (const r of this.maze.relics) {
      const view = new Graphics().star(0, 0, 5, 11, 5).fill(0xffe066).stroke({ color: 0xffffff, width: 1.5 });
      view.position.set(r.x, r.y);
      this.world.addChild(view);
      this.relics.push({ x: r.x, y: r.y, view });
    }
    for (const s of this.maze.spawns) {
      const e = new Enemy(s.kind, s.x, s.y);
      this.enemies.push(e);
      this.world.addChild(e.view);
    }
    this.world.addChild(this.fxLayer, this.player.view);
    this.app.stage.addChild(this.world);

    this.totalEnemies = this.enemies.length;
    this.totalRelics = this.relics.length;

    this.setupFog();
    this.app.ticker.add(this.loop);
    this.pushHud(true);
  }

  private setupFog() {
    const { width, height } = this.app.screen;
    this.fog.rect(0, 0, width, height).fill({ color: 0x05060a, alpha: FOG_ALPHA });
    this.light.circle(0, 0, VISION_RADIUS).fill(0xffffff);
    this.app.stage.addChild(this.fog, this.light);
    try {
      // Inverse mask = darkness everywhere EXCEPT the circle around the player.
      this.fog.setMask({ mask: this.light, inverse: true });
    } catch {
      // Older/unexpected API — degrade to a faint, unmasked tint that stays playable.
      this.fogEnabled = false;
      this.fog.clear().rect(0, 0, width, height).fill({ color: 0x05060a, alpha: 0.12 });
      this.light.visible = false;
    }
  }

  private loop = (ticker: Ticker) => {
    if (this.over) return;
    const dtFrame = Math.min(ticker.deltaTime, 3);
    const dtMs = Math.min(ticker.deltaMS, 50);

    const fired = this.player.update(dtFrame, dtMs, this.input.state, this.maze);
    if (fired) this.doPlayerAttack();

    const ctx = {
      fire: (x: number, y: number, dx: number, dy: number) => {
        const p = new Projectile(x, y, dx, dy, 5.2, 11, "enemy");
        this.projectiles.push(p);
        this.world.addChild(p.view);
      },
    };
    for (const e of this.enemies) e.update(dtFrame, dtMs, this.player, this.maze, ctx);

    this.updateProjectiles(dtFrame, dtMs);
    this.updateFx(dtMs);
    this.collectRelics();

    // Reap dead enemies.
    if (this.enemies.some((e) => e.dead)) {
      for (const e of this.enemies) if (e.dead) e.view.destroy();
      this.enemies = this.enemies.filter((e) => !e.dead);
    }

    if (this.level.timeLimitMs) {
      this.timeLeft -= dtMs;
      if (this.timeLeft <= 0) {
        this.timeLeft = 0;
        this.pushHud(true);
        return this.end("lose");
      }
    }

    this.updateCamera();
    this.hudTimer += dtMs;
    this.pushHud(false);
    this.checkEnd();
  };

  private doPlayerAttack() {
    const { facing } = this.player;
    if (this.hero.attackType === "ranged") {
      const p = new Projectile(this.player.x, this.player.y, facing.x, facing.y, 7.5, this.hero.damage, "player");
      this.projectiles.push(p);
      this.world.addChild(p.view);
      return;
    }

    // Melee: damage (and optionally stun) enemies inside the facing cone.
    const reach = this.hero.attackRange;
    const arc = this.hero.attackArc ?? 0.25;
    for (const e of this.enemies) {
      const dx = e.x - this.player.x;
      const dy = e.y - this.player.y;
      const dist = Math.hypot(dx, dy);
      if (dist > reach + e.half) continue;
      const dot = (dx * facing.x + dy * facing.y) / (dist || 1);
      if (dot >= arc) {
        e.takeDamage(this.hero.damage);
        if (this.hero.stunMs) e.stun(this.hero.stunMs);
      }
    }
    this.spawnSwingFx(reach, Math.acos(Math.max(-1, Math.min(1, arc))));
  }

  private spawnSwingFx(reach: number, spread: number) {
    const { facing } = this.player;
    const ang = Math.atan2(facing.y, facing.x);
    const g = new Graphics();
    g.moveTo(0, 0)
      .arc(0, 0, reach, ang - spread, ang + spread)
      .lineTo(0, 0)
      .fill({ color: 0xffffff, alpha: 0.4 });
    g.position.set(this.player.x, this.player.y);
    this.fxLayer.addChild(g);
    this.fx.push({ view: g, life: 150, max: 150 });
  }

  private updateProjectiles(dtFrame: number, dtMs: number) {
    const survivors: Projectile[] = [];
    for (const p of this.projectiles) {
      let alive = p.update(dtFrame, dtMs, this.maze);
      if (alive) {
        if (p.faction === "player") {
          for (const e of this.enemies) {
            if (Math.hypot(e.x - p.x, e.y - p.y) < p.radius + e.half) {
              e.takeDamage(p.damage);
              alive = false;
              break;
            }
          }
        } else if (Math.hypot(this.player.x - p.x, this.player.y - p.y) < p.radius + this.player.half) {
          this.player.takeDamage(p.damage);
          alive = false;
        }
      }
      if (alive) survivors.push(p);
      else p.view.destroy();
    }
    this.projectiles = survivors;
  }

  private updateFx(dtMs: number) {
    const survivors: Fx[] = [];
    for (const f of this.fx) {
      f.life -= dtMs;
      if (f.life <= 0) {
        f.view.destroy();
        continue;
      }
      f.view.alpha = f.life / f.max;
      survivors.push(f);
    }
    this.fx = survivors;
  }

  private collectRelics() {
    if (this.relics.length === 0) return;
    const survivors: Relic[] = [];
    for (const r of this.relics) {
      if (Math.hypot(this.player.x - r.x, this.player.y - r.y) < this.player.half + 13) {
        r.view.destroy();
      } else {
        survivors.push(r);
      }
    }
    this.relics = survivors;
  }

  private updateCamera() {
    const vw = this.app.screen.width;
    const vh = this.app.screen.height;
    this.world.x =
      this.maze.width <= vw
        ? (vw - this.maze.width) / 2
        : clamp(vw / 2 - this.player.x, vw - this.maze.width, 0);
    this.world.y =
      this.maze.height <= vh
        ? (vh - this.maze.height) / 2
        : clamp(vh / 2 - this.player.y, vh - this.maze.height, 0);

    if (this.fogEnabled) {
      this.light.position.set(this.player.x + this.world.x, this.player.y + this.world.y);
    }
  }

  private pushHud(force: boolean) {
    const remaining = this.enemies.length;
    const collected = this.totalRelics - this.relics.length;
    let progress = "";
    switch (this.level.victory) {
      case "escape":
        progress = "Reach the exit";
        break;
      case "kill_all":
        progress = `Enemies ${this.totalEnemies - remaining}/${this.totalEnemies}`;
        break;
      case "collect":
        progress = `Relics ${collected}/${this.totalRelics}`;
        break;
      default:
        progress = this.level.objectiveText;
    }

    if (!force && this.hudTimer < 120 && progress === this.lastProgress) return;
    this.hudTimer = 0;
    this.lastProgress = progress;

    let timer: string | undefined;
    let timerUrgent = false;
    if (this.level.timeLimitMs) {
      const secs = Math.max(0, Math.ceil(this.timeLeft / 1000));
      timer = `${Math.floor(secs / 60)}:${(secs % 60).toString().padStart(2, "0")}`;
      timerUrgent = this.timeLeft <= 4_000;
    }

    const hud: HudState = {
      heroName: this.hero.name,
      hp: Math.ceil(this.player.hp),
      maxHp: this.player.maxHp,
      objective: this.level.objectiveText,
      progress,
      timer,
      timerUrgent,
    };
    this.hooks.onHud(hud);
  }

  private checkEnd() {
    if (this.over) return;
    if (this.player.dead) return this.end("lose");

    switch (this.level.victory) {
      case "escape":
        if (this.maze.exit && Math.hypot(this.player.x - this.maze.exit.x, this.player.y - this.maze.exit.y) < this.maze.tile * 0.55) {
          this.end("win");
        }
        break;
      case "kill_all":
        if (this.enemies.length === 0) this.end("win");
        break;
      case "collect":
        if (this.relics.length === 0) this.end("win");
        break;
    }
  }

  private end(result: "win" | "lose") {
    this.over = true;
    this.hooks.onResult(result);
  }

  destroy() {
    this.over = true;
    this.app.ticker.remove(this.loop);
    this.input.destroy();
    // Children are destroyed with the world/stage; just detach our containers.
    this.world.destroy({ children: true });
    this.fog.destroy();
    this.light.destroy();
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
