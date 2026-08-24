pub mod app_state;
pub mod application;
pub mod domain;
pub mod infrastructure;
pub mod presentation;

use app_state::AppState;
use application::{
    foreground_monitor::ForegroundEffect, gamcha_service::GamchaService,
    settings_service::SettingsService, todo_service::TodoService,
};
use domain::pomodoro::PomodoroPhase;
use tauri::{Emitter, Manager};
#[cfg(windows)]
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

#[cfg(windows)]
fn emergency_shortcut() -> Shortcut {
    Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::F12)
}

pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let app_data_dir = app.path().app_data_dir()?;
            let settings_service = SettingsService::new(app_data_dir.clone());
            let settings = settings_service.load_or_default();
            let gamcha_service = GamchaService::new(app_data_dir.clone());
            let todo_service = TodoService::new(app_data_dir);
            app.manage(AppState::new(
                settings,
                settings_service,
                gamcha_service,
                todo_service,
            ));
            if let Some(rope) = app.get_webview_window("climb-rope") {
                let _ = rope.set_ignore_cursor_events(true);
            }
            let timer_app = app.handle().clone();
            let _ = std::thread::Builder::new()
                .name("pomodoro-ticker".to_owned())
                .spawn(move || {
                    let mut last_resource_update = std::time::Instant::now()
                        .checked_sub(std::time::Duration::from_secs(1))
                        .unwrap_or_else(std::time::Instant::now);
                    loop {
                        std::thread::sleep(std::time::Duration::from_millis(250));
                        let state = timer_app.state::<AppState>();
                        if last_resource_update.elapsed() >= std::time::Duration::from_secs(1) {
                            if let Ok(metrics) = state.system_metrics_monitor.poll() {
                                presentation::tray::update_resource_indicators(&timer_app, metrics);
                            }
                            last_resource_update = std::time::Instant::now();
                        }
                        let Ok(snapshot) = presentation::commands::tick_timer(&timer_app, &state)
                        else {
                            continue;
                        };
                        let focus_settings = state
                            .settings
                            .read()
                            .map(|settings| settings.focus_guard.clone());
                        if let Ok(focus_settings) = focus_settings {
                            let emergency = state
                                .emergency_stopped
                                .load(std::sync::atomic::Ordering::SeqCst);
                            if let Ok(effects) = state.foreground_monitor.poll(
                                std::time::Instant::now(),
                                snapshot.phase == PomodoroPhase::Focus,
                                emergency,
                                &focus_settings,
                            ) {
                                for effect in effects {
                                    match effect {
                                        ForegroundEffect::Detection(detection) => {
                                            let _ = timer_app.emit("focus://detection", detection);
                                        }
                                        ForegroundEffect::Start(request) => {
                                            if let Some(card) = timer_app.get_webview_window("card")
                                            {
                                                let _ = card.set_position(
                                                    tauri::PhysicalPosition::new(
                                                        request.start_x,
                                                        request.y,
                                                    ),
                                                );
                                                let _ = card.show();
                                                let _ = card
                                                    .emit("focus://intervention-start", request);
                                            }
                                        }
                                        ForegroundEffect::Cancel(intervention_id) => {
                                            if let Some(card) = timer_app.get_webview_window("card")
                                            {
                                                let _ = card.emit(
                                                    "focus://intervention-cancel",
                                                    intervention_id,
                                                );
                                                let _ = card.hide();
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                });
            let tray_available = presentation::tray::build(app).is_ok();
            app.state::<AppState>()
                .tray_available
                .store(tray_available, std::sync::atomic::Ordering::SeqCst);
            #[cfg(windows)]
            {
                let plugin_available = app
                    .handle()
                    .plugin(
                        tauri_plugin_global_shortcut::Builder::new()
                            .with_handler(|app, shortcut, event| {
                                if event.state() == ShortcutState::Pressed
                                    && shortcut
                                        .matches(Modifiers::CONTROL | Modifiers::SHIFT, Code::F12)
                                {
                                    let state = app.state::<AppState>();
                                    let _ =
                                        presentation::commands::emergency_stop(app.clone(), state);
                                }
                            })
                            .build(),
                    )
                    .is_ok();
                let registered = plugin_available
                    && app.global_shortcut().register(emergency_shortcut()).is_ok();
                app.state::<AppState>()
                    .emergency_shortcut_available
                    .store(registered, std::sync::atomic::Ordering::SeqCst);
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            presentation::commands::get_bootstrap_state,
            presentation::commands::save_settings,
            presentation::commands::get_timer_state,
            presentation::commands::get_detection_state,
            presentation::commands::get_system_metrics,
            presentation::commands::get_climbable_windows,
            presentation::commands::show_climb_rope,
            presentation::commands::hide_climb_rope,
            presentation::commands::get_gamcha_state,
            presentation::commands::get_todo_state,
            presentation::commands::add_todo,
            presentation::commands::update_todo,
            presentation::commands::set_todo_completed,
            presentation::commands::select_todo,
            presentation::commands::delete_todo,
            presentation::commands::resolve_focus_todo,
            presentation::commands::draw_gamcha,
            presentation::commands::equip_gamcha_costume,
            presentation::commands::set_gamcha_costume_alignment,
            presentation::commands::complete_intervention,
            presentation::commands::cancel_intervention,
            presentation::commands::start_focus,
            presentation::commands::pause_timer,
            presentation::commands::resume_timer,
            presentation::commands::skip_phase,
            presentation::commands::stop_timer,
            presentation::commands::emergency_stop,
            presentation::commands::resume_pet,
            presentation::commands::start_photo_delivery,
            presentation::commands::begin_photo_delivery_motion,
            presentation::commands::settle_photo_delivery,
            presentation::commands::expand_photo_delivery_for_rain,
            presentation::commands::finish_photo_delivery,
            presentation::commands::position_timer_bubble,
            presentation::commands::position_gamcha_bubble,
            presentation::commands::show_pet_context_menu,
            presentation::commands::toggle_timer_bubble,
            presentation::commands::show_utility_window,
            presentation::commands::hide_utility_window,
            presentation::commands::quit_application
        ])
        .on_window_event(|window, event| {
            if window.label() == "pet-menu" && matches!(event, tauri::WindowEvent::Focused(false)) {
                let _ = window.hide();
            }
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if window.label() != "pet" {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running the desktop pet application");
}
