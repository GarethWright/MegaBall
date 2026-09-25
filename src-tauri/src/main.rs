// Megaball Neo desktop: a native Rust (Tauri) shell around the game in ../public, embedded in the binary.
// Hide the console window on Windows release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running Megaball Neo");
}
