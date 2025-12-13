use tauri::{
    image::Image,
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, WebviewUrl, WebviewWindowBuilder,
};
// WindowExt trait needed for on_tray_event positioning
#[allow(unused_imports)]
use tauri_plugin_positioner::WindowExt;
use std::sync::Mutex;

struct TrayState {
    tray: Mutex<Option<tauri::tray::TrayIcon>>,
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

/// Generate a simple colored circle icon (22x22 for macOS menu bar)
fn generate_colored_icon(hex_color: &str) -> Vec<u8> {
    let size = 22u32;
    let (r, g, b) = parse_hex_color(hex_color).unwrap_or((91, 164, 196)); // Default to app blue

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
fn set_tray_icon_color(state: tauri::State<TrayState>, color: String) {
    if let Some(tray) = state.tray.lock().unwrap().as_ref() {
        let icon_data = generate_colored_icon(&color);
        let icon = Image::new_owned(icon_data, 22, 22);
        let _ = tray.set_icon(Some(icon));
    }
}

#[tauri::command]
fn reset_tray_icon(state: tauri::State<TrayState>) {
    if let Some(tray) = state.tray.lock().unwrap().as_ref() {
        // Reset to a neutral gray color when timer is stopped
        let icon_data = generate_colored_icon("#808080");
        let icon = Image::new_owned(icon_data, 22, 22);
        let _ = tray.set_icon(Some(icon));
    }
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
        .invoke_handler(tauri::generate_handler![set_tray_title, clear_tray_title, set_tray_icon_color, reset_tray_icon])
        .setup(|app| {
            // Build tray menu
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let show = MenuItem::with_id(app, "show", "Show/Hide Timer", true, None::<&str>)?;
            let dashboard = MenuItem::with_id(app, "dashboard", "Dashboard", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &dashboard, &quit])?;

            // Create tray icon
            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
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
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    tauri_plugin_positioner::on_tray_event(tray.app_handle(), &event);

                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("dashboard") {
                            if window.is_visible().unwrap_or(false) {
                                let _ = window.hide();
                            } else {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
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
