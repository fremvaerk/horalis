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
use ab_glyph::{FontRef, PxScale, Font};
use tokio::sync::watch;
use std::time::{SystemTime, UNIX_EPOCH};

/// Get idle time in seconds using system-idle-time crate
fn get_idle_time_seconds() -> Option<u64> {
    match system_idle_time::get_idle_time() {
        Ok(duration) => Some(duration.as_secs()),
        Err(_) => None,
    }
}

// Load bold system font for rendering letters (platform-specific paths)
static FONT_DATA: LazyLock<Option<Vec<u8>>> = LazyLock::new(|| {
    #[cfg(target_os = "macos")]
    let font_paths: &[&str] = &[
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        "/System/Library/Fonts/Supplemental/DIN Alternate Bold.ttf",
        "/System/Library/Fonts/SFNS.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
    ];

    #[cfg(target_os = "windows")]
    let font_paths: &[&str] = &[
        "C:\\Windows\\Fonts\\arialbd.ttf",
        "C:\\Windows\\Fonts\\arial.ttf",
        "C:\\Windows\\Fonts\\segoeui.ttf",
    ];

    #[cfg(target_os = "linux")]
    let font_paths: &[&str] = &[
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
        "/usr/share/fonts/TTF/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/noto/NotoSans-Bold.ttf",
    ];

    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    let font_paths: &[&str] = &[];

    for path in font_paths {
        if let Ok(data) = std::fs::read(path) {
            return Some(data);
        }
    }
    None
});

struct TrayState {
    tray: Mutex<Option<tauri::tray::TrayIcon>>,
}

// Timer state for native background timer
struct NativeTimerState {
    // Start time as Unix timestamp in milliseconds (None if not running)
    start_time_ms: Mutex<Option<u64>>,
    // Channel to signal stop to the background task
    stop_tx: Mutex<Option<watch::Sender<bool>>>,
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

    // Draw the letter if provided using TrueType font
    if let Some(ch) = letter {
        if let Some(font_data) = FONT_DATA.as_ref() {
            if let Ok(font) = FontRef::try_from_slice(font_data) {
                let upper_ch = ch.to_uppercase().next().unwrap_or(ch);

                // Scale to fit nicely in the circle
                let font_size = 16.0f32;
                let scale = PxScale::from(font_size);

                // Get glyph for the character
                let glyph_id = font.glyph_id(upper_ch);
                let glyph = glyph_id.with_scale(scale);

                if let Some(outlined) = font.outline_glyph(glyph) {
                    let bounds = outlined.px_bounds();
                    let glyph_width = bounds.width();
                    let glyph_height = bounds.height();

                    // Center the glyph in the icon
                    let offset_x = (size as f32 - glyph_width) / 2.0;
                    let offset_y = (size as f32 - glyph_height) / 2.0 + 1.0; // +1 for optical centering

                    // Draw the glyph - px, py are relative to the glyph's bounding box origin
                    outlined.draw(|gx, gy, coverage| {
                        // gx, gy are pixel coordinates within the glyph's bounding box
                        let x = (gx as f32 + offset_x) as i32;
                        let y = (gy as f32 + offset_y) as i32;

                        if x >= 0 && x < size as i32 && y >= 0 && y < size as i32 {
                            let x = x as u32;
                            let y = y as u32;

                            // Check if this pixel is inside the circle (with small margin)
                            let dx = x as f32 - center;
                            let dy = y as f32 - center;
                            let distance = (dx * dx + dy * dy).sqrt();

                            if distance <= radius - 0.5 {
                                let idx = ((y * size + x) * 4) as usize;
                                // Blend white letter with coverage (anti-aliasing)
                                let alpha = (coverage * 255.0) as u8;
                                if alpha > 0 {
                                    // Alpha blend white over the background color
                                    let bg_r = rgba[idx];
                                    let bg_g = rgba[idx + 1];
                                    let bg_b = rgba[idx + 2];
                                    let a = alpha as f32 / 255.0;
                                    rgba[idx] = (255.0 * a + bg_r as f32 * (1.0 - a)) as u8;
                                    rgba[idx + 1] = (255.0 * a + bg_g as f32 * (1.0 - a)) as u8;
                                    rgba[idx + 2] = (255.0 * a + bg_b as f32 * (1.0 - a)) as u8;
                                }
                            }
                        }
                    });
                }
            }
        }
    }

    rgba
}

/// Format elapsed seconds as "H:MM" for tray title
fn format_tray_time(elapsed_secs: u64) -> String {
    let h = elapsed_secs / 3600;
    let m = (elapsed_secs % 3600) / 60;
    format!("{}:{:02}", h, m)
}

/// Helper to set tray title (macOS only - on other platforms this is a no-op)
#[cfg(target_os = "macos")]
fn set_tray_title_platform(tray: &tauri::tray::TrayIcon, title: Option<&str>) {
    let _ = tray.set_title(title);
}

