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

/** A world-space point plus the grid cell and floor it lives on (E-interactions). */
export interface CellPoint {
  col: number;
  row: number;
  x: number;
  y: number;
  floor: number;
}

/** One stacked floor. All floors share the same coordinate space; only the
 *  active one is rendered, so an upper floor visually overlaps the one below. */
interface Layer {
  rows: string[];
  view: Container;
  openDoors: Set<string>;
  doorViews: Map<string, Graphics>;
  ladders: Set<string>; // "col,row" cells that move you between floors
}

const cellKey = (col: number, row: number) => `${col},${row}`;

// Opacity of a lower floor shown beneath the one you're standing on, so the
// ground level reads faintly through/around the raised platform.
const GHOST_ALPHA = 0.25;

/**
 * Parses one or more stacked floor layouts into wall grids + spawn/objective
 * metadata, and builds a Pixi view per floor. Single-floor levels (`layout`)
 * and multi-floor levels (`floors`) share this class; for single-floor levels
 * there is just one layer and `active` stays 0.
 */
export class Maze {
  readonly tile: number;
  readonly width: number; // pixels
  readonly height: number; // pixels
  readonly view: Container; // parent of every floor's container
  readonly layerCount: number;

  readonly start = { x: 0, y: 0 };
  exit: { x: number; y: number } | null = null;
  readonly spawns: SpawnPoint[] = [];
  readonly relics: RelicPoint[] = [];
  /** Tutorial pickups: keys (open a door) and equipables. Carry their floor. */
  readonly keys: CellPoint[] = [];
  readonly items: CellPoint[] = [];
  /** Locked doors — block movement until openDoor() is called. */
  readonly doors: CellPoint[] = [];

  private readonly layers: Layer[] = [];
  /** Index of the floor the player is currently on / that is rendered. */
  active = 0;

  constructor(level: LevelDef) {
    this.tile = level.tileSize;
    const floors = level.floors ?? (level.layout ? [level.layout] : []);
    this.layerCount = floors.length;

    const cols = Math.max(...floors.flat().map((r) => r.length));
    this.width = cols * this.tile;
    this.height = Math.max(...floors.map((f) => f.length)) * this.tile;

    this.view = new Container();
    floors.forEach((rows, fi) => {
      const layer = this.buildLayer(rows, fi, cols);
      this.layers.push(layer);
      this.view.addChild(layer.view); // floor 0 first => lower floors render behind
    });
    this.applyLayerVisibility();
  }

  /**
   * Active floor: full opacity, on top. Floors below it: dimmed (you see the
   * ground through/around the platform). Floors above it: hidden.
   */
  private applyLayerVisibility() {
    for (let i = 0; i < this.layers.length; i++) {
      const v = this.layers[i].view;
      if (i === this.active) {
        v.visible = true;
        v.alpha = 1;
      } else if (i < this.active) {
        v.visible = true;
        v.alpha = GHOST_ALPHA;
      } else {
        v.visible = false;
      }
    }
  }

