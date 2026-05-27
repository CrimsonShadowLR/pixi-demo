import { Graphics } from "pixi.js";
import type { Maze } from "@/game/Maze";

export type Faction = "player" | "enemy";

export class Projectile {
  x: number;
  y: number;
  private readonly vx: number;
  private readonly vy: number;
  readonly damage: number;
  readonly faction: Faction;
  readonly radius = 6;
  readonly view: Graphics;
  private life = 1600; // ms before it fizzles

  constructor(x: number, y: number, dirX: number, dirY: number, speed: number, damage: number, faction: Faction) {
    this.x = x;
    this.y = y;
    const len = Math.hypot(dirX, dirY) || 1;
    this.vx = (dirX / len) * speed;
    this.vy = (dirY / len) * speed;
    this.damage = damage;
    this.faction = faction;

    const color = faction === "player" ? 0x8fd0ff : 0xff7a4d;
    this.view = new Graphics().circle(0, 0, this.radius).fill(color).stroke({ color: 0xffffff, width: 1 });
    this.view.position.set(x, y);
  }

  /** @returns false when the projectile should be removed. */
  update(dtFrame: number, dtMs: number, maze: Maze): boolean {
    this.x += this.vx * dtFrame;
    this.y += this.vy * dtFrame;
    this.life -= dtMs;
    this.view.position.set(this.x, this.y);
    if (this.life <= 0) return false;
    return !maze.collidesBox(this.x, this.y, this.radius);
  }
}
