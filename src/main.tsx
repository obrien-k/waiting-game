import React from "react";
import ReactDOM from "react-dom/client";
import "@/styles/globals.css";

async function bootstrap() {
  let windowLabel = "main";

  if ("__TAURI_INTERNALS__" in window) {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    windowLabel = getCurrentWindow().label;
  }

  let App: React.ComponentType;

  if (windowLabel === "main") {
    const { HubApp } = await import("@/hub/HubApp");
    App = HubApp;
  } else if (windowLabel.startsWith("game-")) {
    const gameId = windowLabel.slice("game-".length);
    const { GameWindowApp } = await import("@/game-window/GameWindowApp");
    App = () => <GameWindowApp gameId={gameId} />;
  } else {
    App = () => <div className="p-8 text-white">Unknown window: {windowLabel}</div>;
  }

  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

bootstrap();
