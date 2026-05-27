import GameCanvas from "@/app/components/GameCanvas";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-900 p-4">
      <main className="flex w-full max-w-[896px] flex-col items-center gap-4">
        <GameCanvas />
        <p className="text-center text-xs text-zinc-500">
          POC of the Untitled Maze Game GDD — 2 heroes, 3 levels, built on Pixi.js.
        </p>
      </main>
    </div>
  );
}
