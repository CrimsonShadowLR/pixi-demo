import { Container, Graphics } from "pixi.js";
import type { HeroDef } from "@/game/types";
import type { InputState } from "@/game/input";
import type { Maze } from "@/game/Maze";

export class Player {
  readonly hero: HeroDef;
  x: number;
  y: number;
  readonly half: number;
  hp: number;
  readonly maxHp: number;
  /** Last non-zero movement direction (unit-ish vector); drives attack aim. */
  facing = { x: 1, y: 0 };

  readonly view: Container;
  private readonly body: Graphics;
  private attackTimer = 0; // ms until next attack allowed
  private hurtFlash = 0; // ms of red flash remaining

  constructor(hero: HeroDef, x: number, y: number) {
    this.hero = hero;
    this.x = x;
    this.y = y;
    this.half = 14;
    this.maxHp = hero.maxHp;
    this.hp = hero.maxHp;

    this.view = new Container();
    this.body = new Graphics();
    this.draw(hero.color);
    this.view.addChild(this.body);
  }

  private draw(color: number) {
    this.body.clear();
    this.body.circle(0, 0, this.half).fill(color).stroke({ color: 0xffffff, width: 2 });
    // Facing pip.
    this.body.circle(this.facing.x * 9, this.facing.y * 9, 4).fill(0xffffff);
  }

  /**
   * @param dtFrame ticker.deltaTime (≈1 at 60fps) — scales movement.
   * @param dtMs    ticker.deltaMS — scales timers.
   * @returns true if an attack fired this frame (Game resolves the hit).
   */
  update(dtFrame: number, dtMs: number, input: InputState, maze: Maze): boolean {
    let dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    let dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);

    if (dx !== 0 || dy !== 0) {
      const len = Math.hypot(dx, dy);
      dx /= len;
      dy /= len;
      this.facing.x = dx;
      this.facing.y = dy;

      const step = this.hero.speed * dtFrame;
      const nx = this.x + dx * step;
      if (!maze.collidesBox(nx, this.y, this.half)) this.x = nx;
      const ny = this.y + dy * step;
      if (!maze.collidesBox(this.x, ny, this.half)) this.y = ny;
    }

    if (this.attackTimer > 0) this.attackTimer -= dtMs;
    if (this.hurtFlash > 0) {
      this.hurtFlash -= dtMs;
      if (this.hurtFlash <= 0) this.draw(this.hero.color);
    }

    this.view.position.set(this.x, this.y);
    this.draw(this.hurtFlash > 0 ? 0xffffff : this.hero.color);

    if (input.attack && this.attackTimer <= 0) {
      this.attackTimer = this.hero.attackCooldown;
      return true;
    }
    return false;
  }

  takeDamage(n: number) {
    this.hp = Math.max(0, this.hp - n);
    this.hurtFlash = 120;
  }

  get dead(): boolean {
    return this.hp <= 0;
  }
}
