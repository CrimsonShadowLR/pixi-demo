import { Container, Graphics } from "pixi.js";
import type { LevelDef } from "@/game/types";

export interface SpawnPoint {
  kind: "grunt" | "archer";
  x: number;
  y: number;
}

export interface RelicPoint {
  x: number;
  y: number;
}

/**
 * Parses a level layout into a wall grid plus spawn/objective metadata, and
 * builds the static Pixi view (floor, walls, exit marker).
 */
export class Maze {
  readonly tile: number;
  readonly rows: string[];
  readonly width: number; // pixels
  readonly height: number; // pixels
  readonly view: Container;

  readonly start = { x: 0, y: 0 };
  exit: { x: number; y: number } | null = null;
  readonly spawns: SpawnPoint[] = [];
  readonly relics: RelicPoint[] = [];

  constructor(level: LevelDef) {
    this.tile = level.tileSize;
    this.rows = level.layout;
    const cols = Math.max(...this.rows.map((r) => r.length));
    this.width = cols * this.tile;
    this.height = this.rows.length * this.tile;

    this.view = new Container();
    const floor = new Graphics();
    const walls = new Graphics();
    this.view.addChild(floor, walls);

    const t = this.tile;
    for (let row = 0; row < this.rows.length; row++) {
      const line = this.rows[row];
      for (let col = 0; col < cols; col++) {
        const ch = line[col] ?? "#"; // past row end = wall
        const px = col * t;
        const py = row * t;
        const cx = px + t / 2;
        const cy = py + t / 2;

        if (ch === "#") {
          walls.rect(px, py, t, t);
          continue;
        }
        // Floor tile with a checker so movement is readable, bright enough to
        // stay legible under the fog overlay.
        const shade = (row + col) % 2 === 0 ? 0x39435c : 0x434f6b;
        floor.rect(px, py, t, t).fill(shade);

        switch (ch) {
          case "S":
            this.start.x = cx;
            this.start.y = cy;
            break;
          case "E":
            this.exit = { x: cx, y: cy };
            break;
          case "g":
            this.spawns.push({ kind: "grunt", x: cx, y: cy });
            break;
          case "a":
            this.spawns.push({ kind: "archer", x: cx, y: cy });
            break;
          case "c":
            this.relics.push({ x: cx, y: cy });
            break;
        }
      }
    }

    walls.fill(0x121319);
    // Wall edge highlight for depth.
    const edges = new Graphics();
    for (let row = 0; row < this.rows.length; row++) {
      for (let col = 0; col < cols; col++) {
        if ((this.rows[row][col] ?? "#") !== "#") continue;
        const px = col * t;
        const py = row * t;
        // Draw a top edge only where the tile above is open.
        if ((this.rows[row - 1]?.[col] ?? "#") !== "#") {
          edges.rect(px, py, t, 4);
        }
      }
    }
    edges.fill(0x2e3342);
    this.view.addChild(edges);

    if (this.exit) {
      const marker = new Graphics()
        .rect(this.exit.x - t * 0.32, this.exit.y - t * 0.32, t * 0.64, t * 0.64)
        .fill({ color: 0xf5d142, alpha: 0.85 });
      this.view.addChild(marker);
    }
  }

  isWallAt(col: number, row: number): boolean {
    if (row < 0 || row >= this.rows.length || col < 0) return true;
    return (this.rows[row][col] ?? "#") === "#";
  }

  /** AABB-vs-grid test: is a half-size square centered at (cx,cy) hitting a wall? */
  collidesBox(cx: number, cy: number, half: number): boolean {
    const t = this.tile;
    const minCol = Math.floor((cx - half) / t);
    const maxCol = Math.floor((cx + half) / t);
    const minRow = Math.floor((cy - half) / t);
    const maxRow = Math.floor((cy + half) / t);
    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        if (this.isWallAt(col, row)) return true;
      }
    }
    return false;
  }
}
