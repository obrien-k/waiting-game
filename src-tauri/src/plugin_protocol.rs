//! `plugin://` custom protocol (ADR 0002).
//!
//! Serves a Tier-2 plugin's static assets from `AppData/plugins/<id>/…`, strictly
//! scoped so a request can never read outside its own plugin directory. This is
//! the only way sandboxed (opaque-origin) plugins get their HTML/JS/images: they
//! have no filesystem access, so the host serves files on their behalf through a
//! scheme that resolves to nothing but their bundle.
//!
//! The path resolver is pure and unit-tested against traversal payloads — the
//! security-critical logic does not depend on the Tauri runtime.

use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

/// CSP sent with every served plugin document. Deliberately near-total lockdown:
/// no network, no framing of others, scripts/styles only inline or from this
/// scheme. The webview-level sandbox (`allow-scripts`, no `allow-same-origin`)
/// is the primary boundary; this is defense in depth on the content itself.
pub const PLUGIN_CONTENT_CSP: &str = "default-src 'none'; \
script-src 'unsafe-inline' plugin: http://plugin.localhost; \
style-src 'unsafe-inline'; \
img-src plugin: http://plugin.localhost data:; \
media-src plugin: http://plugin.localhost data:; \
font-src data:; \
connect-src 'none'; \
base-uri 'none'; \
form-action 'none'";

/// A plugin id is kebab-case ascii: `[a-z0-9][a-z0-9-]*`. This rules out `..`,
/// path separators, and absolute-path shenanigans before we ever touch the fs.
fn is_valid_plugin_id(id: &str) -> bool {
    let mut chars = id.chars();
    match chars.next() {
        Some(c) if c.is_ascii_lowercase() || c.is_ascii_digit() => {}
        _ => return false,
    }
    id.chars()
        .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
}

