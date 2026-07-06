import { describe, it, expect } from "vitest";
import {
  decodeIframeMessage,
  brokerDecide,
  type BrokerContext,
} from "./iframeBroker";
import { PLUGIN_LIMITS } from "./pluginValidation";
import { NO_PERMISSIONS } from "./pluginTrust";

const FULL: BrokerContext = {
  pluginId: "acme-clicker",
  permissions: { needsGoldAPI: true, needsArtifactLedger: true },
};
const NONE: BrokerContext = { pluginId: "acme-clicker", permissions: NO_PERMISSIONS };

describe("decodeIframeMessage — hostile input", () => {
  it.each([
    ["null", null],
    ["undefined", undefined],
    ["a string", "plugin:earn-gold"],
    ["a number", 42],
    ["an array", ["plugin:earn-gold", 10]],
    ["no type", { amount: 10 }],
    ["unknown type", { type: "plugin:drain-wallet" }],
    ["gold without amount", { type: "plugin:earn-gold" }],
    ["gold with string amount", { type: "plugin:earn-gold", amount: "10" }],
    ["artifact without id", { type: "plugin:mint-artifact" }],
    ["artifact with number id", { type: "plugin:mint-artifact", artifactId: 7 }],
  ])("rejects %s → null", (_label, data) => {
    expect(decodeIframeMessage(data)).toBeNull();
  });

  it("accepts well-formed messages", () => {
    expect(decodeIframeMessage({ type: "plugin:ready" })).toEqual({ type: "plugin:ready" });
    expect(decodeIframeMessage({ type: "plugin:earn-gold", amount: 5 })).toEqual({
      type: "plugin:earn-gold",
      amount: 5,
    });
    expect(
      decodeIframeMessage({ type: "plugin:mint-artifact", artifactId: "rose" })
    ).toEqual({ type: "plugin:mint-artifact", artifactId: "rose" });
  });
});

describe("brokerDecide — permission gating", () => {
  it("denies gold when needsGoldAPI is not granted", () => {
    const d = brokerDecide({ type: "plugin:earn-gold", amount: 10 }, NONE);
    expect(d).toEqual({ action: "reject", reason: "gold API not granted" });
  });

  it("denies artifact when needsArtifactLedger is not granted", () => {
    const d = brokerDecide({ type: "plugin:mint-artifact", artifactId: "rose" }, NONE);
    expect(d).toEqual({ action: "reject", reason: "artifact ledger not granted" });
  });

  it("allows the handshake regardless of permissions", () => {
    expect(brokerDecide({ type: "plugin:ready" }, NONE)).toEqual({ action: "handshake" });
  });
});

describe("brokerDecide — gold clamping", () => {
  it("clamps gold to goldPerTickMax", () => {
    const d = brokerDecide({ type: "plugin:earn-gold", amount: 1_000_000 }, FULL);
    expect(d).toEqual({ action: "earn-gold", amount: PLUGIN_LIMITS.goldPerTickMax });
  });

  it("floors fractional gold", () => {
    const d = brokerDecide({ type: "plugin:earn-gold", amount: 12.9 }, FULL);
    expect(d).toEqual({ action: "earn-gold", amount: 12 });
  });

  it.each([0, -5, NaN, Infinity, -Infinity])("rejects %s", (amount) => {
    const d = brokerDecide({ type: "plugin:earn-gold", amount }, FULL);
    expect(d).toEqual({ action: "reject", reason: "invalid gold amount" });
  });
});

describe("brokerDecide — artifact namespacing", () => {
  it("namespaces a valid bare id under the plugin's own id", () => {
    const d = brokerDecide({ type: "plugin:mint-artifact", artifactId: "rose" }, FULL);
    expect(d).toEqual({ action: "mint-artifact", artifactId: "acme-clicker:rose" });
  });

  it("cannot forge another game's artifact via a colon in the id", () => {
    // The regex forbids ':' in the bare id, so `plant-grow:oak` never validates;
    // even if it did, the host prefixes with its own pluginId.
    const d = brokerDecide(
      { type: "plugin:mint-artifact", artifactId: "plant-grow:oak" },
      FULL
    );
    expect(d).toEqual({ action: "reject", reason: "invalid artifact id" });
  });

  it.each(["../oak", "OAK", "", "-lead", "a b", "a/b"])(
    "rejects malformed bare id %o",
    (artifactId) => {
      const d = brokerDecide({ type: "plugin:mint-artifact", artifactId }, FULL);
      expect(d).toEqual({ action: "reject", reason: "invalid artifact id" });
    }
  );
});
