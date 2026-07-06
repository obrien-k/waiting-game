import { useGameRegistry, type GameRegistryState } from "@/store/gameRegistry";
import { isExternalPlugin, resolveTrustTier } from "@/engine/pluginTrust";
import { GameWindowShell } from "./GameWindowShell";
import { IframeGameShell } from "./IframeGameShell";

interface Props {
  gameId: string;
}

export function GameWindowApp({ gameId }: Props) {
  const plugin = useGameRegistry((s: GameRegistryState) => s.plugins[gameId]);

  if (!plugin) {
    return (
      <div className="h-full flex items-center justify-center text-white/40 bg-[var(--color-surface)]">
        <div className="text-center">
          <div className="text-4xl mb-2">?</div>
          <div>Unknown game: {gameId}</div>
        </div>
      </div>
    );
  }

  // Tier branch: untrusted plugins never touch the native shell (and its
  // capability inheritance) — they render sandboxed. `resolveTrustTier` also
  // demotes a native plugin whose id fell off the allowlist, so an external
  // descriptor and a de-listed native both land on the iframe path.
  if (isExternalPlugin(plugin) || resolveTrustTier(plugin) === "untrusted") {
    if (!isExternalPlugin(plugin)) {
      return (
        <div className="h-full flex items-center justify-center text-white/40 bg-[var(--color-surface)]">
          Untrusted native plugin “{gameId}” cannot run.
        </div>
      );
    }
    return <IframeGameShell plugin={plugin} isPopOut />;
  }

  return <GameWindowShell plugin={plugin} />;
}
