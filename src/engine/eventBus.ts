import { emit, listen } from "@tauri-apps/api/event";
import type { GameTickBroadcast } from "./types";

// BroadcastChannel for high-frequency tick state (hub card live previews)
const channel = new BroadcastChannel("waiting-game-ticks");

export function broadcastTick(gameId: string, state: unknown) {
  const payload: GameTickBroadcast = { gameId, state, timestamp: Date.now() };
  channel.postMessage(payload);
}

export function onTickBroadcast(
  gameId: string,
  cb: (state: unknown) => void
): () => void {
  const handler = (event: MessageEvent<GameTickBroadcast>) => {
    if (event.data.gameId === gameId) {
      cb(event.data.state);
    }
  };
  channel.addEventListener("message", handler);
  return () => channel.removeEventListener("message", handler);
}

// Tauri events for low-frequency cross-window events (gold earned, etc.)

export interface GoldEarnedPayload {
  gameId: string;
  amount: number;
}

export async function emitGoldEarned(gameId: string, amount: number) {
  await emit("gold-earned", { gameId, amount } satisfies GoldEarnedPayload);
}

export async function onGoldEarned(
  cb: (payload: GoldEarnedPayload) => void
): Promise<() => void> {
  const unlisten = await listen<GoldEarnedPayload>("gold-earned", (event) => {
    cb(event.payload);
  });
  return unlisten;
}

export async function emitSaveRequested(gameId: string) {
  await emit("save-requested", { gameId });
}

export async function onSaveRequested(
  gameId: string,
  cb: () => void
): Promise<() => void> {
  const unlisten = await listen<{ gameId: string }>(
    "save-requested",
    (event) => {
      if (event.payload.gameId === gameId) cb();
    }
  );
  return unlisten;
}

export async function emitOfflineMessage(message: string) {
  await emit("offline-message", { message });
}

export async function onOfflineMessage(
  cb: (message: string) => void
): Promise<() => void> {
  const unlisten = await listen<{ message: string }>(
    "offline-message",
    (event) => cb(event.payload.message)
  );
  return unlisten;
}
