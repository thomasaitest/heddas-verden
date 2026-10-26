/** Touch joystick, jump button, keyboard and camera drag/pinch. */
export interface InputState {
  move: { x: number; y: number };
  jump: boolean;
  jumpPressed: boolean;
  camDX: number;
  camDY: number;
  zoom: number;
}

export interface TapInfo {
  x: number;
  y: number;
}

export class Input {
  state: InputState = { move: { x: 0, y: 0 }, jump: false, jumpPressed: false, camDX: 0, camDY: 0, zoom: 0 };
  private keys = new Set<string>();
  private joyId: number | null = null;
  private joyCenter = { x: 0, y: 0 };
  private joyVec = { x: 0, y: 0 };
  private camPointers = new Map<number, { x: number; y: number; sx: number; sy: number; t: number; moved: boolean }>();
  private pinchDist = 0;
  /** Called on a short tap on the 3D view (for picking). Return true if the tap was used. */
  onTap: ((t: TapInfo) => void) | null = null;
  /** Called when a drag starts on the 3D view; return true to take over the drag (e.g. moving furniture). */
  onDragStart: ((t: TapInfo) => boolean) | null = null;
  onDragMove: ((t: TapInfo) => void) | null = null;
  onDragEnd: (() => void) | null = null;
  private dragOwned = false;
  enabled = true;

  constructor(canvas: HTMLElement, joyBase: HTMLElement, private joyKnob: HTMLElement, jumpBtn: HTMLElement) {
    window.addEventListener('keydown', (e) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      this.keys.add(e.code);
      if (e.code === 'Space') {
        if (!this.state.jump) this.state.jumpPressed = true;
        this.state.jump = true;
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      if (e.code === 'Space') this.state.jump = false;
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.state.jump = false;
    });

    const zone = joyBase.parentElement!;
    zone.addEventListener('pointerdown', (e) => {
      if (this.joyId !== null) return;
      this.joyId = e.pointerId;
      zone.setPointerCapture(e.pointerId);
      const r = joyBase.getBoundingClientRect();
      this.joyCenter = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      this.updateJoy(e.clientX, e.clientY);
      e.preventDefault();
    });
    zone.addEventListener('pointermove', (e) => {
      if (e.pointerId === this.joyId) this.updateJoy(e.clientX, e.clientY);
    });
    const endJoy = (e: PointerEvent) => {
      if (e.pointerId !== this.joyId) return;
      this.joyId = null;
      this.joyVec = { x: 0, y: 0 };
      this.joyKnob.style.transform = 'translate(-50%, -50%)';
    };
    zone.addEventListener('pointerup', endJoy);
    zone.addEventListener('pointercancel', endJoy);

    jumpBtn.addEventListener('pointerdown', (e) => {
      this.state.jump = true;
      this.state.jumpPressed = true;
      jumpBtn.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    const endJump = () => (this.state.jump = false);
    jumpBtn.addEventListener('pointerup', endJump);
    jumpBtn.addEventListener('pointercancel', endJump);

    canvas.addEventListener('pointerdown', (e) => {
      canvas.setPointerCapture(e.pointerId);
      this.camPointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), moved: false });
      if (this.camPointers.size === 2) {
        const [a, b] = [...this.camPointers.values()];
        this.pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
      } else if (this.camPointers.size === 1) {
        this.dragOwned = this.onDragStart?.({ x: e.clientX, y: e.clientY }) ?? false;
      }
    });
    canvas.addEventListener('pointermove', (e) => {
      const p = this.camPointers.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x;
      const dy = e.clientY - p.y;
      p.x = e.clientX;
      p.y = e.clientY;
      if (Math.hypot(p.x - p.sx, p.y - p.sy) > 8) p.moved = true;
      if (this.camPointers.size === 2) {
        const [a, b] = [...this.camPointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        this.state.zoom += (this.pinchDist - d) * 0.05;
        this.pinchDist = d;
        return;
      }
      if (this.dragOwned) this.onDragMove?.({ x: e.clientX, y: e.clientY });
      else {
        this.state.camDX += dx;
        this.state.camDY += dy;
      }
    });
    const endCam = (e: PointerEvent) => {
      const p = this.camPointers.get(e.pointerId);
      if (!p) return;
      this.camPointers.delete(e.pointerId);
      if (this.dragOwned && this.camPointers.size === 0) {
        this.dragOwned = false;
        this.onDragEnd?.();
      }
      if (!p.moved && performance.now() - p.t < 450) this.onTap?.({ x: e.clientX, y: e.clientY });
    };
    canvas.addEventListener('pointerup', endCam);
    canvas.addEventListener('pointercancel', endCam);
    canvas.addEventListener(
      'wheel',
      (e) => {
        this.state.zoom += e.deltaY * 0.01;
        e.preventDefault();
      },
      { passive: false },
    );
  }

  private updateJoy(x: number, y: number) {
    const max = 50;
    let dx = x - this.joyCenter.x;
    let dy = y - this.joyCenter.y;
    const len = Math.hypot(dx, dy);
    if (len > max) {
      dx = (dx / len) * max;
      dy = (dy / len) * max;
    }
    this.joyVec = { x: dx / max, y: dy / max };
    this.joyKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  }

  /** Read and reset per-frame values. */
  poll(): InputState {
    let x = this.joyVec.x;
    let y = this.joyVec.y;
    const k = this.keys;
    if (k.has('KeyA') || k.has('ArrowLeft')) x -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) x += 1;
    if (k.has('KeyW') || k.has('ArrowUp')) y -= 1;
    if (k.has('KeyS') || k.has('ArrowDown')) y += 1;
    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    this.state.move = this.enabled ? { x, y } : { x: 0, y: 0 };
    const out = { ...this.state, move: { ...this.state.move } };
    this.state.jumpPressed = false;
    this.state.camDX = 0;
    this.state.camDY = 0;
    this.state.zoom = 0;
    return out;
  }

  keyDown(code: string): boolean {
    return this.keys.has(code);
  }
}
