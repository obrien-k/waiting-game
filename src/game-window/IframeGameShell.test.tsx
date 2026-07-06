// Proves the Tier-2 trust boundary at the React layer: only messages whose
// source IS the plugin's iframe are acted on, and every acted-on message is
// still gated + clamped by the broker. See ADR 0002.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, act } from "@testing-library/react";

const emitGoldEarned = vi.fn();
const emitArtifactEarned = vi.fn();

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({ startDragging: vi.fn(), destroy: vi.fn() }),
}));
vi.mock("@/engine/eventBus", () => ({
  emitGoldEarned: (...a: unknown[]) => emitGoldEarned(...a),
  emitArtifactEarned: (...a: unknown[]) => emitArtifactEarned(...a),
  emitWindowClosed: vi.fn(),
}));

import { IframeGameShell } from "./IframeGameShell";
import type { ExternalPlugin } from "@/engine/pluginTrust";
import { PLUGIN_LIMITS } from "@/engine/pluginValidation";

function makePlugin(perms: Partial<ExternalPlugin["permissions"]> = {}): ExternalPlugin {
  return {
    kind: "external",
    id: "acme-clicker",
    name: "Acme",
    description: "",
    version: "1.0.0",
    srcdoc: "<!doctype html><body>hi</body>",
    permissions: { needsGoldAPI: true, needsArtifactLedger: true, ...perms },
  };
}

function post(data: unknown, source: Window | null) {
  act(() => {
    window.dispatchEvent(new MessageEvent("message", { data, source }));
  });
}

beforeEach(() => {
  emitGoldEarned.mockReset();
  emitArtifactEarned.mockReset();
});

describe("IframeGameShell — source authentication", () => {
  it("acts on a message from the plugin's own iframe", () => {
    const { container } = render(<IframeGameShell plugin={makePlugin()} isPopOut={false} />);
    const frame = container.querySelector("iframe")!;
    post({ type: "plugin:earn-gold", amount: 7 }, frame.contentWindow);
    expect(emitGoldEarned).toHaveBeenCalledWith("acme-clicker", 7);
  });

  it("ignores a spoofed message from a different source window", () => {
    render(<IframeGameShell plugin={makePlugin()} isPopOut={false} />);
    // window (the parent) is not the iframe — must be rejected by identity check.
    post({ type: "plugin:earn-gold", amount: 7 }, window);
    expect(emitGoldEarned).not.toHaveBeenCalled();
  });
});

describe("IframeGameShell — broker enforcement", () => {
  it("clamps over-earned gold to the per-tick ceiling", () => {
    const { container } = render(<IframeGameShell plugin={makePlugin()} isPopOut={false} />);
    const frame = container.querySelector("iframe")!;
    post({ type: "plugin:earn-gold", amount: 1_000_000 }, frame.contentWindow);
    expect(emitGoldEarned).toHaveBeenCalledWith("acme-clicker", PLUGIN_LIMITS.goldPerTickMax);
  });

  it("denies gold when the permission is not granted", () => {
    const { container } = render(
      <IframeGameShell plugin={makePlugin({ needsGoldAPI: false })} isPopOut={false} />
    );
    const frame = container.querySelector("iframe")!;
    post({ type: "plugin:earn-gold", amount: 7 }, frame.contentWindow);
    expect(emitGoldEarned).not.toHaveBeenCalled();
  });

  it("namespaces minted artifacts under the plugin's own id", () => {
    const { container } = render(<IframeGameShell plugin={makePlugin()} isPopOut={false} />);
    const frame = container.querySelector("iframe")!;
    post({ type: "plugin:mint-artifact", artifactId: "sprout" }, frame.contentWindow);
    expect(emitArtifactEarned).toHaveBeenCalledWith("acme-clicker", "acme-clicker:sprout", 1);
  });

  it("rejects an attempt to forge another game's artifact", () => {
    const { container } = render(<IframeGameShell plugin={makePlugin()} isPopOut={false} />);
    const frame = container.querySelector("iframe")!;
    post({ type: "plugin:mint-artifact", artifactId: "plant-grow:oak" }, frame.contentWindow);
    expect(emitArtifactEarned).not.toHaveBeenCalled();
  });
});
