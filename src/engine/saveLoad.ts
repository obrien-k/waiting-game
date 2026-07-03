import {
  writeTextFile,
  readTextFile,
  exists,
  mkdir,
  remove,
  BaseDirectory,
} from "@tauri-apps/plugin-fs";

const APP_DIR = BaseDirectory.AppData;
const SAVES_DIR = "saves";

async function ensureSavesDir() {
  await mkdir(SAVES_DIR, { baseDir: APP_DIR, recursive: true });
}

export async function saveGame(gameId: string, state: unknown): Promise<void> {
  await ensureSavesDir();
  // Stamp lastSaveAt so the file always records "time last accounted for".
  // Offline progress (calculateOfflineProgress) measures from this; without a
  // fresh stamp it would re-simulate — and re-award — already-counted time on
  // every reopen, since tick only advances lastSaveAt on a completion/reset.
  const stamped =
    state && typeof state === "object"
      ? { ...(state as object), lastSaveAt: Date.now() }
      : state;
  await writeTextFile(`${SAVES_DIR}/${gameId}.json`, JSON.stringify(stamped), {
    baseDir: APP_DIR,
  });
}

export async function loadGame<T>(gameId: string): Promise<T | null> {
  const path = `${SAVES_DIR}/${gameId}.json`;
  const fileExists = await exists(path, { baseDir: APP_DIR });
  if (!fileExists) return null;
  const raw = await readTextFile(path, { baseDir: APP_DIR });
  return JSON.parse(raw) as T;
}

export async function deleteSave(gameId: string): Promise<void> {
  const path = `${SAVES_DIR}/${gameId}.json`;
  if (await exists(path, { baseDir: APP_DIR })) {
    await remove(path, { baseDir: APP_DIR });
  }
}

export async function saveHub(data: unknown): Promise<void> {
  await mkdir(".", { baseDir: APP_DIR, recursive: true });
  await writeTextFile("hub.json", JSON.stringify(data), { baseDir: APP_DIR });
}

export async function loadHub<T>(): Promise<T | null> {
  const fileExists = await exists("hub.json", { baseDir: APP_DIR });
  if (!fileExists) return null;
  const raw = await readTextFile("hub.json", { baseDir: APP_DIR });
  return JSON.parse(raw) as T;
}
