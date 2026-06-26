import { useState, useEffect, useRef } from "react";
import type { MiniGamePlugin, PluginComponentProps } from "@/engine/types";
import { useHubStore } from "@/store/hubStore";
import { saveGame, loadGame } from "@/engine/saveLoad";
import { broadcastTick, emitGoldEarned, emitCrystalEarned } from "@/engine/eventBus";
import { PLUGIN_LIMITS } from "@/engine/pluginValidation";
import { GameTicker } from "@/engine/ticker";
import { canPurchaseUpgrade, purchaseUpgrade } from "@/engine/upgradeSystem";

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
    loadGame<unknown>(plugin.id).then((saved) => {
      if (saved) {
        const hydrated = plugin.hydrateState(saved);
        setState(hydrated);
        stateRef.current = hydrated;
      }
      setLoaded(true);
    });
  }, [plugin]);

  useEffect(() => {
    if (!loaded) return;
    const ticker = new GameTicker((deltaMs) => {
      const { next, goldEarned, crystalsEarned } = plugin.tick(stateRef.current, deltaMs);
      stateRef.current = next;
      setState(next);
      broadcastTick(plugin.id, next);
      if (goldEarned > 0) emitGoldEarned(plugin.id, Math.min(goldEarned, PLUGIN_LIMITS.goldPerTickMax));
      if (crystalsEarned > 0) emitCrystalEarned(plugin.id);
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

  function handleUpgradePurchase(upgradeId: string) {
    const def = plugin.upgrades.find((u) => u.id === upgradeId);
    if (!def) return;
    const current = stateRef.current as StateWithUpgrades;
    const ownedInstances = (current.ownedUpgradeIds ?? []).map((id) => ({ id, level: 1 }));
    if (!canPurchaseUpgrade(plugin.upgrades, ownedInstances, upgradeId, goldBalanceRef.current)) return;
    const success = useHubStore.getState().spendGold(def.cost);
    if (!success) return;
    const newInstances = purchaseUpgrade(ownedInstances, upgradeId);
    const newOwnedIds = newInstances.map((u) => u.id);
    const withNewUpgrade = { ...(current as object), ownedUpgradeIds: newOwnedIds };
    const applied = def.apply(withNewUpgrade, 1);
    stateRef.current = applied;
    setState(applied);
  }

  const componentProps: PluginComponentProps = {
    state,
    onUpgradePurchase: handleUpgradePurchase,
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
