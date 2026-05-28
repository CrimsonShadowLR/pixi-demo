"use client";

import { useEffect, useRef, useState } from "react";
import { Application } from "pixi.js";
import { Game } from "@/game/Game";
import { HEROES, HERO_ORDER } from "@/game/heroes";
import { LEVELS } from "@/game/levels";
import type { HeroId, HudState, VictoryType } from "@/game/types";

const VIEW_W = 896;
const VIEW_H = 572; // matches the 13-row * 44px maze height

type Screen = "menu" | "playing" | "win" | "lose";

function recommendedHero(victory: VictoryType): string {
  const hero = HERO_ORDER.map((id) => HEROES[id]).find((h) => h.bonusConditions.includes(victory));
  return hero?.name ?? "Any";
}

export default function GameCanvas() {
  const hostRef = useRef<HTMLDivElement>(null);
  const [screen, setScreen] = useState<Screen>("menu");
  const [heroId, setHeroId] = useState<HeroId>("warrior");
  const [levelId, setLevelId] = useState<number>(1);
  const [runKey, setRunKey] = useState(0);
  const [hud, setHud] = useState<HudState | null>(null);

  const level = LEVELS.find((l) => l.id === levelId) ?? LEVELS[0];
  const hero = HEROES[heroId];

  // Pixi lifecycle — only alive while actually playing. heroId/levelId/runKey
  // are deps so a retry or level change tears down and rebuilds cleanly.
  useEffect(() => {
    if (screen !== "playing") return;
    let cancelled = false;
    let game: Game | null = null;
    const app = new Application();

    app
      .init({ width: VIEW_W, height: VIEW_H, background: 0x0b0d12, antialias: true })
      .then(() => {
        if (cancelled) {
          app.destroy(true);
          return;
        }
        const canvas = app.canvas as HTMLCanvasElement;
        canvas.style.maxWidth = "100%";
        canvas.style.height = "auto";
        canvas.style.display = "block";
        canvas.style.borderRadius = "12px";
        hostRef.current?.appendChild(canvas);
        game = new Game(app, level, hero, {
          onHud: (s) => setHud(s),
          onResult: (r) => setScreen(r),
        });
      });

    return () => {
      cancelled = true;
      game?.destroy();
      try {
        app.destroy(true, { children: true });
      } catch {
        /* app may not have finished init() */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, heroId, levelId, runKey]);

  const start = () => {
    setHud(null);
    setRunKey((k) => k + 1);
    setScreen("playing");
  };

  const nextLevel = LEVELS.find((l) => l.id === levelId + 1);
  const hpPct = hud ? Math.max(0, (hud.hp / hud.maxHp) * 100) : 100;

  return (
    <div className="w-full max-w-[896px]">
      {/* Status bar — lives ABOVE the canvas so it never covers the maze */}
      {screen === "playing" && hud && (
        <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-black/60 px-4 py-2 font-mono text-sm text-white">
          <span className="font-semibold">{hud.heroName}</span>
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-36 overflow-hidden rounded-full bg-white/20">
              <div
                className="h-full rounded-full bg-emerald-400 transition-[width] duration-150"
                style={{ width: `${hpPct}%` }}
              />
            </div>
            <span>
              {hud.hp}/{hud.maxHp}
            </span>
          </div>
          <span className="text-amber-300">{hud.progress}</span>
          {hud.timer && (
            <span className={`font-semibold ${hud.timerUrgent ? "animate-pulse text-rose-400" : "text-sky-300"}`}>
              Time {hud.timer}
            </span>
          )}
          <span className="ml-auto hidden text-xs text-zinc-400 sm:block">WASD move · Left-click attack · Right-click ability · E interact</span>
        </div>
      )}

      {/* Canvas + full-cover overlays (menu, results) */}
      <div className="relative w-full" style={{ aspectRatio: `${VIEW_W} / ${VIEW_H}` }}>
        <div ref={hostRef} className="h-full w-full" />

        {/* Contextual interaction prompt (tutorial E-hints) */}
        {screen === "playing" && hud?.prompt && (
          <div className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center">
            <span className="rounded-full bg-black/75 px-4 py-1.5 font-mono text-sm font-semibold text-amber-300 shadow-lg ring-1 ring-amber-300/30">
              {hud.prompt}
            </span>
          </div>
        )}

      {/* Pre-level menu */}
      {screen === "menu" && (
        <div className="absolute inset-0 flex flex-col gap-5 overflow-auto rounded-xl bg-zinc-950/95 p-6 text-white">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Untitled Maze Game — POC</h2>
            <p className="text-sm text-zinc-400">Pick a hero, pick a maze, then escape, clear, or loot your way out.</p>
          </div>

          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-zinc-500">Hero</h3>
            <div className="grid grid-cols-3 gap-3">
              {HERO_ORDER.map((id) => {
                const h = HEROES[id];
                const active = id === heroId;
                return (
                  <button
                    key={id}
                    onClick={() => setHeroId(id)}
                    className={`rounded-lg border p-3 text-left transition-colors ${
                      active ? "border-white bg-white/10" : "border-white/15 hover:border-white/40"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block h-4 w-4 rounded-full"
                        style={{ backgroundColor: `#${h.color.toString(16).padStart(6, "0")}` }}
                      />
                      <span className="font-semibold">{h.name}</span>
                    </div>
                    <div className="mt-0.5 text-[11px] text-zinc-400">{h.role}</div>
                    <div className="mt-2 text-xs leading-snug text-zinc-300">{h.blurb}</div>
                    <div className="mt-2 text-[11px] text-zinc-500">
                      HP {h.maxHp} · {h.attackType} · DMG {h.damage}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-zinc-500">Level</h3>
            <div className="grid grid-cols-3 gap-3">
              {LEVELS.map((l) => {
                const active = l.id === levelId;
                return (
                  <button
                    key={l.id}
                    onClick={() => setLevelId(l.id)}
                    className={`rounded-lg border p-3 text-left transition-colors ${
                      active ? "border-white bg-white/10" : "border-white/15 hover:border-white/40"
                    }`}
                  >
                    <div className="font-semibold">
                      {l.id}. {l.name}
                    </div>
                    <div className="mt-0.5 text-[11px] text-zinc-400">{l.environment}</div>
                    <div className="mt-2 text-xs leading-snug text-zinc-300">{l.objectiveText}</div>
                    <div className="mt-2 text-[11px] text-emerald-400">Recommended: {recommendedHero(l.victory)}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <button
            onClick={start}
            className="mt-auto self-start rounded-full bg-emerald-500 px-8 py-2.5 font-semibold text-black transition-colors hover:bg-emerald-400"
          >
            Enter the maze →
          </button>
        </div>
      )}

      {/* Win / lose overlay */}
      {(screen === "win" || screen === "lose") && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 rounded-xl bg-black/80 text-center text-white">
          <div className={`text-4xl font-black ${screen === "win" ? "text-emerald-400" : "text-rose-400"}`}>
            {screen === "win" ? "Victory" : "Defeated"}
          </div>
          <p className="max-w-sm text-sm text-zinc-300">
            {screen === "win" ? `${hero.name} cleared ${level.name}.` : `${hero.name} fell in ${level.name}.`}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {screen === "win" && nextLevel && (
              <button
                onClick={() => {
                  setLevelId(nextLevel.id);
                  setHud(null);
                  setRunKey((k) => k + 1);
                  setScreen("playing");
                }}
                className="rounded-full bg-emerald-500 px-6 py-2 font-semibold text-black hover:bg-emerald-400"
              >
                Next: {nextLevel.name}
              </button>
            )}
            <button onClick={start} className="rounded-full border border-white/30 px-6 py-2 font-semibold hover:border-white">
              {screen === "win" ? "Replay" : "Retry"}
            </button>
            <button
              onClick={() => setScreen("menu")}
              className="rounded-full border border-white/30 px-6 py-2 font-semibold hover:border-white"
            >
              Menu
            </button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
