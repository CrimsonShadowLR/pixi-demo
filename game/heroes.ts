import type { HeroDef, HeroId } from "@/game/types";

// Three playable heroes (GDD §Heroes). Same combat vocabulary, different stat
// distributions. Each is tuned toward one victory condition but can play any level.
export const HEROES: Record<HeroId, HeroDef> = {
  warrior: {
    id: "warrior",
    name: "Warrior",
    role: "Tank / Frontliner",
    color: 0xe23b3b,
    maxHp: 160,
    speed: 2.4,
    attackType: "melee",
    damage: 34,
    attackRange: 58,
    attackCooldown: 420,
    bonusCondition: "kill_all",
    blurb: "Highest durability and melee burst. Best at clearing rooms and holding ground.",
  },
  rogue: {
    id: "rogue",
    name: "Rogue",
    role: "Scout / Escape Artist",
    color: 0x39c06a,
    maxHp: 95,
    speed: 4.1,
    attackType: "melee",
    damage: 22,
    attackRange: 46,
    attackCooldown: 260,
    bonusCondition: "escape",
    blurb: "Fast and slippery with quick strikes. Built to slip past patrols and reach the exit.",
  },
  ranger: {
    id: "ranger",
    name: "Ranger",
    role: "Hunter / Collector",
    color: 0x3b82e2,
    maxHp: 110,
    speed: 3.0,
    attackType: "ranged",
    damage: 20,
    attackRange: 26,
    attackCooldown: 360,
    bonusCondition: "collect",
    blurb: "Engages safely from range. Efficient explorer for hunting down scattered objectives.",
  },
};

export const HERO_ORDER: HeroId[] = ["warrior", "rogue", "ranger"];
