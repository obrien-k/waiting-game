/**
 * Client-side URL builder for the `plugin://` custom protocol (ADR 0002).
 *
 * The Rust handler (`src-tauri/src/plugin_protocol.rs`) serves
 * `AppData/plugins/<id>/<path>` strictly scoped to each plugin's directory. Tauri
 * exposes custom schemes differently per platform: `scheme://localhost/...` on
 * macOS/Linux, `http://scheme.localhost/...` on Windows/Android. This mirrors
 * that so callers get a working URL regardless of host OS.
 */

export const PLUGIN_PROTOCOL_SCHEME = "plugin";

function isWindows(): boolean {
  // navigator is present in the webview; guard for non-DOM (test) contexts.
  return (
    typeof navigator !== "undefined" && /win/i.test(navigator.userAgent ?? "")
  );
}

/**
 * Build a `plugin://` URL for `path` inside plugin `id`'s directory. The path is
 * URL-encoded segment-by-segment; the Rust handler is the authoritative scope
 * check, but we never emit a leading slash or `..` here.
 */
export function pluginAssetUrl(id: string, path: string): string {
  const clean = path.replace(/^\/+/, "");
  const encoded = clean.split("/").map(encodeURIComponent).join("/");
  const base = isWindows()
    ? `http://${PLUGIN_PROTOCOL_SCHEME}.localhost`
    : `${PLUGIN_PROTOCOL_SCHEME}://localhost`;
  return `${base}/${encodeURIComponent(id)}/${encoded}`;
}
