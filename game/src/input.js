// Keyboard and mouse input. Movement keys are read as a held set; action
// keys (smoke, EMP, pause, confirm) fire once per press, through a queue
// the main loop drains, so a held key never double-fires a tool.
import { setMuted, isMuted } from './audio.js';

const MOVE_KEYS = {
  ArrowUp: [0, -1],
  KeyW: [0, -1],
  ArrowDown: [0, 1],
  KeyS: [0, 1],
  ArrowLeft: [-1, 0],
  KeyA: [-1, 0],
  ArrowRight: [1, 0],
  KeyD: [1, 0],
};

export function createInput(canvas, onAction) {
  const held = new Set();
  const queue = [];
  let mouse = { x: 0, y: 0, clicked: false };

  function keyDown(event) {
    if (MOVE_KEYS[event.code]) {
      held.add(event.code);
      event.preventDefault();
      return;
    }
    if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
      held.add('Shift');
      event.preventDefault();
      return;
    }
    if (event.repeat) return;
    if (event.code === 'KeyQ') queue.push('smoke');
    else if (event.code === 'KeyE') queue.push('emp');
    else if (event.code === 'KeyF') held.add('KeyF');
    else if (event.code === 'KeyM') setMuted(!isMuted());
    else if (event.code === 'KeyP' || event.code === 'Escape') queue.push('pause');
    else if (event.code === 'Enter' || event.code === 'Space') queue.push('confirm');
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) {
      event.preventDefault();
    }
  }

  function keyUp(event) {
    held.delete(event.code);
    if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') held.delete('Shift');
    if (event.code === 'KeyF') held.delete('KeyF');
  }

  function mouseMove(event) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = event.clientX - rect.left;
    mouse.y = event.clientY - rect.top;
  }

  function mouseDown(event) {
    mouseMove(event);
    mouse.clicked = true;
  }

  window.addEventListener('keydown', keyDown);
  window.addEventListener('keyup', keyUp);
  canvas.addEventListener('mousemove', mouseMove);
  canvas.addEventListener('mousedown', mouseDown);

  return {
    moveVector() {
      let x = 0;
      let y = 0;
      for (const code of held) {
        const dir = MOVE_KEYS[code];
        if (dir) {
          x += dir[0];
          y += dir[1];
        }
      }
      if (x === 0 && y === 0) return { x: 0, y: 0 };
      const len = Math.hypot(x, y);
      return { x: x / len, y: y / len };
    },
    sprinting() {
      return held.has('Shift');
    },
    cracking() {
      return held.has('KeyF');
    },
    drainActions() {
      const out = queue.splice(0, queue.length);
      if (mouse.clicked) {
        mouse.clicked = false;
        out.push('click');
      }
      return out;
    },
    mouse() {
      return mouse;
    },
    destroy() {
      window.removeEventListener('keydown', keyDown);
      window.removeEventListener('keyup', keyUp);
      canvas.removeEventListener('mousemove', mouseMove);
      canvas.removeEventListener('mousedown', mouseDown);
    },
  };
}