/// Minimal percent-decoder for request path segments (we percent-encode them on
/// the JS side). Decoding happens BEFORE traversal validation so an encoded
/// `%2e%2e` is caught as `..`. Invalid escapes are left literal.
fn percent_decode(seg: &str) -> String {
    let bytes = seg.as_bytes();
    let mut out: Vec<u8> = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            let hi = (bytes[i + 1] as char).to_digit(16);
            let lo = (bytes[i + 2] as char).to_digit(16);
            if let (Some(hi), Some(lo)) = (hi, lo) {
                out.push((hi * 16 + lo) as u8);
                i += 3;
                continue;
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

/// Split a request path (`/<id>/<asset...>`) into `(id, asset)`. Returns `None`
/// if there is no id segment.
pub fn split_request_path(path: &str) -> Option<(String, String)> {
    let trimmed = path.trim_start_matches('/');
    let mut parts = trimmed.splitn(2, '/');
    let id = parts.next().filter(|s| !s.is_empty())?;
    let asset = parts.next().unwrap_or("");
    Some((percent_decode(id), asset.to_string()))
}

/// Resolve `<plugins_root>/<id>/<asset>` with strict scoping. Pure and total:
/// - the id must be valid kebab-case (blocks `..`, separators);
/// - each asset segment is percent-decoded then rejected if it is `..` or
///   contains a path separator / NUL;
/// - the result must remain lexically within the plugin directory.
///
/// Symlink escape (a file that exists but points outside) is caught at serve
/// time by canonicalizing; this function guarantees the *requested* path is
/// in-bounds regardless of the filesystem.
pub fn resolve_plugin_asset_path(
    plugins_root: &Path,
    id: &str,
    asset: &str,
) -> Result<PathBuf, String> {
    if !is_valid_plugin_id(id) {
        return Err(format!("invalid plugin id: {id:?}"));
    }
    let plugin_dir = plugins_root.join(id);
    let mut out = plugin_dir.clone();
    for raw in asset.split('/') {
        let seg = percent_decode(raw);
        if seg.is_empty() || seg == "." {
            continue;
        }
        if seg == ".." {
            return Err("path traversal rejected".into());
        }
        if seg.contains('/') || seg.contains('\\') || seg.contains('\0') {
            return Err("illegal path segment".into());
        }
        out.push(seg);
    }
    if out == plugin_dir {
        return Err("no asset specified".into());
    }
    // Lexical containment — belt to the id/segment suspenders.
    if !out.starts_with(&plugin_dir) {
        return Err("resolved path escaped plugin directory".into());
    }
    Ok(out)
}

pub fn guess_mime(path: &Path) -> &'static str {
    match path.extension().and_then(|e| e.to_str()) {
        Some("html") | Some("htm") => "text/html",
        Some("js") | Some("mjs") => "text/javascript",
        Some("css") => "text/css",
        Some("json") => "application/json",
        Some("wasm") => "application/wasm",
        Some("png") => "image/png",
        Some("jpg") | Some("jpeg") => "image/jpeg",
        Some("gif") => "image/gif",
        Some("svg") => "image/svg+xml",
        Some("webp") => "image/webp",
        Some("mp3") => "audio/mpeg",
        Some("ogg") => "audio/ogg",
        Some("wav") => "audio/wav",
        Some("woff2") => "font/woff2",
        _ => "application/octet-stream",
    }
}

/// Root directory that holds all installed plugin bundles.
pub fn plugins_root(app: &AppHandle) -> Option<PathBuf> {
    app.path().app_data_dir().ok().map(|d| d.join("plugins"))
}

/// Resolve + read the file for a request path. Returns `(mime, bytes)` on success
/// or an HTTP status code on failure. Canonicalization here closes the symlink
/// hole that the lexical resolver cannot see.
pub fn serve(app: &AppHandle, request_path: &str) -> Result<(&'static str, Vec<u8>), u16> {
    let root = plugins_root(app).ok_or(500u16)?;
    let (id, asset) = split_request_path(request_path).ok_or(400u16)?;
    let target = resolve_plugin_asset_path(&root, &id, &asset).map_err(|_| 403u16)?;

    // Symlink guard: the real file must still sit under the real plugin dir.
    let plugin_dir = root.join(&id);
    if let (Ok(canon_target), Ok(canon_dir)) =
        (target.canonicalize(), plugin_dir.canonicalize())
    {
        if !canon_target.starts_with(&canon_dir) {
            return Err(403);
        }
    }

    match std::fs::read(&target) {
        Ok(bytes) => Ok((guess_mime(&target), bytes)),
        Err(_) => Err(404),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn root() -> PathBuf {
        PathBuf::from("/data/plugins")
    }

    #[test]
    fn resolves_a_simple_asset() {
        let p = resolve_plugin_asset_path(&root(), "acme-clicker", "index.html").unwrap();
        assert_eq!(p, PathBuf::from("/data/plugins/acme-clicker/index.html"));
    }

    #[test]
    fn resolves_a_nested_asset() {
        let p = resolve_plugin_asset_path(&root(), "acme-clicker", "assets/img/x.png").unwrap();
        assert_eq!(p, PathBuf::from("/data/plugins/acme-clicker/assets/img/x.png"));
    }

    #[test]
    fn rejects_dotdot_traversal() {
        for asset in ["../secret", "assets/../../etc/passwd", "a/b/../../../c"] {
            assert!(resolve_plugin_asset_path(&root(), "acme-clicker", asset).is_err());
        }
    }

    #[test]
    fn rejects_encoded_traversal() {
        // %2e%2e decodes to ".." before validation.
        assert!(resolve_plugin_asset_path(&root(), "acme-clicker", "%2e%2e/secret").is_err());
    }

    #[test]
    fn rejects_backslash_and_nul_segments() {
        assert!(resolve_plugin_asset_path(&root(), "acme-clicker", "a\\b").is_err());
        assert!(resolve_plugin_asset_path(&root(), "acme-clicker", "a\0b").is_err());
    }

    #[test]
    fn rejects_bad_plugin_ids() {
        for id in ["..", "/", "a/b", "Acme", "-lead", "", "a b", "a.b"] {
            assert!(
                resolve_plugin_asset_path(&root(), id, "index.html").is_err(),
                "id {id:?} should be rejected"
            );
        }
    }

    #[test]
    fn rejects_empty_asset() {
        assert!(resolve_plugin_asset_path(&root(), "acme-clicker", "").is_err());
    }

    #[test]
    fn splits_request_paths() {
        assert_eq!(
            split_request_path("/acme-clicker/index.html"),
            Some(("acme-clicker".into(), "index.html".into()))
        );
        assert_eq!(
            split_request_path("/acme-clicker/a/b.png"),
            Some(("acme-clicker".into(), "a/b.png".into()))
        );
        assert_eq!(
            split_request_path("/acme-clicker"),
            Some(("acme-clicker".into(), "".into()))
        );
        assert_eq!(split_request_path("/"), None);
    }

    #[test]
    fn percent_decodes() {
        assert_eq!(percent_decode("a%20b"), "a b");
        assert_eq!(percent_decode("%2e%2e"), "..");
        assert_eq!(percent_decode("no-escapes"), "no-escapes");
        assert_eq!(percent_decode("bad%zz"), "bad%zz");
    }

    #[test]
    fn mime_by_extension() {
        assert_eq!(guess_mime(Path::new("a/index.html")), "text/html");
        assert_eq!(guess_mime(Path::new("a/game.js")), "text/javascript");
        assert_eq!(guess_mime(Path::new("a/x.unknown")), "application/octet-stream");
    }
}
