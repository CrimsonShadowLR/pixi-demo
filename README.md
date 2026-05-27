# Untitled Maze Game — POC

A playable proof-of-concept for a top-down 2D **maze game**, built on **Pixi.js** inside a
**Next.js** app. Pick a hero, drop into a hand-crafted maze, and win by escaping, clearing
the room, or looting every relic. Built from the design in
[`GDD_Untitled_Maze_Game.md`](./GDD_Untitled_Maze_Game.md).

## Gameplay

Pick a hero and a level on the pre-game screen, then play in real time. Fog of war keeps a
vision circle around you; the rest of the maze is dimmed.

### Heroes

| Hero | Style | Good at |
|---|---|---|
| **Warrior** | Tank · melee | Wide cleaving swing that **stuns** enemies; high HP. Clearing rooms, holding ground. |
| **Scout** | Skirmisher · ranged | Fast movement, kiting projectiles. Reaching the exit and hunting objectives. |

### Levels

| # | Level | Win by | Notes |
|---|---|---|---|
| 1 | Catacomb Run | **Escape** — reach the exit | 10-second countdown; run out of time and you lose |
| 2 | Warband Hall | **Kill all** enemies | Grunts + kiting archers |
| 3 | Sunken Vault | **Collect** every relic | Archers guard the loot |

### Controls

| Action | Keys |
|---|---|
| Move | `W` `A` `S` `D` or arrow keys |
| Attack | `J` or `Space` |

## Tech stack

- [Next.js 16](https://nextjs.org) (App Router) + React 19
- [Pixi.js 8](https://pixijs.com) for canvas rendering
- TypeScript (strict) and Tailwind CSS v4
- pnpm

## Getting started

```bash
pnpm install
pnpm dev        # dev server → http://localhost:3000
pnpm build      # production build
pnpm lint       # eslint
```

## How it works

The game engine lives in [`game/`](./game) and is framework-agnostic (no React):

- `Game.ts` — the orchestrator: ticker loop, camera, fog of war, combat resolution, and
  win/lose (including the level timer)
- `Maze.ts` — parses a level's tile layout into a wall grid + spawns and renders it
- `Player.ts` / `Enemy.ts` / `Projectile.ts` — entities, movement, AI, and combat
- `heroes.ts` / `levels.ts` / `types.ts` — data: hero stats and hand-crafted maze layouts
- `input.ts` — keyboard handling

React only owns the shell: [`app/components/GameCanvas.tsx`](./app/components/GameCanvas.tsx)
mounts the Pixi `Application` in an effect (canvas is client-only), renders the menu / HUD /
result overlays, and relays state between the engine and the UI.

## Scope

This is a POC, not the full game. Compared to the GDD, it currently leaves out: survive /
protect victory conditions, gear and ability progression, the pre-level loadout screen, the
hidden minimap pickup, boss phases, and mobile controls.
