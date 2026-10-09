// Keyboard and mouse state with pointer-lock mouse look.
export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set();
  const state = {
    keys, pressed,
    mouse: { x: 0, y: 0, nx: 0, ny: 0, dx: 0, dy: 0, buttons: 0, wheel: 0, clicked: false, rightClicked: false },
    locked: false,
    enabled: true,
    wantLock: false,
  };

  addEventListener('keydown', (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (!keys.has(e.code)) pressed.add(e.code);
    keys.add(e.code);
    if (['Space', 'Tab'].includes(e.code)) e.preventDefault();
  });
  addEventListener('keyup', (e) => keys.delete(e.code));
  addEventListener('blur', () => keys.clear());

  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    state.mouse.x = e.clientX - r.left;
    state.mouse.y = e.clientY - r.top;
    state.mouse.nx = (state.mouse.x / r.width) * 2 - 1;
    state.mouse.ny = -(state.mouse.y / r.height) * 2 + 1;
  });
  addEventListener('mousemove', (e) => {
    if (state.locked || state.mouse.buttons & 2) {
      state.mouse.dx += e.movementX || 0;
      state.mouse.dy += e.movementY || 0;
    }
  });
  canvas.addEventListener('mousedown', (e) => {
    state.mouse.buttons |= 1 << e.button;
    if (e.button === 0) state.mouse.clicked = true;
    if (e.button === 2) state.mouse.rightClicked = true;
    if (state.wantLock && !state.locked && e.button === 0) lock();
  });
  addEventListener('mouseup', (e) => { state.mouse.buttons &= ~(1 << e.button); });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('wheel', (e) => { state.mouse.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });

  function lock() {
    try {
      const p = canvas.requestPointerLock?.();
      if (p && p.catch) p.catch(() => {});
    } catch (e) { /* pointer lock is optional */ }
  }
  function unlock() { if (document.pointerLockElement) document.exitPointerLock(); }
  document.addEventListener('pointerlockchange', () => { state.locked = document.pointerLockElement === canvas; });

  state.lock = lock;
  state.unlock = unlock;
  state.down = (code) => keys.has(code);
  state.hit = (code) => pressed.has(code);
  state.endFrame = () => {
    pressed.clear();
    state.mouse.dx = state.mouse.dy = 0;
    state.mouse.wheel = 0;
    state.mouse.clicked = state.mouse.rightClicked = false;
  };
  return state;
}
