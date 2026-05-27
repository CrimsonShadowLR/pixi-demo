import type { LevelDef } from "@/game/types";

// Hand-crafted fixed mazes (GDD §Levels). One victory condition each for the POC;
// survive/protect are defined in types but not yet used here.
//
// Tile legend:
//   #  wall            .  floor (or space)
//   S  player start    E  level exit (escape condition)
//   g  grunt enemy     a  archer enemy
//   c  collectible relic
//
// Rows may be ragged — the parser treats anything past a row's end as wall, so the
// only hard rules are: keep a solid border, and put exactly one S per level.

export const LEVELS: LevelDef[] = [
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
