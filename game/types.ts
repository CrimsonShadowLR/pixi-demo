// Shared game types. Pure data — no Pixi imports here so the model stays
// reasoning-friendly and engine code can depend on it freely.

export type HeroId = "warrior" | "scout" | "guardian";

export type VictoryType = "escape" | "kill_all" | "collect" | "survive" | "protect";

/** An active ability fired with the ability key (separate from the basic attack). */
export interface HeroAbility {
  /** Radial knockback burst around the hero. */
  type: "push";
  /** Effect radius in pixels. */
  radius: number;
  /** Distance, in pixels, enemies are shoved outward. */
  knockback: number;
  /** Cooldown in milliseconds. */
  cooldownMs: number;
  /** Damage dealt as a fraction of the hero's normal `damage`. */
  damageFraction: number;
}

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
  /**
   * Melee cone width as a dot-product threshold: a hit lands when
   * dot(facing, dirToEnemy) >= this. Lower = wider swing. Defaults to 0.25.
   */
  attackArc?: number;
  /** If set, melee hits stun the enemy for this many ms. */
  stunMs?: number;
  /** Optional active ability fired with the ability key. */
  ability?: HeroAbility;
  /** Milliseconds between attacks. */
  attackCooldown: number;
  /** Victory conditions this hero is statistically built for (GDD §Heroes). */
  bonusConditions: VictoryType[];
  blurb: string;
}

export interface LevelDef {
  id: number;
  name: string;
  environment: string;
  victory: VictoryType;
  objectiveText: string;
  tileSize: number;
  /** Optional countdown in ms; if the player does not win before it hits 0, they lose. */
  timeLimitMs?: number;
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
  /** Remaining time as M:SS — only present on timed levels. */
  timer?: string;
  /** True when remaining time is low, so the HUD can highlight it. */
  timerUrgent?: boolean;
}

export type GameResult = "win" | "lose";

export interface GameHooks {
  onHud: (s: HudState) => void;
  onResult: (r: GameResult) => void;
}
