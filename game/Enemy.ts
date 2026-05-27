import { Container, Graphics } from "pixi.js";
import type { Maze } from "@/game/Maze";
import type { Player } from "@/game/Player";

export type EnemyKind = "grunt" | "archer";

/** Lets an archer hand a projectile back to the Game without importing it. */
export interface EnemyContext {
  fire: (x: number, y: number, dirX: number, dirY: number) => void;
}

interface Stats {
  hp: number;
  speed: number;
  half: number;
  color: number;
  aggro: number;
}

const STATS: Record<EnemyKind, Stats> = {
  grunt: { hp: 60, speed: 1.7, half: 15, color: 0xff8a3d, aggro: 360 },
  archer: { hp: 42, speed: 1.3, half: 14, color: 0xb15cff, aggro: 420 },
};

export class Enemy {
  readonly kind: EnemyKind;
  x: number;
  y: number;
  hp: number;
  readonly maxHp: number;
  readonly half: number;
  readonly view: Container;
  private readonly body: Graphics;
  private readonly stats: Stats;

  private contactTimer = 0; // ms until grunt can deal contact damage again
  private shootTimer = 900; // ms until archer's next shot
  private hurtFlash = 0;

  constructor(kind: EnemyKind, x: number, y: number) {
    this.kind = kind;
    this.x = x;
    this.y = y;
    this.stats = STATS[kind];
    this.hp = this.stats.hp;
    this.maxHp = this.stats.hp;
    this.half = this.stats.half;

    this.view = new Container();
    this.body = new Graphics();
    this.draw(this.stats.color);
    this.view.addChild(this.body);
    this.view.position.set(x, y);
  }

  private draw(color: number) {
    this.body.clear();
    if (this.kind === "grunt") {
      this.body.rect(-this.half, -this.half, this.half * 2, this.half * 2);
    } else {
      // Diamond for archers so the two kinds read apart at a glance.
      this.body.poly([0, -this.half, this.half, 0, 0, this.half, -this.half, 0]);
    }
    this.body.fill(color).stroke({ color: 0x000000, width: 2 });
  }

  private moveToward(dx: number, dy: number, dtFrame: number, maze: Maze) {
    const len = Math.hypot(dx, dy) || 1;
    const step = this.stats.speed * dtFrame;
    const vx = (dx / len) * step;
    const vy = (dy / len) * step;
    if (!maze.collidesBox(this.x + vx, this.y, this.half)) this.x += vx;
    if (!maze.collidesBox(this.x, this.y + vy, this.half)) this.y += vy;
  }

  update(dtFrame: number, dtMs: number, player: Player, maze: Maze, ctx: EnemyContext) {
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.hypot(dx, dy);

    if (this.contactTimer > 0) this.contactTimer -= dtMs;
    if (this.shootTimer > 0) this.shootTimer -= dtMs;

    if (dist < this.stats.aggro) {
      if (this.kind === "grunt") {
        this.moveToward(dx, dy, dtFrame, maze);
        if (dist < this.half + player.half + 4 && this.contactTimer <= 0) {
          player.takeDamage(12);
          this.contactTimer = 600;
        }
      } else {
        // Archer kites: hold a band of distance, shoot on a timer.
        if (dist < 170) this.moveToward(-dx, -dy, dtFrame, maze);
        else if (dist > 280) this.moveToward(dx, dy, dtFrame, maze);
        if (this.shootTimer <= 0) {
          ctx.fire(this.x, this.y, dx, dy);
          this.shootTimer = 1500;
        }
      }
    }

    if (this.hurtFlash > 0) {
      this.hurtFlash -= dtMs;
      this.draw(this.hurtFlash > 0 ? 0xffffff : this.stats.color);
    }
    this.view.position.set(this.x, this.y);
  }

  takeDamage(n: number) {
    this.hp -= n;
    this.hurtFlash = 100;
  }

  get dead(): boolean {
    return this.hp <= 0;
  }
}
