import { Application, Container, Graphics, Ticker } from "pixi.js";
import type { HeroDef, LevelDef, GameHooks, HudState, DashAbility, BlinkAbility } from "@/game/types";
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
  /** If true, the fx scales up as it fades (used by the push shockwave ring). */
  grow?: boolean;
}

/** A tutorial pickup (key or equipable) sitting on a floor. */
interface Pickup {
  col: number;
  row: number;
  x: number;
  y: number;
  floor: number;
  view: Graphics;
}

/** A locked door the player opens with a key. */
interface Door {
  col: number;
  row: number;
  x: number;
  y: number;
  floor: number;
  locked: boolean;
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

  // --- Tutorial interactions (only populated when the level uses k/q/D tiles) ---
  private keys: Pickup[] = [];
  private items: Pickup[] = [];
  private doors: Door[] = [];
  private hasKey = false;
  private equipped = false;
  private prevInteract = false;
  private tutorialHint = ""; // contextual "Press E ..." prompt for this frame
  /** Debounce so standing on a ladder swaps floors once, not every frame. */
  private floorSwitchArmed = true;

  private readonly input: InputHandle;
  private over = false;
  private hudTimer = 0;
  private lastProgress = "";
  private lastPrompt: string | undefined;
  private timeLeft: number; // ms remaining on a timed level (0 if untimed)

