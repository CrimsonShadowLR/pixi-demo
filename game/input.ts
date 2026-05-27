// Keyboard input. WASD / arrows to move, J or Space to attack.
// Returns a live state object plus a destroy() to unbind listeners.

export interface InputState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  attack: boolean;
}

export interface InputHandle {
  state: InputState;
  destroy: () => void;
}

export function createInput(): InputHandle {
  const state: InputState = { up: false, down: false, left: false, right: false, attack: false };

  const set = (code: string, down: boolean): boolean => {
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
      case "KeyJ":
      case "Space":
        state.attack = down;
        return true;
      default:
        return false;
    }
  };

  const onDown = (e: KeyboardEvent) => {
    // Ignore auto-repeat so it does not spam, and stop the page from scrolling.
    if (set(e.code, true)) e.preventDefault();
  };
  const onUp = (e: KeyboardEvent) => {
    if (set(e.code, false)) e.preventDefault();
  };

  window.addEventListener("keydown", onDown);
  window.addEventListener("keyup", onUp);

  return {
    state,
    destroy: () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    },
  };
}
