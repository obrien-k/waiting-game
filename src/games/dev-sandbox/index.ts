import type { ExternalPlugin } from "@/engine/pluginTrust";

/**
 * DEV-only Tier-2 fixture (ADR 0002). A minimal untrusted "game" hosted via
 * `srcdoc` inside the sandboxed iframe, used to exercise and eyeball the broker
 * path without shipping a bundle to AppData. Registered only in dev (mirrors the
 * `[DEV]` native fixtures) so it never reaches a shipped build.
 *
 * It has no `window.__TAURI__`, no filesystem, and no direct IPC — everything it
 * does (earn gold, mint an artifact) goes through `postMessage`, and every
 * request is validated + clamped by the host broker. The "try to over-earn" and
 * "forbidden call" buttons demonstrate clamping and permission denial.
 */
const SRCDOC = /* html */ `<!doctype html>
<html>
<head><meta charset="utf-8"><style>
  body{font-family:system-ui,sans-serif;margin:0;padding:16px;background:#faf7f2;color:#222}
  h1{font-size:15px;margin:0 0 4px} p{font-size:12px;color:#666;margin:0 0 12px}
  button{display:block;width:100%;margin:6px 0;padding:8px;font-size:13px;border:1px solid #ccc;border-radius:6px;background:#fff;cursor:pointer}
  button:hover{background:#f0f0f0}
  #log{margin-top:12px;font-family:ui-monospace,monospace;font-size:11px;white-space:pre-wrap;color:#444;max-height:120px;overflow:auto}
</style></head>
<body>
  <h1>🧪 Sandboxed Demo (Tier 2)</h1>
  <p>No Tauri, no FS. All actions brokered over postMessage.</p>
  <button id="earn">Earn 5 gold</button>
  <button id="over">Try to earn 1,000,000 gold (host clamps)</button>
  <button id="mint">Mint a "sprout" artifact</button>
  <button id="forbidden">Forge "plant-grow:oak" (host rejects)</button>
  <div id="log"></div>
  <script>
    var log = document.getElementById('log');
    function line(s){ log.textContent = s + "\\n" + log.textContent; }
    function send(m){ parent.postMessage(m, '*'); }
    window.addEventListener('message', function(e){
      var d = e.data || {};
      if (d.type === 'host:init') line('init: perms=' + JSON.stringify(d.permissions));
      if (d.type === 'host:ack') line('ack: ' + JSON.stringify(d));
    });
    document.getElementById('earn').onclick = function(){ send({type:'plugin:earn-gold', amount:5}); };
    document.getElementById('over').onclick = function(){ send({type:'plugin:earn-gold', amount:1000000}); };
    document.getElementById('mint').onclick = function(){ send({type:'plugin:mint-artifact', artifactId:'sprout'}); };
    document.getElementById('forbidden').onclick = function(){ send({type:'plugin:mint-artifact', artifactId:'plant-grow:oak'}); };
    send({type:'plugin:ready'});
  </script>
</body>
</html>`;

const devSandboxPlugin: ExternalPlugin = {
  kind: "external",
  id: "dev-sandbox",
  name: "[DEV] Sandboxed Demo",
  description: "Tier-2 iframe plugin exercising the postMessage broker",
  version: "1.0.0",
  srcdoc: SRCDOC,
  permissions: { needsGoldAPI: true, needsArtifactLedger: true },
};

export default devSandboxPlugin;
