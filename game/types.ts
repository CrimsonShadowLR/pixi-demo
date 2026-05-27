// Shared game types. Pure data — no Pixi imports here so the model stays
// reasoning-friendly and engine code can depend on it freely.

export type HeroId = "warrior" | "rogue" | "ranger";

export type VictoryType = "escape" | "kill_all" | "collect" | "survive" | "protect";

export interface HeroDef {
  id: HeroId;
  name: string;
  role: string;
  /** Body fill color (Pixi hex). */
  color: number;
  maxHp: number;
  /** Pixels per 60fps-frame; multiplied by the frame's deltaTime at runtime. */
  speed: number;
  attackType: "melee" | "ranged";
  damage: number;
  /** Melee reach, or projectile spawn offset for ranged. */
  attackRange: number;
  /** Milliseconds between attacks. */
  attackCooldown: number;
  /** Victory condition this hero is statistically built for (GDD §Heroes). */
  bonusCondition: VictoryType;
  blurb: string;
}

export interface LevelDef {
  id: number;
  name: string;
  environment: string;
  victory: VictoryType;
  objectiveText: string;
  tileSize: number;
  /** Rows of tile glyphs. Legend in game/Maze.ts. */
  layout: string[];
}

/** Snapshot pushed from the engine to the React HUD overlay. */
export interface HudState {
  heroName: string;
  hp: number;
  maxHp: number;
  objective: string;
  /** Short progress string, e.g. "Enemies 2/5" or "Relics 3/6". */
  progress: string;
}

export type GameResult = "win" | "lose";

export interface GameHooks {
  onHud: (s: HudState) => void;
  onResult: (r: GameResult) => void;
}
