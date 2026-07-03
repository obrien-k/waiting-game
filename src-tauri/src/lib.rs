use tauri::Manager;
mod amusement_park;
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
