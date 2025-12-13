use tauri::{
    image::Image,
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::TrayIconBuilder,
    Emitter, Manager, WebviewUrl, WebviewWindowBuilder,
};
// WindowExt trait needed for on_tray_event positioning
#[allow(unused_imports)]
use tauri_plugin_positioner::WindowExt;
use std::sync::Mutex;
use std::sync::LazyLock;

// Embed SF Pro Bold font for rendering letters (or fallback to system font data)
// Using a simple built-in bitmap font for uppercase letters to avoid font dependencies
static LETTER_BITMAPS: LazyLock<std::collections::HashMap<char, [[u8; 8]; 10]>> = LazyLock::new(|| {
    let mut map = std::collections::HashMap::new();
    // 8x10 bitmap font for uppercase letters (1 = white pixel, 0 = transparent)
    // These are simplified bitmaps that will be scaled and rendered
    map.insert('A', [
        [0,0,1,1,1,1,0,0],
        [0,1,1,0,0,1,1,0],
        [1,1,0,0,0,0,1,1],
        [1,1,0,0,0,0,1,1],
        [1,1,1,1,1,1,1,1],
        [1,1,0,0,0,0,1,1],
        [1,1,0,0,0,0,1,1],
        [1,1,0,0,0,0,1,1],
        [1,1,0,0,0,0,1,1],
        [0,0,0,0,0,0,0,0],
    ]);
    map.insert('B', [
        [1,1,1,1,1,1,0,0],
        [1,1,0,0,0,1,1,0],
        [1,1,0,0,0,1,1,0],
        [1,1,1,1,1,1,0,0],
        [1,1,0,0,0,1,1,0],
        [1,1,0,0,0,0,1,1],
        [1,1,0,0,0,0,1,1],
        [1,1,0,0,0,1,1,0],
        [1,1,1,1,1,1,0,0],
        [0,0,0,0,0,0,0,0],
    ]);
    map.insert('C', [
        [0,0,1,1,1,1,1,0],
        [0,1,1,0,0,0,1,1],
        [1,1,0,0,0,0,0,0],
        [1,1,0,0,0,0,0,0],
        [1,1,0,0,0,0,0,0],
        [1,1,0,0,0,0,0,0],
        [1,1,0,0,0,0,0,0],
        [0,1,1,0,0,0,1,1],
        [0,0,1,1,1,1,1,0],
        [0,0,0,0,0,0,0,0],
    ]);
    map.insert('D', [
        [1,1,1,1,1,0,0,0],
        [1,1,0,0,1,1,0,0],
        [1,1,0,0,0,1,1,0],
        [1,1,0,0,0,0,1,1],
        [1,1,0,0,0,0,1,1],
        [1,1,0,0,0,0,1,1],
        [1,1,0,0,0,1,1,0],
        [1,1,0,0,1,1,0,0],
        [1,1,1,1,1,0,0,0],
        [0,0,0,0,0,0,0,0],
    ]);
    map.insert('E', [
        [1,1,1,1,1,1,1,1],
        [1,1,0,0,0,0,0,0],
        [1,1,0,0,0,0,0,0],
        [1,1,1,1,1,1,0,0],
        [1,1,0,0,0,0,0,0],
        [1,1,0,0,0,0,0,0],
        [1,1,0,0,0,0,0,0],
        [1,1,0,0,0,0,0,0],
        [1,1,1,1,1,1,1,1],
        [0,0,0,0,0,0,0,0],
    ]);
    map.insert('F', [
        [1,1,1,1,1,1,1,1],
        [1,1,0,0,0,0,0,0],
        [1,1,0,0,0,0,0,0],
        [1,1,1,1,1,1,0,0],
        [1,1,0,0,0,0,0,0],
        [1,1,0,0,0,0,0,0],
        [1,1,0,0,0,0,0,0],
        [1,1,0,0,0,0,0,0],
        [1,1,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0],
    ]);
    map.insert('G', [
        [0,0,1,1,1,1,1,0],
        [0,1,1,0,0,0,1,1],
        [1,1,0,0,0,0,0,0],
        [1,1,0,0,0,0,0,0],
        [1,1,0,0,1,1,1,1],
        [1,1,0,0,0,0,1,1],
        [1,1,0,0,0,0,1,1],
        [0,1,1,0,0,0,1,1],
        [0,0,1,1,1,1,1,0],
        [0,0,0,0,0,0,0,0],
    ]);
    map.insert('H', [
        [1,1,0,0,0,0,1,1],
        [1,1,0,0,0,0,1,1],
        [1,1,0,0,0,0,1,1],
        [1,1,1,1,1,1,1,1],
        [1,1,0,0,0,0,1,1],
        [1,1,0,0,0,0,1,1],
        [1,1,0,0,0,0,1,1],
        [1,1,0,0,0,0,1,1],
        [1,1,0,0,0,0,1,1],
        [0,0,0,0,0,0,0,0],
    ]);
    map.insert('I', [
        [1,1,1,1,1,1,1,1],
        [0,0,0,1,1,0,0,0],
        [0,0,0,1,1,0,0,0],
        [0,0,0,1,1,0,0,0],
        [0,0,0,1,1,0,0,0],
        [0,0,0,1,1,0,0,0],
        [0,0,0,1,1,0,0,0],
        [0,0,0,1,1,0,0,0],
        [1,1,1,1,1,1,1,1],
        [0,0,0,0,0,0,0,0],
    ]);
    map.insert('J', [
        [0,0,0,0,1,1,1,1],
        [0,0,0,0,0,1,1,0],
        [0,0,0,0,0,1,1,0],
        [0,0,0,0,0,1,1,0],
        [0,0,0,0,0,1,1,0],
        [0,0,0,0,0,1,1,0],
        [1,1,0,0,0,1,1,0],
        [1,1,0,0,1,1,0,0],
        [0,1,1,1,1,0,0,0],
        [0,0,0,0,0,0,0,0],
    ]);
    map.insert('K', [
        [1,1,0,0,0,1,1,0],
        [1,1,0,0,1,1,0,0],
        [1,1,0,1,1,0,0,0],
        [1,1,1,1,0,0,0,0],
        [1,1,1,1,0,0,0,0],
        [1,1,0,1,1,0,0,0],
        [1,1,0,0,1,1,0,0],
        [1,1,0,0,0,1,1,0],
        [1,1,0,0,0,0,1,1],
        [0,0,0,0,0,0,0,0],
    ]);
    map.insert('L', [
        [1,1,0,0,0,0,0,0],
        [1,1,0,0,0,0,0,0],
        [1,1,0,0,0,0,0,0],
        [1,1,0,0,0,0,0,0],
        [1,1,0,0,0,0,0,0],
        [1,1,0,0,0,0,0,0],
        [1,1,0,0,0,0,0,0],
        [1,1,0,0,0,0,0,0],
        [1,1,1,1,1,1,1,1],
        [0,0,0,0,0,0,0,0],
    ]);
    map.insert('M', [
        [1,1,0,0,0,0,1,1],
        [1,1,1,0,0,1,1,1],
        [1,1,1,1,1,1,1,1],
        [1,1,0,1,1,0,1,1],
        [1,1,0,0,0,0,1,1],
        [1,1,0,0,0,0,1,1],
        [1,1,0,0,0,0,1,1],
        [1,1,0,0,0,0,1,1],
        [1,1,0,0,0,0,1,1],
        [0,0,0,0,0,0,0,0],
    ]);
    map.insert('N', [
        [1,1,0,0,0,0,1,1],
        [1,1,1,0,0,0,1,1],
        [1,1,1,1,0,0,1,1],
        [1,1,0,1,1,0,1,1],
        [1,1,0,0,1,1,1,1],
        [1,1,0,0,0,1,1,1],
        [1,1,0,0,0,0,1,1],
        [1,1,0,0,0,0,1,1],
        [1,1,0,0,0,0,1,1],
        [0,0,0,0,0,0,0,0],
    ]);
    map.insert('O', [
        [0,0,1,1,1,1,0,0],
        [0,1,1,0,0,1,1,0],
        [1,1,0,0,0,0,1,1],
        [1,1,0,0,0,0,1,1],
        [1,1,0,0,0,0,1,1],
        [1,1,0,0,0,0,1,1],
        [1,1,0,0,0,0,1,1],
        [0,1,1,0,0,1,1,0],
        [0,0,1,1,1,1,0,0],
        [0,0,0,0,0,0,0,0],
    ]);
    map.insert('P', [
        [1,1,1,1,1,1,0,0],
        [1,1,0,0,0,1,1,0],
        [1,1,0,0,0,0,1,1],
        [1,1,0,0,0,1,1,0],
        [1,1,1,1,1,1,0,0],
        [1,1,0,0,0,0,0,0],
        [1,1,0,0,0,0,0,0],
        [1,1,0,0,0,0,0,0],
        [1,1,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0],
    ]);
    map.insert('Q', [
        [0,0,1,1,1,1,0,0],
        [0,1,1,0,0,1,1,0],
        [1,1,0,0,0,0,1,1],
        [1,1,0,0,0,0,1,1],
        [1,1,0,0,0,0,1,1],
        [1,1,0,0,1,0,1,1],
        [1,1,0,0,0,1,1,0],
        [0,1,1,0,0,1,1,0],
        [0,0,1,1,1,0,1,1],
        [0,0,0,0,0,0,0,0],
    ]);
    map.insert('R', [
        [1,1,1,1,1,1,0,0],
        [1,1,0,0,0,1,1,0],
        [1,1,0,0,0,0,1,1],
        [1,1,0,0,0,1,1,0],
        [1,1,1,1,1,1,0,0],
        [1,1,0,1,1,0,0,0],
        [1,1,0,0,1,1,0,0],
        [1,1,0,0,0,1,1,0],
        [1,1,0,0,0,0,1,1],
        [0,0,0,0,0,0,0,0],
    ]);
    map.insert('S', [
        [0,0,1,1,1,1,1,0],
        [0,1,1,0,0,0,1,1],
        [1,1,0,0,0,0,0,0],
        [0,1,1,0,0,0,0,0],
        [0,0,1,1,1,1,0,0],
        [0,0,0,0,0,1,1,0],
        [0,0,0,0,0,0,1,1],
        [1,1,0,0,0,1,1,0],
        [0,1,1,1,1,1,0,0],
        [0,0,0,0,0,0,0,0],
    ]);
    map.insert('T', [
        [1,1,1,1,1,1,1,1],
        [0,0,0,1,1,0,0,0],
        [0,0,0,1,1,0,0,0],
        [0,0,0,1,1,0,0,0],
        [0,0,0,1,1,0,0,0],
        [0,0,0,1,1,0,0,0],
        [0,0,0,1,1,0,0,0],
        [0,0,0,1,1,0,0,0],
        [0,0,0,1,1,0,0,0],
        [0,0,0,0,0,0,0,0],
    ]);
    map.insert('U', [
        [1,1,0,0,0,0,1,1],
        [1,1,0,0,0,0,1,1],
        [1,1,0,0,0,0,1,1],
        [1,1,0,0,0,0,1,1],
        [1,1,0,0,0,0,1,1],
        [1,1,0,0,0,0,1,1],
        [1,1,0,0,0,0,1,1],
        [0,1,1,0,0,1,1,0],
        [0,0,1,1,1,1,0,0],
        [0,0,0,0,0,0,0,0],
    ]);
    map.insert('V', [
        [1,1,0,0,0,0,1,1],
        [1,1,0,0,0,0,1,1],
        [1,1,0,0,0,0,1,1],
        [0,1,1,0,0,1,1,0],
        [0,1,1,0,0,1,1,0],
        [0,0,1,1,1,1,0,0],
        [0,0,1,1,1,1,0,0],
        [0,0,0,1,1,0,0,0],
        [0,0,0,1,1,0,0,0],
        [0,0,0,0,0,0,0,0],
    ]);
    map.insert('W', [
        [1,1,0,0,0,0,1,1],
        [1,1,0,0,0,0,1,1],
        [1,1,0,0,0,0,1,1],
        [1,1,0,0,0,0,1,1],
        [1,1,0,1,1,0,1,1],
        [1,1,1,1,1,1,1,1],
        [1,1,1,0,0,1,1,1],
        [1,1,0,0,0,0,1,1],
        [1,1,0,0,0,0,1,1],
        [0,0,0,0,0,0,0,0],
    ]);
    map.insert('X', [
        [1,1,0,0,0,0,1,1],
        [0,1,1,0,0,1,1,0],
        [0,0,1,1,1,1,0,0],
        [0,0,0,1,1,0,0,0],
        [0,0,0,1,1,0,0,0],
        [0,0,1,1,1,1,0,0],
        [0,1,1,0,0,1,1,0],
        [1,1,0,0,0,0,1,1],
        [1,1,0,0,0,0,1,1],
        [0,0,0,0,0,0,0,0],
    ]);
    map.insert('Y', [
        [1,1,0,0,0,0,1,1],
        [0,1,1,0,0,1,1,0],
        [0,0,1,1,1,1,0,0],
        [0,0,0,1,1,0,0,0],
        [0,0,0,1,1,0,0,0],
        [0,0,0,1,1,0,0,0],
        [0,0,0,1,1,0,0,0],
        [0,0,0,1,1,0,0,0],
        [0,0,0,1,1,0,0,0],
        [0,0,0,0,0,0,0,0],
    ]);
    map.insert('Z', [
        [1,1,1,1,1,1,1,1],
        [0,0,0,0,0,0,1,1],
        [0,0,0,0,0,1,1,0],
        [0,0,0,0,1,1,0,0],
        [0,0,0,1,1,0,0,0],
        [0,0,1,1,0,0,0,0],
        [0,1,1,0,0,0,0,0],
        [1,1,0,0,0,0,0,0],
        [1,1,1,1,1,1,1,1],
        [0,0,0,0,0,0,0,0],
    ]);
    // Numbers
    map.insert('0', [
        [0,0,1,1,1,1,0,0],
        [0,1,1,0,0,1,1,0],
        [1,1,0,0,0,0,1,1],
        [1,1,0,0,0,1,1,1],
        [1,1,0,0,1,0,1,1],
        [1,1,0,1,0,0,1,1],
        [1,1,1,0,0,0,1,1],
        [0,1,1,0,0,1,1,0],
        [0,0,1,1,1,1,0,0],
        [0,0,0,0,0,0,0,0],
    ]);
    map.insert('1', [
        [0,0,0,1,1,0,0,0],
        [0,0,1,1,1,0,0,0],
        [0,1,1,1,1,0,0,0],
        [0,0,0,1,1,0,0,0],
        [0,0,0,1,1,0,0,0],
        [0,0,0,1,1,0,0,0],
        [0,0,0,1,1,0,0,0],
        [0,0,0,1,1,0,0,0],
        [0,1,1,1,1,1,1,0],
        [0,0,0,0,0,0,0,0],
    ]);
    map.insert('2', [
        [0,0,1,1,1,1,0,0],
        [0,1,1,0,0,1,1,0],
        [0,0,0,0,0,0,1,1],
        [0,0,0,0,0,1,1,0],
        [0,0,0,0,1,1,0,0],
        [0,0,0,1,1,0,0,0],
        [0,0,1,1,0,0,0,0],
        [0,1,1,0,0,0,0,0],
        [1,1,1,1,1,1,1,1],
        [0,0,0,0,0,0,0,0],
    ]);
    map.insert('3', [
        [0,1,1,1,1,1,0,0],
        [1,1,0,0,0,1,1,0],
        [0,0,0,0,0,0,1,1],
        [0,0,0,0,0,1,1,0],
        [0,0,1,1,1,1,0,0],
        [0,0,0,0,0,1,1,0],
        [0,0,0,0,0,0,1,1],
        [1,1,0,0,0,1,1,0],
        [0,1,1,1,1,1,0,0],
        [0,0,0,0,0,0,0,0],
    ]);
    map.insert('4', [
        [0,0,0,0,1,1,0,0],
        [0,0,0,1,1,1,0,0],
        [0,0,1,1,1,1,0,0],
        [0,1,1,0,1,1,0,0],
        [1,1,0,0,1,1,0,0],
        [1,1,1,1,1,1,1,1],
        [0,0,0,0,1,1,0,0],
        [0,0,0,0,1,1,0,0],
        [0,0,0,0,1,1,0,0],
        [0,0,0,0,0,0,0,0],
    ]);
    map.insert('5', [
        [1,1,1,1,1,1,1,1],
        [1,1,0,0,0,0,0,0],
        [1,1,0,0,0,0,0,0],
        [1,1,1,1,1,1,0,0],
        [0,0,0,0,0,1,1,0],
        [0,0,0,0,0,0,1,1],
        [0,0,0,0,0,0,1,1],
        [1,1,0,0,0,1,1,0],
        [0,1,1,1,1,1,0,0],
        [0,0,0,0,0,0,0,0],
    ]);
    map.insert('6', [
        [0,0,1,1,1,1,0,0],
        [0,1,1,0,0,0,0,0],
        [1,1,0,0,0,0,0,0],
        [1,1,1,1,1,1,0,0],
        [1,1,0,0,0,1,1,0],
        [1,1,0,0,0,0,1,1],
        [1,1,0,0,0,0,1,1],
        [0,1,1,0,0,1,1,0],
        [0,0,1,1,1,1,0,0],
        [0,0,0,0,0,0,0,0],
    ]);
    map.insert('7', [
        [1,1,1,1,1,1,1,1],
        [0,0,0,0,0,0,1,1],
        [0,0,0,0,0,1,1,0],
        [0,0,0,0,1,1,0,0],
        [0,0,0,1,1,0,0,0],
        [0,0,0,1,1,0,0,0],
        [0,0,0,1,1,0,0,0],
        [0,0,0,1,1,0,0,0],
        [0,0,0,1,1,0,0,0],
        [0,0,0,0,0,0,0,0],
    ]);
    map.insert('8', [
        [0,0,1,1,1,1,0,0],
        [0,1,1,0,0,1,1,0],
        [0,1,1,0,0,1,1,0],
        [0,0,1,1,1,1,0,0],
        [0,1,1,0,0,1,1,0],
        [1,1,0,0,0,0,1,1],
        [1,1,0,0,0,0,1,1],
        [0,1,1,0,0,1,1,0],
        [0,0,1,1,1,1,0,0],
        [0,0,0,0,0,0,0,0],
    ]);
    map.insert('9', [
        [0,0,1,1,1,1,0,0],
        [0,1,1,0,0,1,1,0],
        [1,1,0,0,0,0,1,1],
        [1,1,0,0,0,0,1,1],
        [0,1,1,0,0,1,1,1],
        [0,0,1,1,1,1,1,1],
        [0,0,0,0,0,0,1,1],
        [0,0,0,0,0,1,1,0],
        [0,0,1,1,1,1,0,0],
        [0,0,0,0,0,0,0,0],
    ]);
    map
});