#[cfg(not(target_os = "macos"))]
fn set_tray_title_platform(_tray: &tauri::tray::TrayIcon, _title: Option<&str>) {
    // Tray titles are only supported on macOS
}

#[tauri::command]
async fn start_tray_timer(
    app: tauri::AppHandle,
    start_time_ms: u64,
    idle_enabled: Option<bool>,
    idle_timeout_minutes: Option<u64>,
) -> Result<(), String> {
    let timer_state = app.state::<NativeTimerState>();
    let tray_state = app.state::<TrayState>();

    // Stop any existing timer first
    {
        let mut stop_tx_guard = timer_state.stop_tx.lock().unwrap();
        if let Some(tx) = stop_tx_guard.take() {
            let _ = tx.send(true);
        }
    }

    // Store the start time
    *timer_state.start_time_ms.lock().unwrap() = Some(start_time_ms);

    // Create channel for stopping
    let (stop_tx, mut stop_rx) = watch::channel(false);
    *timer_state.stop_tx.lock().unwrap() = Some(stop_tx);

    // Set initial tray title
    let now_ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);
    let elapsed_secs = (now_ms.saturating_sub(start_time_ms)) / 1000;
    let initial_title = format_tray_time(elapsed_secs);

    if let Some(tray) = tray_state.tray.lock().unwrap().as_ref() {
        set_tray_title_platform(tray, Some(&initial_title));
    }

    // Clone what we need for the background task
    let app_handle = app.clone();
    let idle_check_enabled = idle_enabled.unwrap_or(false);
    let idle_timeout_secs = idle_timeout_minutes.unwrap_or(5) * 60;

    // Spawn background task to update tray title every minute
    tauri::async_runtime::spawn(async move {
        let mut last_minutes = elapsed_secs / 60;

        loop {
            // Wait for ~10 seconds or until stopped
            tokio::select! {
                _ = tokio::time::sleep(std::time::Duration::from_secs(10)) => {}
                _ = stop_rx.changed() => {
                    if *stop_rx.borrow() {
                        return;
                    }
                }
            }

            // Check if we should stop
            if *stop_rx.borrow() {
                return;
            }

            // Get current start time (might have been cleared)
            let timer_state = app_handle.state::<NativeTimerState>();
            let start_time: Option<u64> = *timer_state.start_time_ms.lock().unwrap();

            let Some(start_ms) = start_time else {
                return;
            };

            // Check for idle timeout if enabled
            if idle_check_enabled {
                if let Some(idle_secs) = get_idle_time_seconds() {
                    if idle_secs >= idle_timeout_secs {
                        // Emit idle timeout event to frontend
                        let _ = app_handle.emit("idle-timeout", idle_secs);
                        return;
                    }
                }
            }

            // Calculate elapsed time
            let now_ms = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .map(|d| d.as_millis() as u64)
                .unwrap_or(0);
            let elapsed_secs = (now_ms.saturating_sub(start_ms)) / 1000;
            let current_minutes = elapsed_secs / 60;

            // Only update tray when minutes change
            if current_minutes != last_minutes {
                last_minutes = current_minutes;
                let title = format_tray_time(elapsed_secs);

                let tray_state = app_handle.state::<TrayState>();
                let guard = tray_state.tray.lock().unwrap();
                if let Some(tray) = guard.as_ref() {
                    set_tray_title_platform(tray, Some(&title));
                }
            }
        }
    });

    Ok(())
}

#[tauri::command]
fn stop_tray_timer(app: tauri::AppHandle) {
    let timer_state = app.state::<NativeTimerState>();

    // Clear start time
    *timer_state.start_time_ms.lock().unwrap() = None;

    // Signal stop to background task
    {
        let mut stop_tx_guard = timer_state.stop_tx.lock().unwrap();
        if let Some(tx) = stop_tx_guard.take() {
            let _ = tx.send(true);
        }
    }

    // Clear tray title
    let tray_state = app.state::<TrayState>();
    let guard = tray_state.tray.lock().unwrap();
    if let Some(tray) = guard.as_ref() {
        set_tray_title_platform(tray, Some(""));
    }
}

#[tauri::command]
fn set_tray_title(state: tauri::State<TrayState>, title: String) {
    if let Some(tray) = state.tray.lock().unwrap().as_ref() {
        set_tray_title_platform(tray, Some(&title));
    }
}

#[tauri::command]
fn clear_tray_title(state: tauri::State<TrayState>) {
    if let Some(tray) = state.tray.lock().unwrap().as_ref() {
        // Use empty string instead of None - None might not clear on macOS
        set_tray_title_platform(tray, Some(""));
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
        .manage(NativeTimerState {
            start_time_ms: Mutex::new(None),
            stop_tx: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![set_tray_title, clear_tray_title, set_tray_icon_color, reset_tray_icon, update_tray_menu, start_tray_timer, stop_tray_timer])
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