  private buildLayer(rows: string[], floor: number, cols: number): Layer {
    const t = this.tile;
    const view = new Container();
    const layer: Layer = { rows, view, openDoors: new Set(), doorViews: new Map(), ladders: new Set() };

    const floorG = new Graphics();
    const walls = new Graphics();
    view.addChild(floorG, walls);

    for (let row = 0; row < rows.length; row++) {
      const line = rows[row];
      for (let col = 0; col < cols; col++) {
        const ch = line[col] ?? "#"; // past row end = wall
        const px = col * t;
        const py = row * t;
        const cx = px + t / 2;
        const cy = py + t / 2;

        if (ch === "#") {
          // Only draw walls that border open space (a visible wall face). Deep
          // void cells with no walkable neighbor are left transparent so a
          // lower floor shown beneath this one (ghosting) is visible through
          // the empty area around a raised platform. Collision is unaffected —
          // isWallAt() reads the grid, not the drawn graphics.
          let bordersOpen = false;
          for (let dr = -1; dr <= 1 && !bordersOpen; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              if (dr === 0 && dc === 0) continue;
              if ((rows[row + dr]?.[col + dc] ?? "#") !== "#") {
                bordersOpen = true;
                break;
              }
            }
          }
          if (bordersOpen) walls.rect(px, py, t, t);
          continue;
        }
        // Floor tile with a checker so movement is readable, bright enough to
        // stay legible under the fog overlay. "," is the raised platform floor —
        // a lighter palette so the upper level reads as elevated.
        const platform = ch === ",";
        const shade = platform
          ? (row + col) % 2 === 0
            ? 0x4a5575
            : 0x55618a
          : (row + col) % 2 === 0
            ? 0x39435c
            : 0x434f6b;
        floorG.rect(px, py, t, t).fill(shade);

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
          case "k":
            this.keys.push({ col, row, x: cx, y: cy, floor });
            break;
          case "q":
            this.items.push({ col, row, x: cx, y: cy, floor });
            break;
          case "H":
            layer.ladders.add(cellKey(col, row));
            this.drawLadder(view, px, py, t);
            break;
          case "D":
            this.doors.push({ col, row, x: cx, y: cy, floor });
            this.drawDoor(layer, col, row, px, py, t);
            break;
        }
      }
    }

    walls.fill(0x121319);
    // Wall edge highlight for depth.
    const edges = new Graphics();
    for (let row = 0; row < rows.length; row++) {
      for (let col = 0; col < cols; col++) {
        if ((rows[row][col] ?? "#") !== "#") continue;
        const px = col * t;
        const py = row * t;
        if ((rows[row - 1]?.[col] ?? "#") !== "#") edges.rect(px, py, t, 4);
      }
    }
    edges.fill(0x2e3342);
    view.addChild(edges);

    if (this.exit) {
      const marker = new Graphics()
        .rect(this.exit.x - t * 0.32, this.exit.y - t * 0.32, t * 0.64, t * 0.64)
        .fill({ color: 0xf5d142, alpha: 0.85 });
      view.addChild(marker);
    }

    return layer;
  }

  /** Ladder rungs over a floor tile — the climb between floors. */
  private drawLadder(view: Container, px: number, py: number, t: number) {
    const g = new Graphics();
    const railInset = t * 0.28;
    const railW = 4;
    g.rect(px + railInset, py, railW, t).rect(px + t - railInset - railW, py, railW, t);
    for (let i = 1; i <= 4; i++) {
      g.rect(px + railInset, py + (t / 5) * i - 2, t - 2 * railInset, 4);
    }
    g.fill({ color: 0xc89b5a, alpha: 0.95 });
    view.addChild(g);
  }

  /** Locked door panel — kept on top of the floor so it reads as a barrier. */
  private drawDoor(layer: Layer, col: number, row: number, px: number, py: number, t: number) {
    const g = new Graphics();
    g.rect(px + 3, py + 3, t - 6, t - 6).fill(0x7a4a22).stroke({ color: 0xb5793c, width: 2 });
    g.circle(px + t / 2, py + t * 0.42, t * 0.1).fill(0x2a1a0c);
    g.rect(px + t / 2 - 2, py + t * 0.42, 4, t * 0.18).fill(0x2a1a0c);
    layer.view.addChild(g);
    layer.doorViews.set(cellKey(col, row), g);
  }

  /** Swap which floor is rendered/active. Upper floor overlaps the one below. */
  setActive(i: number) {
    if (i === this.active || i < 0 || i >= this.layers.length) return;
    this.active = i;
    this.applyLayerVisibility();
  }

  /** True if the given cell is a ladder on the floor (defaults to the active one). */
  isLadderAt(col: number, row: number, layer = this.active): boolean {
    return this.layers[layer]?.ladders.has(cellKey(col, row)) ?? false;
  }

  /** Unlock a door cell on a floor: it becomes passable and its panel is removed. */
  openDoor(col: number, row: number, layer = this.active) {
    const l = this.layers[layer];
    if (!l) return;
    const key = cellKey(col, row);
    l.openDoors.add(key);
    l.doorViews.get(key)?.destroy();
    l.doorViews.delete(key);
  }

  isWallAt(col: number, row: number, layer = this.active): boolean {
    const l = this.layers[layer];
    if (!l || row < 0 || row >= l.rows.length || col < 0) return true;
    const ch = l.rows[row][col] ?? "#";
    if (ch === "#") return true;
    // A locked door blocks like a wall until it has been opened.
    if (ch === "D" && !l.openDoors.has(cellKey(col, row))) return true;
    return false;
  }

  /** AABB-vs-grid test on the active floor: is a half-size square at (cx,cy) in a wall? */
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
