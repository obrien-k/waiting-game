// Regression: an async hydrateState that wasn't awaited left `state` as a Promise,
// whose `.ownedUpgradeIds` was undefined — `getOwnedUpgradeInstances` then threw and,
// with no error boundary, blanked the whole window. The on-disk fallout was a save
// file containing only `{lastSaveAt}` (a Promise spread to nothing, then stamped).
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";

const invokeMock = vi.fn();
const loadGameMock = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({ invoke: (...a: unknown[]) => invokeMock(...a) }));
vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    label: "game-amusement-park",
    listen: vi.fn().mockResolvedValue(() => {}),
    destroy: vi.fn(),
    setAlwaysOnTop: vi.fn(),
    startDragging: vi.fn(),
  }),
}));
vi.mock("@/engine/saveLoad", () => ({
  loadGame: (...a: unknown[]) => loadGameMock(...a),
  saveGame: vi.fn(),
}));
vi.mock("@/engine/eventBus", () => ({
  broadcastTick: vi.fn(),
  emitGoldEarned: vi.fn(),
  emitCrystalEarned: vi.fn(),
  emitWindowClosed: vi.fn(),
  emitOfflineMessage: vi.fn(),
  onTickBroadcast: vi.fn(() => () => {}),
}));
vi.mock("@/store/hubStore", () => ({
  useHubStore: Object.assign(
    (sel: (s: unknown) => unknown) => sel({ gold: { balance: 0 }, hydrate: vi.fn(), spendGold: vi.fn() }),
    { getState: () => ({ hydrate: vi.fn(), spendGold: vi.fn() }) }
  ),
}));

import { GameWindowShell } from "./GameWindowShell";
import amusementParkPlugin from "@/games/amusement-park";
import type { MiniGamePlugin } from "@/engine/types";

// The corrupted save that the original bug wrote to disk.
const CORRUPTED_SAVE = { lastSaveAt: 1782695863154 };

beforeEach(() => {
  invokeMock.mockReset();
  invokeMock.mockResolvedValue({
    guestsServed: 100, guestsAbandoned: 5, goldEarned: 1000, newQueueLength: 3, timeSimulatedSeconds: 297737,
  });
  loadGameMock.mockReset();
});

describe("GameWindowShell — async hydration + corrupted save", () => {
  it("awaits async hydrateState and renders the game from a corrupted save", async () => {
    loadGameMock.mockResolvedValue(CORRUPTED_SAVE);
    const { container } = render(<GameWindowShell plugin={amusementParkPlugin as never} />);
    await waitFor(() => expect(container.textContent).not.toContain("Loading"), { timeout: 2000 });
    // Hydration backfills defaults, so no undefined-driven NaN reaches the UI.
    expect(container.textContent).not.toContain("NaN");
  });

  it("contains a throwing plugin in the error boundary instead of blanking the window", async () => {
    loadGameMock.mockResolvedValue(null);
    const throwingPlugin: MiniGamePlugin = {
      ...(amusementParkPlugin as MiniGamePlugin),
      Component: () => {
        throw new Error("boom");
      },
    };
    const { container } = render(<GameWindowShell plugin={throwingPlugin as never} />);
    await waitFor(() => expect(container.textContent).toContain("This game hit an error"), { timeout: 2000 });
  });
});
