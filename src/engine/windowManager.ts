import { WebviewWindow } from "@tauri-apps/api/webviewWindow";

const GAME_WINDOW_DEFAULTS = {
  width: 420,
  height: 660,
  resizable: true,
  alwaysOnTop: true,
  decorations: false,
} as const;

export async function openGameWindow(
  gameId: string,
  title: string,
  size?: { width: number; height: number }
) {
  const label = `game-${gameId}`;

  const existing = await WebviewWindow.getByLabel(label);
  if (existing) {
    await existing.setFocus();
    return;
  }

  const win = new WebviewWindow(label, {
    url: "/",
    title,
    width: size?.width ?? GAME_WINDOW_DEFAULTS.width,
    height: size?.height ?? GAME_WINDOW_DEFAULTS.height,
    resizable: GAME_WINDOW_DEFAULTS.resizable,
    alwaysOnTop: GAME_WINDOW_DEFAULTS.alwaysOnTop,
    decorations: GAME_WINDOW_DEFAULTS.decorations,
  });

  win.once("tauri://error", (e) => {
    console.error(`Failed to create window ${label}:`, e);
  });
}

export async function closeGameWindow(gameId: string) {
  const label = `game-${gameId}`;
  const win = await WebviewWindow.getByLabel(label);
  if (win) await win.close();
}

export async function isGameWindowOpen(gameId: string): Promise<boolean> {
  const win = await WebviewWindow.getByLabel(`game-${gameId}`);
  return win !== null;
}

/**
 * Game ids that currently have a live pop-out window. Used by the hub to
 * reconcile `openWindowIds` on startup — that set is in-memory only, so after a
 * hub reload it would otherwise show as empty and re-enable focus for a game
 * that's still popped out, letting two shells write the same save.
 */
export async function listOpenGameIds(): Promise<string[]> {
  const all = await WebviewWindow.getAll();
  return all
    .map((w) => w.label)
    .filter((label) => label.startsWith("game-"))
    .map((label) => label.slice("game-".length));
}
