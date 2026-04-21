use tauri::Manager;

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
        .invoke_handler(tauri::generate_handler![get_open_game_windows])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
