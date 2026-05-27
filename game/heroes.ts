import type { HeroDef, HeroId } from "@/game/types";

// Two playable heroes (GDD §Heroes). Same combat vocabulary, different stat
// distributions. Each can play any level but is tuned toward certain conditions.
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
    attackRange: 82,
    attackArc: -0.35, // wide ~110-deg sweep — cleaves a crowd
    stunMs: 500,
    attackCooldown: 420,
    bonusConditions: ["kill_all", "survive"],
    blurb: "Wide cleaving swing that stuns. Highest durability — best at clearing rooms and holding ground.",
  },
  guardian: {
    id: "guardian",
    name: "Guardian",
    role: "Tank / Protector",
    color: 0xf2b134,
    maxHp: 190,
    speed: 2.0,
    attackType: "melee",
    damage: 28,
    attackRange: 60,
    attackCooldown: 450,
    // 360 push: shoves every enemy within ~3 tiles outward for half attack damage.
    ability: { type: "push", radius: 132, knockback: 90, cooldownMs: 4000, damageFraction: 0.5 },
    bonusConditions: ["protect", "survive"],
    blurb: "Slow, near-unkillable bulwark. A 360 shockwave (right-click) shoves the whole crowd back. Best at protecting and surviving.",
  },
  scout: {
    id: "scout",
    name: "Scout",
    role: "Skirmisher / Explorer",
    color: 0x2ec4b6,
    maxHp: 100,
    speed: 3.6,
    attackType: "ranged",
    damage: 21,
    attackRange: 26,
    attackCooldown: 300,
    bonusConditions: ["escape", "collect"],
    blurb: "Fast and ranged — kites enemies and covers ground. Built to slip to the exit and hunt down objectives.",
  },
};

export const HERO_ORDER: HeroId[] = ["warrior", "scout", "guardian"];
