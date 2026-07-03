use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, Manager};

// Milliseconds since the Unix epoch as f64, matching JS `Date.now()` so
// artifact timestamps line up with the frontend's `acquiredAt` convention.
fn js_now_ms() -> f64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as f64)
        .unwrap_or(0.0)
}

#[derive(Debug, Default, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GoldLedger {
    pub balance: f64,
    pub lifetime_earned: f64,
}

#[derive(Debug, Default, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CrystalLedger {
    pub count: u32,
}

#[derive(Debug, Default, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArtifactEntry {
    pub count: u32,
    pub first_acquired_at: f64,
    pub last_acquired_at: f64,
}

// Hoard model: one artifact per completion, aggregated to a count per type so
// hub.json stays small even after thousands of fast completions. Keyed by
// fully-qualified artifact type id (e.g. "plant-grow:oak"). Display metadata
// (name/emoji/buff) lives in the TS catalog, not here.
#[derive(Debug, Default, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArtifactLedger {
    pub entries: HashMap<String, ArtifactEntry>,
}

#[derive(Debug, Default, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HubStateData {
    pub gold: GoldLedger,
    pub crystals: CrystalLedger,
    pub artifacts: ArtifactLedger,
    pub installed_game_ids: Vec<String>,
    pub unlocked_game_ids: Vec<String>,
}

pub struct AppState {
    pub hub: Mutex<HubStateData>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            hub: Mutex::new(HubStateData::default()),
        }
    }

    pub fn load(app: &AppHandle) {
        if let Ok(data_dir) = app.path().app_data_dir() {
            let hub_path = data_dir.join("hub.json");
            if let Ok(contents) = fs::read_to_string(hub_path) {
                if let Ok(data) = serde_json::from_str::<HubStateData>(&contents) {
                    let state = app.state::<AppState>();
                    *state.hub.lock().unwrap() = data;
                }
            }
        }
    }

    pub fn save(app: &AppHandle, data: &HubStateData) {
        if let Ok(data_dir) = app.path().app_data_dir() {
            let _ = fs::create_dir_all(&data_dir);
            let hub_path = data_dir.join("hub.json");
            if let Ok(contents) = serde_json::to_string(data) {
                let _ = fs::write(hub_path, contents);
            }
        }
    }
}

// Commands

#[tauri::command]
pub fn get_hub_state(app: AppHandle) -> HubStateData {
    let state = app.state::<AppState>();
    let x = state.hub.lock().unwrap().clone();
    x
}

#[tauri::command]
pub fn add_gold(app: AppHandle, amount: f64) -> HubStateData {
    let state_res = {
        let state = app.state::<AppState>();
        let mut hub = state.hub.lock().unwrap();
        hub.gold.balance += amount;
        hub.gold.lifetime_earned += amount;
        AppState::save(&app, &hub);
        hub.clone()
    };
    let _ = app.emit("hub-state-updated", &state_res);
    state_res
}

#[tauri::command]
pub fn spend_gold(app: AppHandle, amount: f64) -> Result<HubStateData, String> {
    let state_res = {
        let state = app.state::<AppState>();
        let mut hub = state.hub.lock().unwrap();
        if hub.gold.balance < amount {
            return Err("Insufficient gold".to_string());
        }
        hub.gold.balance -= amount;
        AppState::save(&app, &hub);
        hub.clone()
    };
    let _ = app.emit("hub-state-updated", &state_res);
    Ok(state_res)
}

#[tauri::command]
pub fn unlock_game(app: AppHandle, game_id: String, cost: f64) -> Result<HubStateData, String> {
    let state_res = {
        let state = app.state::<AppState>();
        let mut hub = state.hub.lock().unwrap();
        if hub.unlocked_game_ids.contains(&game_id) {
            return Ok(hub.clone());
        }
        if hub.gold.balance < cost {
            return Err("Insufficient gold".to_string());
        }
        hub.gold.balance -= cost;
        hub.unlocked_game_ids.push(game_id);
        AppState::save(&app, &hub);
        hub.clone()
    };
    let _ = app.emit("hub-state-updated", &state_res);
    Ok(state_res)
}

#[tauri::command]
pub fn reset_hub_state(app: AppHandle) -> HubStateData {
    let state_res = {
        let state = app.state::<AppState>();
        let mut hub = state.hub.lock().unwrap();
        *hub = HubStateData::default();
        AppState::save(&app, &hub);
        hub.clone()
    };
    let _ = app.emit("hub-state-updated", &state_res);
    state_res
}

#[tauri::command]
pub fn add_crystal(app: AppHandle) -> HubStateData {
    let state_res = {
        let state = app.state::<AppState>();
        let mut hub = state.hub.lock().unwrap();
        hub.crystals.count += 1;
        AppState::save(&app, &hub);
        hub.clone()
    };
    let _ = app.emit("hub-state-updated", &state_res);
    state_res
}

#[tauri::command]
pub fn add_artifact(app: AppHandle, artifact_id: String, count: u32) -> HubStateData {
    let state_res = {
        let state = app.state::<AppState>();
        let mut hub = state.hub.lock().unwrap();
        let now = js_now_ms();
        let entry = hub
            .artifacts
            .entries
            .entry(artifact_id)
            .or_insert_with(|| ArtifactEntry {
                count: 0,
                first_acquired_at: now,
                last_acquired_at: now,
            });
        entry.count += count;
        entry.last_acquired_at = now;
        AppState::save(&app, &hub);
        hub.clone()
    };
    let _ = app.emit("hub-state-updated", &state_res);
    state_res
}

#[tauri::command]
pub fn set_installed_games(app: AppHandle, game_ids: Vec<String>) -> HubStateData {
    let state_res = {
        let state = app.state::<AppState>();
        let mut hub = state.hub.lock().unwrap();
        hub.installed_game_ids = game_ids;
        AppState::save(&app, &hub);
        hub.clone()
    };
    let _ = app.emit("hub-state-updated", &state_res);
    state_res
}

#[tauri::command]
pub fn hydrate_hub_state(app: AppHandle) -> HubStateData {
    AppState::load(&app);
    let state = app.state::<AppState>();
    let x = state.hub.lock().unwrap().clone();
    x
}
