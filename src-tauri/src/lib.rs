use tauri::http::{header::CONTENT_TYPE, Response};
use tauri::Manager;
mod amusement_park;
mod plugin_protocol;
mod state;
use state::{add_artifact, add_crystal, add_gold, get_hub_state, hydrate_hub_state, reset_hub_state, set_installed_games, spend_gold, unlock_game, AppState};
use amusement_park::calculate_amusement_park_offline;

#[tauri::command]
fn get_open_game_windows(app: tauri::AppHandle) -> Vec<String> {
    app.webview_windows()
        .keys()
        .filter(|label| label.starts_with("game-"))
        .cloned()
        .collect()
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        // Tier-2 asset protocol (ADR 0002): serves AppData/plugins/<id>/… scoped
        // strictly to each plugin's own directory. See `plugin_protocol::serve`.
        .register_uri_scheme_protocol("plugin", |ctx, request| {
            let app = ctx.app_handle();
            let path = request.uri().path().to_string();
            match plugin_protocol::serve(app, &path) {
                Ok((mime, bytes)) => Response::builder()
                    .status(200)
                    .header(CONTENT_TYPE, mime)
                    .header("Content-Security-Policy", plugin_protocol::PLUGIN_CONTENT_CSP)
                    .header("X-Content-Type-Options", "nosniff")
                    .body(bytes)
                    .unwrap(),
                Err(code) => Response::builder()
                    .status(code)
                    .body(Vec::new())
                    .unwrap(),
            }
        })
        .manage(AppState::new())
        .invoke_handler(tauri::generate_handler![
            get_open_game_windows,
            get_hub_state,
            add_gold,
            spend_gold,
            add_crystal,
            add_artifact,
            unlock_game,
            reset_hub_state,
            set_installed_games,
            hydrate_hub_state,
            calculate_amusement_park_offline
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
