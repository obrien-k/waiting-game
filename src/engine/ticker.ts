export type TickFn = (deltaMs: number) => void;

const MAX_DELTA_MS = 5000;

export class GameTicker {
  private rafId: number | null = null;
  private lastTimestamp: number | null = null;

  constructor(private readonly onTick: TickFn) {}

  start() {
    if (this.rafId !== null) return;

    const loop = (timestamp: number) => {
      if (this.lastTimestamp !== null) {
        const delta = Math.min(timestamp - this.lastTimestamp, MAX_DELTA_MS);
        this.onTick(delta);
      }
      this.lastTimestamp = timestamp;
      this.rafId = requestAnimationFrame(loop);
    };

    this.rafId = requestAnimationFrame(loop);
  }

  stop() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
      this.lastTimestamp = null;
    }
  }

  get isRunning() {
    return this.rafId !== null;
  }
}