  constructor(app: Application, level: LevelDef, hero: HeroDef, hooks: GameHooks) {
    this.app = app;
    this.level = level;
    this.hero = hero;
    this.hooks = hooks;
    this.input = createInput(app.canvas as HTMLCanvasElement);

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
    for (const k of this.maze.keys) {
      const view = makeKeyView();
      view.position.set(k.x, k.y);
      view.visible = k.floor === this.maze.active; // only shown on its own floor
      this.world.addChild(view);
      this.keys.push({ ...k, view });
    }
    for (const it of this.maze.items) {
      const view = makeCharmView();
      view.position.set(it.x, it.y);
      view.visible = it.floor === this.maze.active;
      this.world.addChild(view);
      this.items.push({ ...it, view });
    }
    for (const d of this.maze.doors) {
      this.doors.push({ col: d.col, row: d.row, x: d.x, y: d.y, floor: d.floor, locked: true });
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

    const action = this.player.update(dtFrame, dtMs, this.input.state, this.maze);
    if (action.attacked) this.doPlayerAttack();
    if (action.usedAbility) this.doPlayerAbility();
    this.updateFloorTransition();

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
    this.handleInteractions();

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

  private doPlayerAbility() {
    const ab = this.hero.ability;
    if (!ab) return;
    if (ab.type === "push") {
      const dmg = this.hero.damage * ab.damageFraction;
      for (const e of this.enemies) {
        const dist = Math.hypot(e.x - this.player.x, e.y - this.player.y);
        if (dist > ab.radius + e.half) continue;
        e.knockback(this.maze, this.player.x, this.player.y, ab.knockback);
        e.takeDamage(dmg);
      }
      this.spawnPushFx(ab.radius);
    } else if (ab.type === "dash") {
      this.doDash(ab);
    } else {
      this.doBlink(ab);
    }
  }

  /**
   * Scout blink: teleport along facing, ignoring walls. Lands on the farthest
   * clear cell within range (walking the target back toward the player if the
   * full distance ends inside a wall), so it never strands the player in solid.
   */
  private doBlink(ab: BlinkAbility) {
    const { facing } = this.player;
    const startX = this.player.x;
    const startY = this.player.y;
    const step = this.player.half;
    for (let d = ab.distance; d >= step; d -= step) {
      const tx = startX + facing.x * d;
      const ty = startY + facing.y * d;
      if (!this.maze.collidesBox(tx, ty, this.player.half)) {
        this.player.x = tx;
        this.player.y = ty;
        this.player.view.position.set(tx, ty);
        this.spawnBlinkFx(startX, startY, tx, ty);
        return;
      }
    }
    // Fully boxed in — nowhere clear to land; the blink fizzles in place.
  }

  /**
   * Warrior dash: step the player forward along its facing, stopping at walls.
   * Any enemy whose center falls inside the swept corridor takes half attack
   * damage and is shoved off the dash origin — each enemy hit at most once.
   */
  private doDash(ab: DashAbility) {
    const { facing } = this.player;
    const dmg = this.hero.damage * ab.damageFraction;
    const startX = this.player.x;
    const startY = this.player.y;
    const STEPS = 12;
    const stepLen = ab.distance / STEPS;
    const hit = new Set<Enemy>();

    for (let i = 0; i < STEPS; i++) {
      const nx = this.player.x + facing.x * stepLen;
      const ny = this.player.y + facing.y * stepLen;
      if (this.maze.collidesBox(nx, ny, this.player.half)) break; // wall stops the lunge
      this.player.x = nx;
      this.player.y = ny;
      for (const e of this.enemies) {
        if (hit.has(e)) continue;
        if (Math.hypot(e.x - this.player.x, e.y - this.player.y) <= ab.radius + e.half) {
          e.takeDamage(dmg);
          e.knockback(this.maze, startX, startY, ab.knockback);
          hit.add(e);
        }
      }
    }
    this.player.view.position.set(this.player.x, this.player.y);
    this.spawnDashFx(startX, startY, this.player.x, this.player.y, ab.radius);
  }

  private spawnDashFx(x0: number, y0: number, x1: number, y1: number, width: number) {
    const g = new Graphics();
    g.moveTo(x0, y0)
      .lineTo(x1, y1)
      .stroke({ color: 0xf2d68a, width: width * 1.5, alpha: 0.55, cap: "round" });
    this.fxLayer.addChild(g);
    this.fx.push({ view: g, life: 220, max: 220 });
  }

  private spawnBlinkFx(x0: number, y0: number, x1: number, y1: number) {
    const g = new Graphics();
    g.moveTo(x0, y0)
      .lineTo(x1, y1)
      .stroke({ color: 0x2ec4b6, width: 5, alpha: 0.45, cap: "round" });
    g.circle(x0, y0, this.player.half).stroke({ color: 0x2ec4b6, width: 3, alpha: 0.6 }); // after-image
    this.fxLayer.addChild(g);
    this.fx.push({ view: g, life: 240, max: 240 });
  }

  private spawnPushFx(radius: number) {
    const g = new Graphics().circle(0, 0, radius).stroke({ color: 0xf2d68a, width: 5, alpha: 0.9 });
    g.position.set(this.player.x, this.player.y);
    this.fxLayer.addChild(g);
    this.fx.push({ view: g, life: 360, max: 360, grow: true });
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
      const progress = 1 - f.life / f.max;
      f.view.alpha = f.life / f.max;
      if (f.grow) f.view.scale.set(0.35 + 0.65 * progress);
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

  /**
   * Steps onto a ladder swap which floor is rendered/active, so the upper
   * platform overlaps the ground room (and vice-versa). Armed-flag debounces it
   * so one step = one swap, and you must leave the ladder before swapping back.
   */
  private updateFloorTransition() {
    if (this.maze.layerCount < 2) return;
    const t = this.maze.tile;
    const col = Math.floor(this.player.x / t);
    const row = Math.floor(this.player.y / t);
    const onLadder = this.maze.isLadderAt(col, row);

    if (onLadder && this.floorSwitchArmed) {
      const next = this.maze.active === 0 ? 1 : 0;
      // Only swap if the same cell is standable on the target floor.
      if (!this.maze.isWallAt(col, row, next)) {
        this.maze.setActive(next);
        this.floorSwitchArmed = false;
        // Snap to the ladder cell's center so the collision box sits cleanly
        // inside it. Without this, climbing from below leaves the box dipping
        // into the wall row beyond the landing on the new floor — and since
        // every direction keeps it there, the player gets stuck.
        this.player.x = col * t + t / 2;
        this.player.y = row * t + t / 2;
      }
    } else if (!onLadder) {
      this.floorSwitchArmed = true;
    }
  }

  /**
   * Tutorial E-interactions: take a key, unlock a door with it, equip an item.
   * No-op on levels without k/q/D tiles (the lists stay empty). Only the active
   * floor's interactables count (floors overlap in world space). Sets the
   * contextual prompt every frame; acts only on the rising edge of the E key.
   */
  private handleInteractions() {
    const t = this.maze.tile;
    const pickR = t * 0.9;
    const doorR = t * 1.2;
    const floor = this.maze.active;
    const near = (x: number, y: number, r: number) => Math.hypot(this.player.x - x, this.player.y - y) <= r;

    // Pickups only render on their own floor (floors share coordinates).
    for (const k of this.keys) k.view.visible = k.floor === floor;
    for (const it of this.items) it.view.visible = it.floor === floor;

    const key = this.keys.find((k) => k.floor === floor);
    const item = this.items.find((it) => it.floor === floor);
    const door = this.doors.find((d) => d.locked && d.floor === floor);

    // Contextual prompt (closest actionable thing wins).
    let prompt = "";
    if (key && near(key.x, key.y, pickR)) {
      prompt = "Press E — take the Iron Key";
    } else if (door && near(door.x, door.y, doorR)) {
      prompt = this.hasKey ? "Press E — unlock the vault" : "Locked. Find the key first.";
    } else if (item && near(item.x, item.y, pickR)) {
      prompt = "Press E — equip the Training Charm";
    } else if (this.hasKey && !this.equipped && item && !door) {
      prompt = "Vault open — grab the charm inside";
    }
    this.tutorialHint = prompt;

    // Edge-detect E so one press does one thing.
    const pressed = this.input.state.interact && !this.prevInteract;
    this.prevInteract = this.input.state.interact;
    if (!pressed) return;

    if (key && near(key.x, key.y, pickR)) {
      key.view.destroy();
      this.keys = this.keys.filter((k) => k !== key);
      this.hasKey = true;
      return;
    }
    if (door && this.hasKey && near(door.x, door.y, doorR)) {
      door.locked = false;
      this.maze.openDoor(door.col, door.row, door.floor);
      return;
    }
    if (item && near(item.x, item.y, pickR)) {
      // Mock equipable: hero-agnostic, no stat effect, not persisted anywhere,
      // so it never carries into other levels. Picking it up wins the tutorial.
      item.view.destroy();
      this.items = this.items.filter((it) => it !== item);
      this.equipped = true;
    }
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
      case "tutorial": {
        const onPlatform = this.maze.active > 0;
        const vaultLocked = this.doors.some((d) => d.locked);
        if (this.equipped) progress = "Charm equipped!";
        else if (this.hasKey && !vaultLocked) progress = "Grab the charm in the vault";
        else if (this.hasKey) progress = "Unlock the vault with the key";
        else if (onPlatform) progress = "Find the key in the open room";
        else progress = "Climb the ladder to the platform";
        break;
      }
      default:
        progress = this.level.objectiveText;
    }

    const prompt = this.tutorialHint || undefined;
    if (!force && this.hudTimer < 120 && progress === this.lastProgress && prompt === this.lastPrompt) return;
    this.hudTimer = 0;
    this.lastProgress = progress;
    this.lastPrompt = prompt;

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
      prompt,
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
      case "tutorial":
        if (this.equipped) this.end("win");
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

/** A small gold key icon for the tutorial key pickup. */
function makeKeyView(): Graphics {
  const g = new Graphics();
  // Bow (ring) + stem + two teeth.
  g.circle(-7, 0, 6).stroke({ color: 0xf5d142, width: 3 });
  g.rect(-1, -2, 14, 4).fill(0xf5d142);
  g.rect(9, 2, 3, 5).fill(0xf5d142);
  g.rect(4, 2, 3, 5).fill(0xf5d142);
  g.alpha = 0.95;
  return g;
}

/** A glowing charm/gem for the tutorial equipable. */
function makeCharmView(): Graphics {
  const g = new Graphics();
  g.circle(0, 0, 15).fill({ color: 0x7be0ff, alpha: 0.18 }); // soft halo
  g.poly([0, -11, 10, 0, 0, 11, -10, 0]).fill(0x4fd1e0).stroke({ color: 0xffffff, width: 2 });
  return g;
}
