import { useState, useEffect, useRef } from "react";
import type { MiniGamePlugin, PluginComponentProps } from "@/engine/types";
import { useHubStore } from "@/store/hubStore";
import { saveGame, loadGame } from "@/engine/saveLoad";
import { broadcastTick, emitGoldEarned, emitCrystalEarned, emitArtifactEarned } from "@/engine/eventBus";
import { PLUGIN_LIMITS } from "@/engine/pluginValidation";
import { GameTicker } from "@/engine/ticker";
import { canPurchaseUpgrade, purchaseUpgrade, getOwnedInstances, getUpgradeCost, getUpgradeLevel } from "@/engine/upgradeSystem";

interface Props {
  plugin: MiniGamePlugin;
}

interface StateWithUpgrades {
  ownedUpgradeIds?: string[];
}

export function InlineGameShell({ plugin }: Props) {
  const [state, setState] = useState<unknown>(() => plugin.getInitialState());
  const [loaded, setLoaded] = useState(false);
  const stateRef = useRef<unknown>(state);
  const goldBalance = useHubStore((s) => s.gold.balance);
  const goldBalanceRef = useRef(goldBalance);

  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { goldBalanceRef.current = goldBalance; }, [goldBalance]);

  useEffect(() => {
    loadGame<unknown>(plugin.id).then(async (saved) => {
      if (saved) {
        // hydrateState may be async (e.g. amusement-park computes offline
        // progress in Rust) — awaiting keeps `state` from becoming a Promise.
        const hydrated = await Promise.resolve(plugin.hydrateState(saved));
        setState(hydrated);
        stateRef.current = hydrated;
      }
      setLoaded(true);
    });
  }, [plugin]);

  useEffect(() => {
    if (!loaded) return;
    const ticker = new GameTicker((deltaMs) => {
      const { next, goldEarned, crystalsEarned, artifactId } = plugin.tick(stateRef.current, deltaMs);
      stateRef.current = next;
      setState(next);
      broadcastTick(plugin.id, next);
      if (goldEarned > 0) emitGoldEarned(plugin.id, Math.min(goldEarned, PLUGIN_LIMITS.goldPerTickMax));
      if (crystalsEarned > 0) emitCrystalEarned(plugin.id);
      if (artifactId) emitArtifactEarned(plugin.id, `${plugin.id}:${artifactId}`, 1);
    });
    ticker.start();
    return () => ticker.stop();
  }, [loaded, plugin]);

  useEffect(() => {
    if (!loaded) return;
    const interval = setInterval(() => saveGame(plugin.id, stateRef.current), 30_000);
    return () => clearInterval(interval);
  }, [loaded, plugin.id]);

  // Save when the player switches away from big screen
  useEffect(() => {
    return () => { saveGame(plugin.id, stateRef.current); };
  }, [plugin.id]);

  function handleReset() {
    const next = plugin.reset ? plugin.reset(stateRef.current) : plugin.getInitialState();
    stateRef.current = next;
    setState(next);
  }

  // Re-select an owned grouped upgrade — no cost, no ownership change.
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
    if (!canPurchaseUpgrade(plugin.upgrades, ownedInstances, upgradeId, goldBalanceRef.current)) return;
    // spendGold is async and may reject — only apply the upgrade if it succeeds.
    const cost = getUpgradeCost(def, getUpgradeLevel(ownedInstances, upgradeId));
    const success = await useHubStore.getState().spendGold(cost);
    if (!success) return;
    // Apply onto the latest state — ticks may have advanced it during the spend.
    const latest = stateRef.current as StateWithUpgrades;
    const newOwnedIds = purchaseUpgrade(latest.ownedUpgradeIds ?? ownedIds, upgradeId);
    const withNewUpgrade = { ...(latest as object), ownedUpgradeIds: newOwnedIds };
    const applied = def.apply(withNewUpgrade, 1);
    stateRef.current = applied;
    setState(applied);
  }

  const componentProps: PluginComponentProps = {
    state,
    onUpgradePurchase: handleUpgradePurchase,
    onSelectUpgrade: handleSelectUpgrade,
    onReset: handleReset,
    isPopOut: false,
  };

  if (!loaded) {
    return (
      <div className="flex items-center justify-center h-full text-white/30">
        Loading…
      </div>
    );
  }

  return <plugin.Component {...componentProps} />;
}
