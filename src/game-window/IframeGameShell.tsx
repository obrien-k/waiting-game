import { useEffect, useRef } from "react";
import type { MouseEvent } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { emitGoldEarned, emitArtifactEarned, emitWindowClosed } from "@/engine/eventBus";
import { decodeIframeMessage, brokerDecide } from "@/engine/iframeBroker";
import type { ExternalPlugin } from "@/engine/pluginTrust";

interface Props {
  plugin: ExternalPlugin;
  /** Pop-out windows get a title bar with pin/close; inline (big screen) does not. */
  isPopOut: boolean;
}

/**
 * Host for a Tier-2 (untrusted) plugin (ADR 0002). Renders the plugin inside a
 * `<iframe sandbox="allow-scripts">` — an opaque origin with no `window.__TAURI__`
 * and no filesystem — and brokers its privileged requests over postMessage.
 *
 * Trust boundary, in order of enforcement:
 *  1. Source identity: we only act on messages whose `event.source` IS this
 *     iframe's `contentWindow`. The origin of a sandboxed frame is the string
 *     "null" and is unforgeable-but-useless, so we authenticate by reference,
 *     never by `event.origin`.
 *  2. Shape: `decodeIframeMessage` rejects anything not a known, well-typed request.
 *  3. Policy: `brokerDecide` gates on granted permissions and clamps amounts.
 * Only after all three do we touch the trusted emit path (`eventBus`), which is
 * the exact path the native shells use to credit the hub.
 */
export function IframeGameShell({ plugin, isPopOut }: Props) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const frame = iframeRef.current;
      // (1) Source identity — the only trustworthy authenticator for an opaque frame.
      if (!frame || event.source !== frame.contentWindow) return;

      // (2) Shape.
      const req = decodeIframeMessage(event.data);
      if (!req) {
        replyTo(frame, { ok: false, error: "malformed message" });
        return;
      }

      // (3) Policy.
      const decision = brokerDecide(req, {
        pluginId: plugin.id,
        permissions: plugin.permissions,
      });

      switch (decision.action) {
        case "handshake":
          // Tell the sandbox who it is and what it may ask for. Purely
          // informational — the broker re-checks every subsequent request.
          frame.contentWindow?.postMessage(
            { type: "host:init", pluginId: plugin.id, permissions: plugin.permissions },
            "*"
          );
          return;
        case "earn-gold":
          emitGoldEarned(plugin.id, decision.amount);
          replyTo(frame, { ok: true, credited: decision.amount });
          return;
        case "mint-artifact":
          emitArtifactEarned(plugin.id, decision.artifactId, 1);
          replyTo(frame, { ok: true, artifactId: decision.artifactId });
          return;
        case "reject":
          replyTo(frame, { ok: false, error: decision.reason });
          return;
      }
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [plugin.id, plugin.permissions]);

  async function handleTitleDragStart(e: MouseEvent) {
    if (e.button !== 0) return;
    e.preventDefault();
    await getCurrentWindow().startDragging();
  }

  async function handleClose() {
    await emitWindowClosed(plugin.id);
    await getCurrentWindow().destroy();
  }

  // sandbox is deliberately minimal: scripts only. No allow-same-origin (keeps
  // the frame opaque, blocks Tauri IPC + parent DOM access), no allow-popups,
  // no allow-forms, no allow-top-navigation.
  const iframe = (
    <iframe
      ref={iframeRef}
      title={plugin.name}
      sandbox="allow-scripts"
      className="w-full h-full border-0 bg-white"
      {...(plugin.srcdoc ? { srcDoc: plugin.srcdoc } : { src: plugin.entryUrl })}
    />
  );

  if (!isPopOut) {
    return <div className="w-full h-full">{iframe}</div>;
  }

  return (
    <div className="flex flex-col h-full bg-[var(--color-surface)] text-white overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-[var(--color-surface-raised)] border-b border-white/10 select-none">
        <span
          onMouseDown={handleTitleDragStart}
          className="flex-1 text-sm font-medium text-white/80 truncate cursor-move"
          title="Community plugin — sandboxed"
        >
          {plugin.name} <span className="text-white/30">· sandboxed</span>
        </span>
        <button
          onClick={handleClose}
          title="Close"
          className="w-6 h-6 rounded text-xs text-white/40 hover:text-red-400 hover:bg-red-400/10 transition-colors shrink-0"
        >
          ✕
        </button>
      </div>
      <div className="flex-1 overflow-hidden">{iframe}</div>
    </div>
  );
}

type HostAck = { ok: boolean; error?: string; credited?: number; artifactId?: string };

function replyTo(frame: HTMLIFrameElement, ack: HostAck) {
  // Target origin "*" is required: a sandboxed frame's origin is opaque and
  // cannot be named. The ack carries no secrets, only an accept/reject receipt.
  frame.contentWindow?.postMessage({ type: "host:ack", ...ack }, "*");
}
