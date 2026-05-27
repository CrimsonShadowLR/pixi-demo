// Input: WASD / arrows move (keyboard), left-click attacks and right-click uses
// the ability (mouse, bound to the game canvas). Returns a live state object plus
// a destroy() to unbind every listener.

export interface InputState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  attack: boolean;
  ability: boolean;
}

export interface InputHandle {
  state: InputState;
  destroy: () => void;
}

export function createInput(target: HTMLElement): InputHandle {
  const state: InputState = { up: false, down: false, left: false, right: false, attack: false, ability: false };

  // --- Keyboard: movement only ---
  const setMove = (code: string, down: boolean): boolean => {
    switch (code) {
      case "KeyW":
      case "ArrowUp":
        state.up = down;
        return true;
      case "KeyS":
      case "ArrowDown":
        state.down = down;
        return true;
      case "KeyA":
      case "ArrowLeft":
        state.left = down;
        return true;
      case "KeyD":
      case "ArrowRight":
        state.right = down;
        return true;
      default:
        return false;
    }
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (setMove(e.code, true)) e.preventDefault(); // stop arrow-key page scroll
  };
  const onKeyUp = (e: KeyboardEvent) => {
    if (setMove(e.code, false)) e.preventDefault();
  };

  // --- Mouse: left = attack, right = ability ---
  const onMouseDown = (e: MouseEvent) => {
    if (e.button === 0) state.attack = true;
    else if (e.button === 2) {
      state.ability = true;
      e.preventDefault();
    }
  };
  // Release on window so a button held and dragged off the canvas still clears.
  const onMouseUp = (e: MouseEvent) => {
    if (e.button === 0) state.attack = false;
    else if (e.button === 2) state.ability = false;
  };
  const onContextMenu = (e: MouseEvent) => e.preventDefault(); // no right-click menu over the game

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  target.addEventListener("mousedown", onMouseDown);
  target.addEventListener("contextmenu", onContextMenu);
  window.addEventListener("mouseup", onMouseUp);

  return {
    state,
    destroy: () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      target.removeEventListener("mousedown", onMouseDown);
      target.removeEventListener("contextmenu", onContextMenu);
      window.removeEventListener("mouseup", onMouseUp);
    },
  };
}