struct TrayState {
    tray: Mutex<Option<tauri::tray::TrayIcon>>,
}

#[derive(serde::Deserialize, Clone)]
#[allow(dead_code)]
struct ProjectInfo {
    id: i64,
    name: String,
    color: String,
}

/// Parse a hex color string (e.g., "#FF5733" or "FF5733") into RGB values
fn parse_hex_color(hex: &str) -> Option<(u8, u8, u8)> {
    let hex = hex.trim_start_matches('#');
    if hex.len() != 6 {
        return None;
    }
    let r = u8::from_str_radix(&hex[0..2], 16).ok()?;
    let g = u8::from_str_radix(&hex[2..4], 16).ok()?;
    let b = u8::from_str_radix(&hex[4..6], 16).ok()?;
    Some((r, g, b))
}

/// Generate a colored circle icon with an optional letter (22x22 for macOS menu bar)
fn generate_colored_icon(hex_color: &str, letter: Option<char>) -> Vec<u8> {
    let size = 22u32;
    let (r, g, b) = parse_hex_color(hex_color).unwrap_or((91, 164, 196)); // Default to app blue

    let mut rgba = vec![0u8; (size * size * 4) as usize];
    let center = size as f32 / 2.0;
    let radius = size as f32 / 2.0 - 1.0;

    // Draw the circle
    for y in 0..size {
        for x in 0..size {
            let dx = x as f32 - center;
            let dy = y as f32 - center;
            let distance = (dx * dx + dy * dy).sqrt();

            let idx = ((y * size + x) * 4) as usize;

            if distance <= radius {
                // Inside the circle
                rgba[idx] = r;     // R
                rgba[idx + 1] = g; // G
                rgba[idx + 2] = b; // B
                rgba[idx + 3] = 255; // A (fully opaque)
            } else if distance <= radius + 1.0 {
                // Anti-aliased edge
                let alpha = ((radius + 1.0 - distance) * 255.0) as u8;
                rgba[idx] = r;
                rgba[idx + 1] = g;
                rgba[idx + 2] = b;
                rgba[idx + 3] = alpha;
            }
            // else: transparent (already 0)
        }
    }

    // Draw the letter if provided
    if let Some(ch) = letter {
        let upper_ch = ch.to_ascii_uppercase();
        if let Some(bitmap) = LETTER_BITMAPS.get(&upper_ch) {
            // Scale and center the 8x10 bitmap in the 22x22 icon
            // Leave some padding for the circle edge
            let letter_width = 8;
            let letter_height = 10;
            let scale = 1.4f32; // Scale factor for better visibility
            let scaled_width = (letter_width as f32 * scale) as i32;
            let scaled_height = (letter_height as f32 * scale) as i32;
            let offset_x = ((size as i32 - scaled_width) / 2) as f32;
            let offset_y = ((size as i32 - scaled_height) / 2) as f32;

            // Render the scaled bitmap with white color
            for py in 0..scaled_height {
                for px in 0..scaled_width {
                    let src_x = (px as f32 / scale) as usize;
                    let src_y = (py as f32 / scale) as usize;

                    if src_y < letter_height && src_x < letter_width {
                        let pixel = bitmap[src_y][src_x];
                        if pixel == 1 {
                            let x = (offset_x as i32 + px) as u32;
                            let y = (offset_y as i32 + py) as u32;

                            if x < size && y < size {
                                // Check if this pixel is inside the circle
                                let dx = x as f32 - center;
                                let dy = y as f32 - center;
                                let distance = (dx * dx + dy * dy).sqrt();

                                if distance <= radius - 1.0 {
                                    let idx = ((y * size + x) * 4) as usize;
                                    // Draw white letter
                                    rgba[idx] = 255;     // R
                                    rgba[idx + 1] = 255; // G
                                    rgba[idx + 2] = 255; // B
                                    // Keep alpha at 255
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    rgba
}

#[tauri::command]
fn set_tray_title(state: tauri::State<TrayState>, title: String) {
    if let Some(tray) = state.tray.lock().unwrap().as_ref() {
        let _ = tray.set_title(Some(&title));
    }
}

#[tauri::command]
fn clear_tray_title(state: tauri::State<TrayState>) {
    if let Some(tray) = state.tray.lock().unwrap().as_ref() {
        // Use empty string instead of None - None might not clear on macOS
        let _ = tray.set_title(Some(""));
    }
}

#[tauri::command]
fn set_tray_icon_color(state: tauri::State<TrayState>, color: String, name: String) {
    if let Some(tray) = state.tray.lock().unwrap().as_ref() {
        let first_char = name.chars().next();
        let icon_data = generate_colored_icon(&color, first_char);
        let icon = Image::new_owned(icon_data, 22, 22);
        let _ = tray.set_icon(Some(icon));
    }
}

#[tauri::command]
fn reset_tray_icon(state: tauri::State<TrayState>) {
    if let Some(tray) = state.tray.lock().unwrap().as_ref() {
        // Reset to a neutral gray color when timer is stopped (no letter)
        let icon_data = generate_colored_icon("#808080", None);
        let icon = Image::new_owned(icon_data, 22, 22);
        let _ = tray.set_icon(Some(icon));
    }
}

/// Generate a small colored circle icon for menu items (16x16)
fn generate_menu_icon(hex_color: &str) -> Vec<u8> {
    let size = 16u32;
    let (r, g, b) = parse_hex_color(hex_color).unwrap_or((128, 128, 128));

    let mut rgba = vec![0u8; (size * size * 4) as usize];
    let center = size as f32 / 2.0;
    let radius = size as f32 / 2.0 - 1.0;

    for y in 0..size {
        for x in 0..size {
            let dx = x as f32 - center;
            let dy = y as f32 - center;
            let distance = (dx * dx + dy * dy).sqrt();

            let idx = ((y * size + x) * 4) as usize;

            if distance <= radius {
                rgba[idx] = r;
                rgba[idx + 1] = g;
                rgba[idx + 2] = b;
                rgba[idx + 3] = 255;
            } else if distance <= radius + 1.0 {
                let alpha = ((radius + 1.0 - distance) * 255.0) as u8;
                rgba[idx] = r;
                rgba[idx + 1] = g;
                rgba[idx + 2] = b;
                rgba[idx + 3] = alpha;
            }
        }
    }

    rgba
}

#[tauri::command]
fn update_tray_menu(app: tauri::AppHandle, projects: Vec<ProjectInfo>, is_running: bool) -> Result<(), String> {
    use tauri::menu::IconMenuItem;

    let state = app.state::<TrayState>();
    if let Some(tray) = state.tray.lock().unwrap().as_ref() {
        // Build menu
        let menu = Menu::new(&app).map_err(|e| e.to_string())?;

        // Show/Hide Timer
        let show = MenuItem::with_id(&app, "show", "Show/Hide Timer", true, None::<&str>)
            .map_err(|e| e.to_string())?;
        menu.append(&show).map_err(|e| e.to_string())?;

        // Dashboard
        let dashboard = MenuItem::with_id(&app, "dashboard", "Dashboard", true, None::<&str>)
            .map_err(|e| e.to_string())?;
        menu.append(&dashboard).map_err(|e| e.to_string())?;

        // Separator
        let separator = PredefinedMenuItem::separator(&app).map_err(|e| e.to_string())?;
        menu.append(&separator).map_err(|e| e.to_string())?;

        // Stop Timer (only enabled when running)
        let stop = MenuItem::with_id(&app, "stop", "Stop Timer", is_running, None::<&str>)
            .map_err(|e| e.to_string())?;
        menu.append(&stop).map_err(|e| e.to_string())?;

        // Separator before projects
        let separator2 = PredefinedMenuItem::separator(&app).map_err(|e| e.to_string())?;
        menu.append(&separator2).map_err(|e| e.to_string())?;

        // Project items with colored icons
        for project in &projects {
            let icon_data = generate_menu_icon(&project.color);
            let icon = Image::new_owned(icon_data, 16, 16);

            let item = IconMenuItem::with_id(
                &app,
                format!("project_{}", project.id),
                &project.name,
                true,
                Some(icon),
                None::<&str>,
            ).map_err(|e| e.to_string())?;
            menu.append(&item).map_err(|e| e.to_string())?;
        }

        // Separator before quit
        let separator3 = PredefinedMenuItem::separator(&app).map_err(|e| e.to_string())?;
        menu.append(&separator3).map_err(|e| e.to_string())?;

        // Quit
        let quit = MenuItem::with_id(&app, "quit", "Quit", true, None::<&str>)
            .map_err(|e| e.to_string())?;
        menu.append(&quit).map_err(|e| e.to_string())?;

        tray.set_menu(Some(menu)).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_positioner::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .manage(TrayState {
            tray: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![set_tray_title, clear_tray_title, set_tray_icon_color, reset_tray_icon, update_tray_menu])
        .setup(|app| {
            // Build tray menu
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let show = MenuItem::with_id(app, "show", "Show/Hide Timer", true, None::<&str>)?;
            let dashboard = MenuItem::with_id(app, "dashboard", "Dashboard", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &dashboard, &quit])?;

            // Create tray icon with gray circle (no timer running initially)
            let initial_icon_data = generate_colored_icon("#808080", None);
            let initial_icon = Image::new_owned(initial_icon_data, 22, 22);
            let _tray = TrayIconBuilder::new()
                .icon(initial_icon)
                .menu(&menu)
                .show_menu_on_left_click(true)
                .on_menu_event(|app, event| {
                    let event_id = event.id.as_ref();
                    match event_id {
                        "quit" => {
                            app.exit(0);
                        }
                        "show" => {
                            if let Some(window) = app.get_webview_window("main") {
                                if window.is_visible().unwrap_or(false) {
                                    let _ = window.hide();
                                } else {
                                    let _ = window.show();
                                    let _ = window.set_focus();
                                }
                            }
                        }
                        "dashboard" => {
                            if let Some(window) = app.get_webview_window("dashboard") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            } else {
                                // Window was closed, recreate it
                                let _ = WebviewWindowBuilder::new(
                                    app,
                                    "dashboard",
                                    WebviewUrl::App("index.html#/dashboard".into()),
                                )
                                .title("Time Tracker")
                                .inner_size(900.0, 650.0)
                                .min_inner_size(700.0, 500.0)
                                .resizable(true)
                                .center()
                                .build();
                            }
                        }
                        "stop" => {
                            // Emit event to frontend to stop the timer
                            let _ = app.emit("stop-timer", ());
                        }
                        _ => {
                            // Check for project clicks (format: "project_{id}")
                            if event_id.starts_with("project_") {
                                if let Some(id_str) = event_id.strip_prefix("project_") {
                                    if let Ok(project_id) = id_str.parse::<i64>() {
                                        // Emit event to frontend to start timer for this project
                                        let _ = app.emit("start-project-timer", project_id);
                                    }
                                }
                            }
                        }
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    tauri_plugin_positioner::on_tray_event(tray.app_handle(), &event);
                })
                .build(app)?;

            // Store tray reference for later updates
            *app.state::<TrayState>().tray.lock().unwrap() = Some(_tray);

            // Hide dock icon on macOS
            #[cfg(target_os = "macos")]
            {
                app.set_activation_policy(tauri::ActivationPolicy::Accessory);
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
