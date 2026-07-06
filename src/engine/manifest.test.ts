import { describe, it, expect } from "vitest";
import { parseManifest, grantedPermissions } from "./manifest";

const VALID = {
  id: "acme-clicker",
  name: "Acme Clicker",
  version: "1.0.0",
  description: "click things",
  author: "Acme",
  minEngineVersion: "1.0.0",
  entry: "index.html",
  permissions: { needsGoldAPI: true },
};

describe("parseManifest", () => {
  it("builds an external (Tier-2) descriptor from a valid manifest", () => {
    const r = parseManifest(VALID);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.plugin.kind).toBe("external");
    expect(r.plugin.id).toBe("acme-clicker");
    expect(r.plugin.entryUrl).toContain("acme-clicker/index.html");
    expect(r.plugin.permissions).toEqual({ needsGoldAPI: true, needsArtifactLedger: false });
  });

  it("forces untrusted even when the manifest requests trust", () => {
    const r = parseManifest({ ...VALID, trust: "trusted" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // The descriptor is always external; native promotion is the host's call.
    expect(r.plugin.kind).toBe("external");
  });

  it.each([
    ["non-object", 42],
    ["missing id", { ...VALID, id: undefined }],
    ["non-kebab id", { ...VALID, id: "Acme_Clicker" }],
    ["absolute entry", { ...VALID, entry: "/etc/passwd" }],
    ["traversal entry", { ...VALID, entry: "../../secret.html" }],
    ["url entry", { ...VALID, entry: "https://evil.example/x.html" }],
  ])("rejects %s", (_label, raw) => {
    expect(parseManifest(raw).ok).toBe(false);
  });
});

describe("grantedPermissions", () => {
  it("defaults everything to false when omitted", () => {
    expect(grantedPermissions({ ...VALID, permissions: undefined } as never)).toEqual({
      needsGoldAPI: false,
      needsArtifactLedger: false,
    });
  });

  it("only grants explicitly-true permissions", () => {
    expect(
      grantedPermissions({ ...VALID, permissions: { needsGoldAPI: true } } as never)
    ).toEqual({ needsGoldAPI: true, needsArtifactLedger: false });
  });
});
