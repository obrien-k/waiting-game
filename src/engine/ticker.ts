export type TickFn = (deltaMs: number) => void;

const MAX_DELTA_MS = 5000;
const TICK_INTERVAL_MS = 250;

export class GameTicker {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private lastTimestamp: number | null = null;

  constructor(private readonly onTick: TickFn) {}

  start() {
    if (this.intervalId !== null) return;
    this.lastTimestamp = Date.now();

    this.intervalId = setInterval(() => {
      const now = Date.now();
      const delta = Math.min(now - (this.lastTimestamp ?? now), MAX_DELTA_MS);
      this.lastTimestamp = now;
      this.onTick(delta);
    }, TICK_INTERVAL_MS);
  }

  stop() {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.lastTimestamp = null;
    }
  }

  get isRunning() {
    return this.intervalId !== null;
  }
}
