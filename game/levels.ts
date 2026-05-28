import type { LevelDef } from "@/game/types";

// Hand-crafted fixed mazes (GDD §Levels). One victory condition each for the POC;
// survive/protect are defined in types but not yet used here.
//
// Tile legend:
//   #  wall            .  floor (lower level)   ,  platform floor (upper level)
//   S  player start    E  level exit (escape condition)
//   g  grunt enemy     a  archer enemy          c  collectible relic
//   H  ladder (walkable; connects lower floor to the upper platform)
//   D  locked door (blocks like a wall until opened with a key)
//   k  key pickup (E to take)    q  equipable item (E to take)
//
// Rows may be ragged — the parser treats anything past a row's end as wall, so the
// only hard rules are: keep a solid border, and put exactly one S per level.

export const LEVELS: LevelDef[] = [
  {
    // Combat-free onboarding (GDD onboarding slice). Two stacked floors that
    // share one coordinate space: the ladder ("H", same cell on both floors)
    // swaps which floor is rendered, so the upper platform overlaps the ground
    // room. Floor 0 (ground): big room, spawn bottom-right. Floor 1 (platform):
    // a free room with the key and a locked vault holding the charm.
    // The charm is a mock equipable — hero-agnostic, no stat effect, and not
    // persisted, so it never carries into the real levels.
    id: 0,
    name: "Training Grounds",
    environment: "Tutorial",
    victory: "tutorial",
    objectiveText: "Climb the ladder to the platform, grab the key, open the vault, and equip the charm. No enemies here.",
    tileSize: 44,
    floors: [
      // Floor 0 — ground. Open room; ladder at (col10,row6); spawn bottom-right.
      [
        "#####################",
        "#...................#",
        "#...................#",
        "#...................#",
        "#...................#",
        "#...................#",
        "#.........H.........#",
        "#...................#",
        "#...................#",
        "#..............S....#",
        "#...................#",
        "#...................#",
        "#####################",
      ],
      // Floor 1 — upper platform (overlaps the ground room). Ladder at the same
      // (col10,row6). Free room (key) left, locked vault (door + charm) right.
      [
        "#####################",
        "#####################",
        "#####################",
        "#####################",
        "###,,,,#######,,,,###",
        "###,k,,,,,,,,D,,q,###",
        "###,,,,#,,H,,#,,,,###",
        "#####################",
        "#####################",
        "#####################",
        "#####################",
        "#####################",
        "#####################",
      ],
    ],
  },
  {
    id: 1,
    name: "Catacomb Run",
    environment: "Dungeon",
    victory: "escape",
    objectiveText: "Reach the exit before time runs out. Speed beats brawling here.",
    tileSize: 44,
    timeLimitMs: 10_000,
    layout: [
      "#####################",
      "#S..................#",
      "#..##..##..##..##....#",
      "#..................g#",
      "#..##..##..##..##....#",
      "#...................#",
      "#..##...g....##..##..#",
      "#...................#",
      "#..##..##..##..##....#",
      "#g..................#",
      "#..##..##..##..##....#",
      "#..................E#",
      "#####################",
    ],
  },
  {
    id: 2,
    name: "Warband Hall",
    environment: "Castle",
    victory: "kill_all",
    objectiveText: "Clear every hostile in the hall. A durable frontliner shines.",
    tileSize: 44,
    layout: [
      "#####################",
      "#...................#",
      "#..g.....##.....g...#",
      "#........##.........#",
      "#..####.......####..#",
      "#.........a.........#",
      "#S..................#",
      "#...................#",
      "#..####.......####..#",
      "#........##.........#",
      "#..g.....##.....g...#",
      "#...................#",
      "#####################",
    ],
  },
  {
    id: 3,
    name: "Sunken Vault",
    environment: "Ruins",
    victory: "collect",
    objectiveText: "Recover every relic. Range keeps the archers off your back.",
    tileSize: 44,
    layout: [
      "#####################",
      "#c...............c..#",
      "#...................#",
      "#..##....a....##....#",
      "#...................#",
      "#S.......c..........#",
      "#...................#",
      "#..##....a....##....#",
      "#........c..........#",
      "#...................#",
      "#c...............c..#",
      "#...................#",
      "#####################",
    ],
  },
];
