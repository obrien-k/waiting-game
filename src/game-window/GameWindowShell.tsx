import { useState, useEffect, useRef } from "react";
import type { MouseEvent } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { MiniGamePlugin, PluginComponentProps } from "@/engine/types";
import { useHubStore, startHubStateSync } from "@/store/hubStore";
import { saveGame, loadGame } from "@/engine/saveLoad";
import { broadcastTick, emitGoldEarned, emitCrystalEarned, emitArtifactEarned, emitWindowClosed } from "@/engine/eventBus";
import { PLUGIN_LIMITS } from "@/engine/pluginValidation";
import { GameTicker } from "@/engine/ticker";
import { canPurchaseUpgrade, purchaseUpgrade, getOwnedInstances, getUpgradeCost, getUpgradeLevel } from "@/engine/upgradeSystem";
import { GameErrorBoundary } from "./GameErrorBoundary";
import { DevCheatPanel } from "@/components/DevCheatPanel";

interface Props {
  plugin: MiniGamePlugin;
}

interface StateWithUpgrades {
  ownedUpgradeIds?: string[];
}

export function GameWindowShell({ plugin }: Props) {
  const [state, setState] = useState<unknown>(() => plugin.getInitialState());
  const [alwaysOnTop, setAlwaysOnTop] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const tickerRef = useRef<GameTicker | null>(null);
  const stateRef = useRef<unknown>(state);
  const goldBalance = useHubStore((s) => s.gold.balance);
  const goldBalanceRef = useRef(goldBalance);

  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { goldBalanceRef.current = goldBalance; }, [goldBalance]);

  // Sync gold balance on mount, then keep it live. The hub credits gold this
  // window earns; without the subscription our balance would freeze at the
  // mount value and earned upgrades would read as unaffordable.
  useEffect(() => {
    startHubStateSync();
    useHubStore.getState().hydrate();
  }, []);

  // Hydrate from save file on mount
  useEffect(() => {
    loadGame<unknown>(plugin.id).then(async (saved) => {
      if (saved) {
        const hydrated = await Promise.resolve(plugin.hydrateState(saved));
        setState(hydrated);
        stateRef.current = hydrated;
      }
      setLoaded(true);
    });
  }, [plugin]);

  // Start tick loop after hydration
  useEffect(() => {
    if (!loaded) return;

    const ticker = new GameTicker((deltaMs) => {
      const { next, goldEarned, crystalsEarned, artifactId } = plugin.tick(stateRef.current, deltaMs);
      stateRef.current = next;
      setState(next);
      broadcastTick(plugin.id, next);
      if (goldEarned > 0) {
        emitGoldEarned(plugin.id, Math.min(goldEarned, PLUGIN_LIMITS.goldPerTickMax));
      }
      if (crystalsEarned > 0) {
        emitCrystalEarned(plugin.id);
      }
      if (artifactId) {
        emitArtifactEarned(plugin.id, `${plugin.id}:${artifactId}`, 1);
      }
    });

    ticker.start();
    tickerRef.current = ticker;
    return () => ticker.stop();
  }, [loaded, plugin]);

  // Auto-save every 30s
  useEffect(() => {
    if (!loaded) return;
    const interval = setInterval(() => {
      saveGame(plugin.id, stateRef.current);
    }, 30_000);
    return () => clearInterval(interval);
  }, [loaded, plugin.id]);

  // Save on OS-level close (Cmd+W, force quit, etc.)
  useEffect(() => {
    const win = getCurrentWindow();
    const unlistenPromise = win.listen("tauri://close-requested", async () => {
      await saveGame(plugin.id, stateRef.current);
      await emitWindowClosed(plugin.id);
      await win.destroy();
    });
    return () => { unlistenPromise.then((u) => u()); };
  }, [plugin.id]);

  async function handleTitleDragStart(e: MouseEvent) {
    if (e.button !== 0) return;
    e.preventDefault();
    await getCurrentWindow().startDragging();
  }

  async function toggleAlwaysOnTop() {
    const next = !alwaysOnTop;
    await getCurrentWindow().setAlwaysOnTop(next);
    setAlwaysOnTop(next);
  }

  async function handleClose() {
    await saveGame(plugin.id, stateRef.current);
    await emitWindowClosed(plugin.id);
    await getCurrentWindow().destroy();
  }

  function handleReset() {
    const next = plugin.reset
      ? plugin.reset(stateRef.current)
      : plugin.getInitialState();
    stateRef.current = next;
    setState(next);
  }

  // Switch the active selection within a grouped upgrade. Unlike a purchase,
  // this costs no gold and doesn't change ownership — it only re-applies the
  // owned upgrade's effect (e.g. swap variant or condition).
  function handleSelectUpgrade(upgradeId: string) {
    const def = plugin.upgrades.find((u) => u.id === upgradeId);
    if (!def) return;
    const owned = (stateRef.current as StateWithUpgrades).ownedUpgradeIds ?? [];
    if (!owned.includes(upgradeId)) return;
    const applied = def.apply(stateRef.current, 1);
    stateRef.current = applied;
    setState(applied);
  }

  async function handleUpgradePurchase(upgradeId: string) {
    const def = plugin.upgrades.find((u) => u.id === upgradeId);
    if (!def) return;

    const current = stateRef.current as StateWithUpgrades;
    const ownedIds = current.ownedUpgradeIds ?? [];
    const ownedInstances = getOwnedInstances(ownedIds);

    if (
      !canPurchaseUpgrade(
        plugin.upgrades,
        ownedInstances,
        upgradeId,
        goldBalanceRef.current
      )
    ) {
      return;
    }

    // spendGold is async (round-trips to the Rust ledger) and can reject if the
    // balance moved since the affordability check — don't apply the upgrade unless
    // the spend actually succeeds.
    const cost = getUpgradeCost(def, getUpgradeLevel(ownedInstances, upgradeId));
    const success = await useHubStore.getState().spendGold(cost);
    if (!success) return;

    // Apply onto the latest state — ticks may have advanced it during the spend.
    const latest = stateRef.current as StateWithUpgrades;
    const newOwnedIds = purchaseUpgrade(latest.ownedUpgradeIds ?? ownedIds, upgradeId);
    const withNewUpgrade = {
      ...(latest as object),
      ownedUpgradeIds: newOwnedIds,
    };
    const applied = def.apply(withNewUpgrade, 1);

    stateRef.current = applied;
    setState(applied);
  }

  const componentProps: PluginComponentProps = {
    state,
    onUpgradePurchase: handleUpgradePurchase,
    onSelectUpgrade: handleSelectUpgrade,
    onReset: handleReset,
    isPopOut: true,
  };

  return (
    <div className="flex flex-col h-full bg-[var(--color-surface)] text-white overflow-hidden">
      {/* Custom title bar */}
      <div
        className="flex items-center justify-between px-3 py-2 bg-[var(--color-surface-raised)] border-b border-white/10 select-none"
      >
        <span
          onMouseDown={handleTitleDragStart}
          className="flex-1 text-sm font-medium text-white/80 truncate cursor-move"
        >
          {plugin.name}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={toggleAlwaysOnTop}
            title={alwaysOnTop ? "Unpin from top" : "Pin always on top"}
            className={`w-6 h-6 rounded text-xs transition-colors ${
              alwaysOnTop
                ? "text-amber-400 bg-amber-400/20"
                : "text-white/40 hover:text-white/70"
            }`}
          >
            📌
          </button>
          <button
            onClick={handleClose}
            title="Close"
            className="w-6 h-6 rounded text-xs text-white/40 hover:text-red-400 hover:bg-red-400/10 transition-colors"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Game content */}
      <div className="flex-1 overflow-auto">
        {loaded ? (
          <GameErrorBoundary resetKey={plugin.id}>
            <plugin.Component {...componentProps} />
          </GameErrorBoundary>
        ) : (
          <div className="flex items-center justify-center h-full text-white/30">
            Loading…
          </div>
        )}
      </div>

      {import.meta.env.DEV && loaded && (
        <DevCheatPanel
          plugin={plugin}
          getState={() => stateRef.current}
          applyState={(next) => {
            stateRef.current = next;
            setState(next);
          }}
        />
      )}
    </div>
  );
}
