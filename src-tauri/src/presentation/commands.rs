use std::{sync::atomic::Ordering, time::Instant};

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State};

use crate::{
    app_state::AppState,
    application::{
        foreground_monitor::DetectionState,
        gamcha_service::{CostumeAlignment, GamchaDrawResult, GamchaSnapshot},
        pomodoro_service::TimerState,
        todo_service::TodoSnapshot,
    },
    domain::{
        pomodoro::{PomodoroEvent, PomodoroPhase},
        settings::{ResourceResponseMode, Settings},
    },
    infrastructure::windows::{climbable_windows, WindowSurface},
};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BootstrapState {
    settings: Settings,
    emergency_stopped: bool,
    emergency_shortcut_available: bool,
    tray_available: bool,
}

#[tauri::command]
pub fn get_bootstrap_state(state: State<'_, AppState>) -> Result<BootstrapState, String> {
    let settings = state
        .settings
        .read()
        .map_err(|_| "settings state is unavailable".to_owned())?
        .clone();
    Ok(BootstrapState {
        settings,
        emergency_stopped: state.emergency_stopped.load(Ordering::SeqCst),
        emergency_shortcut_available: state.emergency_shortcut_available.load(Ordering::SeqCst),
        tray_available: state.tray_available.load(Ordering::SeqCst),
    })
}

#[tauri::command]
pub fn save_settings(
    app: AppHandle,
    state: State<'_, AppState>,
    settings: Settings,
) -> Result<Settings, String> {
    let normalized = settings.validate().map_err(|error| error.to_string())?;
    state.settings_service.save(&normalized)?;
    state
        .pomodoro_service
        .update_settings(&normalized.pomodoro)?;
    *state
        .settings
        .write()
        .map_err(|_| "settings state is unavailable".to_owned())? = normalized.clone();
    let _ = app.emit("settings://saved", &normalized);

    Ok(normalized)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemMetricsState {
    cpu_percent: u8,
    memory_percent: u8,
    mode: ResourceResponseMode,
}

#[tauri::command]
pub fn get_system_metrics(state: State<'_, AppState>) -> Result<SystemMetricsState, String> {
    let metrics = state.system_metrics_monitor.poll()?;
    let mode = state
        .settings
        .read()
        .map_err(|_| "settings state is unavailable".to_owned())?
        .pet
        .resource_response_mode;
    Ok(SystemMetricsState {
        cpu_percent: metrics.cpu_percent,
        memory_percent: metrics.memory_percent,
        mode,
    })
}

#[tauri::command]
pub fn get_climbable_windows() -> Vec<WindowSurface> {
    climbable_windows()
}

#[tauri::command]
pub fn is_youtube_music_active() -> bool {
    crate::infrastructure::windows::youtube_music_in_chrome()
}

#[tauri::command]
pub fn get_battery_state() -> Result<crate::infrastructure::windows::BatterySnapshot, String> {
    crate::infrastructure::windows::battery_snapshot()
}

#[tauri::command]
pub fn test_low_battery_event(app: AppHandle) -> Result<(), String> {
    app.emit("battery://test", ())
        .map_err(|_| "battery test event could not be started".to_owned())
}

const PET_WINDOW_WIDTH: u32 = 128;
const PET_WINDOW_HEIGHT: u32 = 128;
const MUSIC_STAGE_WIDTH: u32 = 280;
const MUSIC_STAGE_HEIGHT: u32 = 220;

fn anchored_window_position(
    x: i32,
    y: i32,
    width: u32,
    height: u32,
    target_width: u32,
    target_height: u32,
) -> (i32, i32) {
    let center_x = i64::from(x) + i64::from(width) / 2;
    let bottom = i64::from(y) + i64::from(height);
    (
        (center_x - i64::from(target_width) / 2) as i32,
        (bottom - i64::from(target_height)) as i32,
    )
}

#[tauri::command]
pub fn set_music_stage_expanded(app: AppHandle, expanded: bool) -> Result<(), String> {
    let pet = app
        .get_webview_window("pet")
        .ok_or_else(|| "pet window is unavailable".to_owned())?;
    let position = pet
        .outer_position()
        .map_err(|_| "pet position is unavailable".to_owned())?;
    let size = pet
        .outer_size()
        .map_err(|_| "pet size is unavailable".to_owned())?;
    let (target_width, target_height) = if expanded {
        (MUSIC_STAGE_WIDTH, MUSIC_STAGE_HEIGHT)
    } else {
        (PET_WINDOW_WIDTH, PET_WINDOW_HEIGHT)
    };
    let (target_x, target_y) = anchored_window_position(
        position.x,
        position.y,
        size.width,
        size.height,
        target_width,
        target_height,
    );
    pet.set_position(tauri::PhysicalPosition::new(target_x, target_y))
        .map_err(|_| "music stage could not be positioned".to_owned())?;
    pet.set_size(tauri::PhysicalSize::new(target_width, target_height))
        .map_err(|_| "music stage could not be resized".to_owned())
}

fn climb_rope_rect(x: i32, top: i32, bottom: i32, side: &str) -> (i32, i32, u32) {
    let normalized_top = top.min(bottom);
    let normalized_bottom = bottom.max(top);
    let height = (normalized_bottom - normalized_top).clamp(24, 4096) as u32;
    let window_x = if side == "left" { x - 16 } else { x - 160 };
    (window_x, normalized_top, height)
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ClimbRopeState<'a> {
    progress: f64,
    side: &'a str,
}

#[tauri::command]
pub fn show_climb_rope(
    app: AppHandle,
    x: i32,
    top: i32,
    bottom: i32,
    progress: f64,
    side: String,
) -> Result<(), String> {
    if !matches!(side.as_str(), "left" | "right") {
        return Err("invalid climb rope side".to_owned());
    }
    let rope = app
        .get_webview_window("climb-rope")
        .ok_or_else(|| "climb rope window is unavailable".to_owned())?;
    let (window_x, window_y, height) = climb_rope_rect(x, top, bottom, &side);
    rope.set_position(tauri::PhysicalPosition::new(window_x, window_y))
        .map_err(|_| "climb rope could not be positioned".to_owned())?;
    rope.set_size(tauri::PhysicalSize::new(176, height))
        .map_err(|_| "climb rope could not be resized".to_owned())?;
    rope.show()
        .map_err(|_| "climb rope could not be shown".to_owned())?;
    rope.emit(
        "climb-rope://state",
        ClimbRopeState {
            progress: progress.clamp(0.0, 1.0),
            side: &side,
        },
    )
    .map_err(|_| "climb rope animation could not be updated".to_owned())
}

#[tauri::command]
pub fn hide_climb_rope(app: AppHandle) -> Result<(), String> {
    app.get_webview_window("climb-rope")
        .ok_or_else(|| "climb rope window is unavailable".to_owned())?
        .hide()
        .map_err(|_| "climb rope could not be hidden".to_owned())
}

fn dispatch_timer(
    app: &AppHandle,
    state: &AppState,
    event: PomodoroEvent,
) -> Result<TimerState, String> {
    if event == PomodoroEvent::Tick {
        return tick_timer(app, state);
    }
    let (snapshot, changed) = state.pomodoro_service.dispatch(event, Instant::now())?;
    if changed {
        app.emit("timer://state", &snapshot)
            .map_err(|_| "timer state notification failed".to_owned())?;
    }
    Ok(snapshot)
}

pub(crate) fn tick_timer(app: &AppHandle, state: &AppState) -> Result<TimerState, String> {
    let (snapshot, changed, focus_completed) = state.pomodoro_service.tick(Instant::now())?;
    if changed {
        let _ = app.emit("timer://state", &snapshot);
    }
    if focus_completed {
        let todo = state.todo_service.finish_focus()?;
        let _ = app.emit("todo://changed", &todo);
        if todo.pending_focus_todo.is_some() {
            let _ = app.emit("todo://focus-completed", &todo);
        }
        let gamcha = state.gamcha_service.award_ticket()?;
        let _ = app.emit("gamcha://ticket-earned", &gamcha);
        let _ = show_gamcha_reward(app);
    }
    Ok(snapshot)
}

#[tauri::command]
pub fn get_timer_state(app: AppHandle, state: State<'_, AppState>) -> Result<TimerState, String> {
    dispatch_timer(&app, &state, PomodoroEvent::Tick)
}

#[tauri::command]
pub fn get_detection_state(state: State<'_, AppState>) -> Result<DetectionState, String> {
    state.foreground_monitor.state()
}

#[tauri::command]
pub fn get_gamcha_state(state: State<'_, AppState>) -> Result<GamchaSnapshot, String> {
    state.gamcha_service.snapshot()
}

fn emit_todo(app: &AppHandle, snapshot: &TodoSnapshot, celebrated: bool) {
    let _ = app.emit("todo://changed", snapshot);
    if celebrated {
        let _ = app.emit("todo://all-completed", snapshot);
    }
}

#[tauri::command]
pub fn get_todo_state(state: State<'_, AppState>) -> Result<TodoSnapshot, String> {
    state.todo_service.snapshot()
}

#[tauri::command]
pub fn add_todo(
    app: AppHandle,
    state: State<'_, AppState>,
    text: String,
) -> Result<TodoSnapshot, String> {
    let snapshot = state.todo_service.add(&text)?;
    emit_todo(&app, &snapshot, false);
    Ok(snapshot)
}

#[tauri::command]
pub fn update_todo(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
    text: String,
) -> Result<TodoSnapshot, String> {
    let snapshot = state.todo_service.update(&id, &text)?;
    emit_todo(&app, &snapshot, false);
    Ok(snapshot)
}

#[tauri::command]
pub fn set_todo_completed(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
    completed: bool,
) -> Result<TodoSnapshot, String> {
    let (snapshot, celebrated) = state.todo_service.set_completed(&id, completed)?;
    emit_todo(&app, &snapshot, celebrated);
    Ok(snapshot)
}

#[tauri::command]
pub fn select_todo(
    app: AppHandle,
    state: State<'_, AppState>,
    id: Option<String>,
) -> Result<TodoSnapshot, String> {
    let snapshot = state.todo_service.select(id)?;
    emit_todo(&app, &snapshot, false);
    Ok(snapshot)
}

#[tauri::command]
pub fn delete_todo(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> Result<TodoSnapshot, String> {
    let snapshot = state.todo_service.delete(&id)?;
    emit_todo(&app, &snapshot, false);
    Ok(snapshot)
}

#[tauri::command]
pub fn resolve_focus_todo(
    app: AppHandle,
    state: State<'_, AppState>,
    action: String,
) -> Result<TodoSnapshot, String> {
    if !matches!(action.as_str(), "complete" | "continue" | "next") {
        return Err("unsupported focus todo action".to_owned());
    }
    let (mut snapshot, celebrated) = state.todo_service.resolve_focus(action == "complete")?;
    emit_todo(&app, &snapshot, celebrated);
    if action == "next" {
        let timer = dispatch_timer(&app, &state, PomodoroEvent::Tick)?;
        if matches!(
            timer.phase,
            PomodoroPhase::ShortBreak | PomodoroPhase::LongBreak
        ) {
            let _ = dispatch_timer(&app, &state, PomodoroEvent::Skip)?;
            snapshot = state.todo_service.begin_focus()?;
            emit_todo(&app, &snapshot, false);
        }
    }
    Ok(snapshot)
}

#[tauri::command]
pub fn draw_gamcha(state: State<'_, AppState>) -> Result<GamchaDrawResult, String> {
    state.gamcha_service.draw()
}

#[tauri::command]
pub fn equip_gamcha_costume(
    app: AppHandle,
    state: State<'_, AppState>,
    costume_id: Option<String>,
) -> Result<GamchaSnapshot, String> {
    let snapshot = state.gamcha_service.equip(costume_id)?;
    let _ = app.emit("gamcha://equipped", &snapshot);
    Ok(snapshot)
}

#[tauri::command]
pub fn set_gamcha_costume_alignment(
    app: AppHandle,
    state: State<'_, AppState>,
    costume_id: String,
    alignment: Option<CostumeAlignment>,
) -> Result<GamchaSnapshot, String> {
    let snapshot = state.gamcha_service.set_alignment(costume_id, alignment)?;
    let _ = app.emit("gamcha://equipped", &snapshot);
    Ok(snapshot)
}

#[tauri::command]
pub fn complete_intervention(
    app: AppHandle,
    state: State<'_, AppState>,
    intervention_id: u64,
) -> Result<bool, String> {
    let timer = dispatch_timer(&app, &state, PomodoroEvent::Tick)?;
    let settings = state
        .settings
        .read()
        .map_err(|_| "settings state is unavailable".to_owned())?
        .focus_guard
        .clone();
    let minimized = state.foreground_monitor.complete(
        intervention_id,
        Instant::now(),
        timer.phase == PomodoroPhase::Focus,
        state.emergency_stopped.load(Ordering::SeqCst),
        &settings,
    )?;
    if let Some(card) = app.get_webview_window("card") {
        let _ = card.hide();
    }
    Ok(minimized)
}

#[tauri::command]
pub fn cancel_intervention(
    app: AppHandle,
    state: State<'_, AppState>,
    intervention_id: u64,
) -> Result<(), String> {
    state.foreground_monitor.cancel(intervention_id)?;
    if let Some(card) = app.get_webview_window("card") {
        let _ = card.hide();
    }
    Ok(())
}

#[tauri::command]
pub fn start_focus(app: AppHandle, state: State<'_, AppState>) -> Result<TimerState, String> {
    let before = dispatch_timer(&app, &state, PomodoroEvent::Tick)?;
    let snapshot = dispatch_timer(&app, &state, PomodoroEvent::Start)?;
    if before.phase == PomodoroPhase::Stopped && snapshot.phase == PomodoroPhase::Focus {
        let todo = state.todo_service.begin_focus()?;
        emit_todo(&app, &todo, false);
    }
    Ok(snapshot)
}

#[tauri::command]
pub fn pause_timer(app: AppHandle, state: State<'_, AppState>) -> Result<TimerState, String> {
    dispatch_timer(&app, &state, PomodoroEvent::Pause)
}

#[tauri::command]
pub fn resume_timer(app: AppHandle, state: State<'_, AppState>) -> Result<TimerState, String> {
    dispatch_timer(&app, &state, PomodoroEvent::Resume)
}

#[tauri::command]
pub fn skip_phase(app: AppHandle, state: State<'_, AppState>) -> Result<TimerState, String> {
    let before = dispatch_timer(&app, &state, PomodoroEvent::Tick)?;
    let snapshot = dispatch_timer(&app, &state, PomodoroEvent::Skip)?;
    if before.phase == PomodoroPhase::Focus {
        let todo = state.todo_service.cancel_focus()?;
        emit_todo(&app, &todo, false);
    } else if snapshot.phase == PomodoroPhase::Focus {
        let todo = state.todo_service.begin_focus()?;
        emit_todo(&app, &todo, false);
    }
    Ok(snapshot)
}

#[tauri::command]
pub fn stop_timer(app: AppHandle, state: State<'_, AppState>) -> Result<TimerState, String> {
    let snapshot = dispatch_timer(&app, &state, PomodoroEvent::Stop)?;
    let todo = state.todo_service.cancel_focus()?;
    emit_todo(&app, &todo, false);
    Ok(snapshot)
}

#[tauri::command]
pub fn emergency_stop(app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    state.emergency_stopped.store(true, Ordering::SeqCst);
    let _ = state.foreground_monitor.cancel_all()?;
    let _ = dispatch_timer(&app, &state, PomodoroEvent::Pause)?;
    for label in ["pet", "card", "gamcha-notice", "gamcha", "photo-delivery"] {
        if let Some(window) = app.get_webview_window(label) {
            let _ = window.hide();
        }
    }
    app.emit("app://emergency-stopped", ())
        .map_err(|_| "emergency stop notification failed".to_owned())
}

#[tauri::command]
pub fn resume_pet(app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    state.emergency_stopped.store(false, Ordering::SeqCst);
    if let Some(delivery) = app.get_webview_window("photo-delivery") {
        let _ = delivery.emit("photo://reset", ());
        let _ = delivery.hide();
    }
    if let Some(window) = app.get_webview_window("pet") {
        window
            .set_always_on_top(true)
            .map_err(|_| "pet window could not be kept above desktop windows".to_owned())?;
        window
            .show()
            .map_err(|_| "pet window could not be shown".to_owned())?;
    }
    Ok(())
}

fn prepare_photo_delivery_overlay(app: &AppHandle) -> Result<(), String> {
    let pet = app
        .get_webview_window("pet")
        .ok_or_else(|| "pet window is unavailable".to_owned())?;
    let delivery = app
        .get_webview_window("photo-delivery")
        .ok_or_else(|| "photo delivery window is unavailable".to_owned())?;
    let monitor = pet
        .current_monitor()
        .map_err(|_| "pet monitor is unavailable".to_owned())?
        .ok_or_else(|| "pet monitor is unavailable".to_owned())?;
    let work_area = monitor.work_area();
    delivery
        .set_position(work_area.position)
        .map_err(|_| "photo delivery monitor could not be selected".to_owned())?;
    delivery
        .set_size(work_area.size)
        .map_err(|_| "photo delivery overlay could not fit the work area".to_owned())?;
    delivery
        .set_ignore_cursor_events(true)
        .map_err(|_| "photo delivery overlay could not pass pointer input".to_owned())
}

#[tauri::command]
pub fn start_photo_delivery(
    app: AppHandle,
    state: State<'_, AppState>,
    automatic: Option<bool>,
    force_special_photo: Option<bool>,
) -> Result<bool, String> {
    if automatic.unwrap_or(false)
        && !state
            .settings
            .read()
            .map_err(|_| "settings state is unavailable".to_owned())?
            .pet
            .automatic_photo_delivery_enabled
    {
        return Ok(false);
    }
    if state.emergency_stopped.load(Ordering::SeqCst) {
        return Ok(false);
    }
    let timer = dispatch_timer(&app, &state, PomodoroEvent::Tick)?;
    if timer.phase != PomodoroPhase::Stopped {
        return Ok(false);
    }
    let delivery = app
        .get_webview_window("photo-delivery")
        .ok_or_else(|| "photo delivery window is unavailable".to_owned())?;
    if delivery
        .is_visible()
        .map_err(|_| "photo delivery visibility is unavailable".to_owned())?
    {
        return Ok(false);
    }
    prepare_photo_delivery_overlay(&app)?;
    delivery
        .show()
        .map_err(|_| "photo delivery could not be shown".to_owned())?;
    #[derive(Clone, Serialize)]
    #[serde(rename_all = "camelCase")]
    struct PhotoDeliveryRequest {
        force_special_photo: bool,
    }

    if delivery
        .emit(
            "photo://deliver",
            PhotoDeliveryRequest {
                force_special_photo: force_special_photo.unwrap_or(false),
            },
        )
        .is_err()
    {
        let _ = delivery.hide();
        if let Some(pet) = app.get_webview_window("pet") {
            let _ = pet.set_always_on_top(true);
            let _ = pet.show();
        }
        return Err("photo delivery could not be started".to_owned());
    }
    Ok(true)
}

#[tauri::command]
pub fn begin_photo_delivery_motion(app: AppHandle) -> Result<(), String> {
    app.get_webview_window("pet")
        .ok_or_else(|| "pet window is unavailable".to_owned())?
        .hide()
        .map_err(|_| "pet window could not be hidden".to_owned())
}

#[tauri::command]
pub fn settle_photo_delivery(
    app: AppHandle,
    state: State<'_, AppState>,
    left: f64,
    top: f64,
    width: f64,
    height: f64,
) -> Result<(), String> {
    let delivery = app
        .get_webview_window("photo-delivery")
        .ok_or_else(|| "photo delivery window is unavailable".to_owned())?;
    let pet = app
        .get_webview_window("pet")
        .ok_or_else(|| "pet window is unavailable".to_owned())?;
    let monitor = delivery
        .current_monitor()
        .map_err(|_| "photo delivery monitor is unavailable".to_owned())?
        .ok_or_else(|| "photo delivery monitor is unavailable".to_owned())?;
    let work_area = monitor.work_area();
    let scale = delivery
        .scale_factor()
        .map_err(|_| "photo delivery scale is unavailable".to_owned())?;
    let logical_work_width = work_area.size.width as f64 / scale;
    let logical_work_height = work_area.size.height as f64 / scale;
    let width = width.clamp(240.0, logical_work_width.min(720.0));
    let height = height.clamp(180.0, logical_work_height.min(620.0));
    let left = left.clamp(0.0, (logical_work_width - width).max(0.0));
    let top = top.clamp(0.0, (logical_work_height - height).max(0.0));
    let physical_width = (width * scale).round() as u32;
    let physical_height = (height * scale).round() as u32;
    let x = work_area.position.x + (left * scale).round() as i32;
    let y = work_area.position.y + (top * scale).round() as i32;
    delivery
        .set_size(tauri::PhysicalSize::new(physical_width, physical_height))
        .map_err(|_| "delivered photo could not be resized".to_owned())?;
    delivery
        .set_position(tauri::PhysicalPosition::new(x, y))
        .map_err(|_| "delivered photo could not be positioned".to_owned())?;
    delivery
        .set_ignore_cursor_events(false)
        .map_err(|_| "delivered photo could not receive pointer input".to_owned())?;
    if !state.emergency_stopped.load(Ordering::SeqCst) {
        pet.set_always_on_top(true)
            .map_err(|_| "pet window could not be kept above desktop windows".to_owned())?;
        pet.show()
            .map_err(|_| "pet window could not be restored".to_owned())?;
    }
    delivery
        .emit("photo://settled", ())
        .map_err(|_| "delivered photo could not be settled".to_owned())
}

#[tauri::command]
pub fn finish_photo_delivery(app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    if let Some(delivery) = app.get_webview_window("photo-delivery") {
        delivery
            .hide()
            .map_err(|_| "photo delivery could not be hidden".to_owned())?;
    }
    if !state.emergency_stopped.load(Ordering::SeqCst) {
        if let Some(pet) = app.get_webview_window("pet") {
            pet.set_always_on_top(true)
                .map_err(|_| "pet window could not be kept above desktop windows".to_owned())?;
            pet.show()
                .map_err(|_| "pet window could not be restored".to_owned())?;
        }
    }
    Ok(())
}

#[tauri::command]
pub fn expand_photo_delivery_for_rain(app: AppHandle) -> Result<(), String> {
    prepare_photo_delivery_overlay(&app)
}

pub fn place_timer_bubble(app: &AppHandle) -> Result<(), String> {
    let pet = app
        .get_webview_window("pet")
        .ok_or_else(|| "pet window is unavailable".to_owned())?;
    let timer = app
        .get_webview_window("timer")
        .ok_or_else(|| "timer window is unavailable".to_owned())?;
    let pet_position = pet
        .outer_position()
        .map_err(|_| "pet position is unavailable".to_owned())?;
    let pet_size = pet
        .outer_size()
        .map_err(|_| "pet size is unavailable".to_owned())?;
    let timer_size = timer
        .outer_size()
        .map_err(|_| "timer size is unavailable".to_owned())?;
    let monitor = pet
        .current_monitor()
        .map_err(|_| "pet monitor is unavailable".to_owned())?
        .ok_or_else(|| "pet monitor is unavailable".to_owned())?;
    let work_area = monitor.work_area();

    let minimum_x = work_area.position.x;
    let minimum_y = work_area.position.y;
    let maximum_x = minimum_x + work_area.size.width as i32 - timer_size.width as i32;
    let maximum_y = minimum_y + work_area.size.height as i32 - timer_size.height as i32;
    let desired_x = pet_position.x + pet_size.width as i32 / 2 - timer_size.width as i32 / 2;
    let desired_y = pet_position.y - timer_size.height as i32 + 12;
    timer
        .set_position(tauri::PhysicalPosition::new(
            desired_x.clamp(minimum_x, maximum_x.max(minimum_x)),
            desired_y.clamp(minimum_y, maximum_y.max(minimum_y)),
        ))
        .map_err(|_| "timer bubble could not be positioned".to_owned())
}

#[tauri::command]
pub fn position_timer_bubble(app: AppHandle) -> Result<(), String> {
    place_timer_bubble(&app)
}

fn gamcha_notice_desired_y(pet_y: i32, notice_height: i32) -> i32 {
    pet_y - notice_height + 12
}
pub fn place_gamcha_notice_bubble(app: &AppHandle) -> Result<(), String> {
    let pet = app
        .get_webview_window("pet")
        .ok_or_else(|| "pet window is unavailable".to_owned())?;
    let gamcha = app
        .get_webview_window("gamcha-notice")
        .ok_or_else(|| "GAMCHA notice is unavailable".to_owned())?;
    let pet_position = pet
        .outer_position()
        .map_err(|_| "pet position is unavailable".to_owned())?;
    let pet_size = pet
        .outer_size()
        .map_err(|_| "pet size is unavailable".to_owned())?;
    let gamcha_size = gamcha
        .outer_size()
        .map_err(|_| "GAMCHA size is unavailable".to_owned())?;
    let monitor = pet
        .current_monitor()
        .map_err(|_| "pet monitor is unavailable".to_owned())?
        .ok_or_else(|| "pet monitor is unavailable".to_owned())?;
    let work_area = monitor.work_area();
    let minimum_x = work_area.position.x;
    let minimum_y = work_area.position.y;
    let maximum_x = minimum_x + work_area.size.width as i32 - gamcha_size.width as i32;
    let maximum_y = minimum_y + work_area.size.height as i32 - gamcha_size.height as i32;
    let desired_x = pet_position.x + pet_size.width as i32 / 2 - gamcha_size.width as i32 / 2;
    let desired_y = gamcha_notice_desired_y(pet_position.y, gamcha_size.height as i32);
    gamcha
        .set_position(tauri::PhysicalPosition::new(
            desired_x.clamp(minimum_x, maximum_x.max(minimum_x)),
            desired_y.clamp(minimum_y, maximum_y.max(minimum_y)),
        ))
        .map_err(|_| "GAMCHA bubble could not be positioned".to_owned())
}

pub fn show_gamcha_reward(app: &AppHandle) -> Result<(), String> {
    if let Some(timer) = app.get_webview_window("timer") {
        let _ = timer.hide();
    }
    place_gamcha_notice_bubble(app)?;
    app.get_webview_window("gamcha-notice")
        .ok_or_else(|| "GAMCHA notice is unavailable".to_owned())?
        .show()
        .map_err(|_| "GAMCHA notice could not be shown".to_owned())
}

#[tauri::command]
pub fn position_gamcha_bubble(app: AppHandle) -> Result<(), String> {
    place_gamcha_notice_bubble(&app)
}

#[tauri::command]
pub fn show_pet_context_menu(app: AppHandle, x: i32, y: i32) -> Result<(), String> {
    let pet = app
        .get_webview_window("pet")
        .ok_or_else(|| "pet window is unavailable".to_owned())?;
    let menu = app
        .get_webview_window("pet-menu")
        .ok_or_else(|| "pet menu is unavailable".to_owned())?;
    let menu_size = menu
        .outer_size()
        .map_err(|_| "pet menu size is unavailable".to_owned())?;
    let monitor = pet
        .current_monitor()
        .map_err(|_| "pet monitor is unavailable".to_owned())?
        .ok_or_else(|| "pet monitor is unavailable".to_owned())?;
    let work_area = monitor.work_area();
    let minimum_x = work_area.position.x;
    let minimum_y = work_area.position.y;
    let maximum_x = minimum_x + work_area.size.width as i32 - menu_size.width as i32;
    let maximum_y = minimum_y + work_area.size.height as i32 - menu_size.height as i32;
    let desired_x = if x + 10 + menu_size.width as i32 <= minimum_x + work_area.size.width as i32 {
        x + 10
    } else {
        x - menu_size.width as i32 - 10
    };
    let desired_y = if y + 10 + menu_size.height as i32 <= minimum_y + work_area.size.height as i32
    {
        y + 10
    } else {
        y - menu_size.height as i32 - 10
    };
    menu.set_position(tauri::PhysicalPosition::new(
        desired_x.clamp(minimum_x, maximum_x.max(minimum_x)),
        desired_y.clamp(minimum_y, maximum_y.max(minimum_y)),
    ))
    .map_err(|_| "pet menu could not be positioned".to_owned())?;
    menu.show()
        .map_err(|_| "pet menu could not be shown".to_owned())?;
    menu.set_focus()
        .map_err(|_| "pet menu could not be focused".to_owned())
}

fn prepare_gamcha_overlay(app: &AppHandle) -> Result<(), String> {
    let pet = app
        .get_webview_window("pet")
        .ok_or_else(|| "pet window is unavailable".to_owned())?;
    let gamcha = app
        .get_webview_window("gamcha")
        .ok_or_else(|| "GAMCHA window is unavailable".to_owned())?;
    let monitor = pet
        .current_monitor()
        .map_err(|_| "pet monitor is unavailable".to_owned())?
        .ok_or_else(|| "pet monitor is unavailable".to_owned())?;
    let work_area = monitor.work_area();
    gamcha
        .set_fullscreen(false)
        .map_err(|_| "GAMCHA overlay could not be reset".to_owned())?;
    gamcha
        .set_always_on_top(false)
        .map_err(|_| "GAMCHA overlay stacking could not be reset".to_owned())?;
    gamcha
        .set_position(work_area.position)
        .map_err(|_| "GAMCHA monitor could not be selected".to_owned())?;
    gamcha
        .set_size(work_area.size)
        .map_err(|_| "GAMCHA overlay could not fit the work area".to_owned())
}

#[tauri::command]
pub fn toggle_timer_bubble(app: AppHandle) -> Result<bool, String> {
    let timer = app
        .get_webview_window("timer")
        .ok_or_else(|| "timer window is unavailable".to_owned())?;
    if timer
        .is_visible()
        .map_err(|_| "timer visibility is unavailable".to_owned())?
    {
        timer
            .hide()
            .map_err(|_| "timer window could not be hidden".to_owned())?;
        return Ok(false);
    }

    show_utility_window(app.clone(), "timer".to_owned())?;
    timer
        .is_visible()
        .map_err(|_| "timer visibility is unavailable".to_owned())
}

#[tauri::command]
pub fn show_utility_window(app: AppHandle, label: String) -> Result<(), String> {
    if !matches!(
        label.as_str(),
        "timer" | "todo" | "settings" | "gamcha" | "gamcha-notice" | "pet-menu"
    ) {
        return Err("unsupported utility window".to_owned());
    }
    if label == "timer" {
        if app
            .get_webview_window("gamcha-notice")
            .is_some_and(|notice| notice.is_visible().unwrap_or(false))
        {
            return Ok(());
        }
        place_timer_bubble(&app)?;
    } else if label == "gamcha" {
        prepare_gamcha_overlay(&app)?;
        if let Some(notice) = app.get_webview_window("gamcha-notice") {
            let _ = notice.hide();
        }
    } else if label == "gamcha-notice" {
        if let Some(timer) = app.get_webview_window("timer") {
            let _ = timer.hide();
        }
        place_gamcha_notice_bubble(&app)?;
    }
    let window = app
        .get_webview_window(&label)
        .ok_or_else(|| "utility window is unavailable".to_owned())?;
    window
        .show()
        .map_err(|_| "utility window could not be shown".to_owned())?;
    window
        .set_focus()
        .map_err(|_| "utility window could not be focused".to_owned())
}

#[tauri::command]
pub fn hide_utility_window(app: AppHandle, label: String) -> Result<(), String> {
    if !matches!(
        label.as_str(),
        "timer" | "todo" | "settings" | "gamcha" | "gamcha-notice" | "pet-menu"
    ) {
        return Err("unsupported utility window".to_owned());
    }
    let result = app
        .get_webview_window(&label)
        .ok_or_else(|| "utility window is unavailable".to_owned())?
        .hide()
        .map_err(|_| "utility window could not be hidden".to_owned());
    if label == "gamcha" {
        if let Some(gamcha) = app.get_webview_window("gamcha") {
            let _ = gamcha.set_fullscreen(false);
        }
    }
    result
}

#[tauri::command]
pub fn quit_application(app: AppHandle) {
    app.exit(0);
}
#[cfg(test)]
mod gamcha_notice_position_tests {
    use super::{anchored_window_position, climb_rope_rect, gamcha_notice_desired_y};

    #[test]
    fn anchors_the_reward_notice_at_the_same_pet_offset_as_the_timer() {
        assert_eq!(gamcha_notice_desired_y(700, 82), 630);
    }

    #[test]
    fn centers_and_normalizes_the_climb_rope_window() {
        assert_eq!(climb_rope_rect(734, 300, 940, "right"), (574, 300, 640));
        assert_eq!(climb_rope_rect(734, 300, 940, "left"), (718, 300, 640));
        assert_eq!(climb_rope_rect(734, 400, 390, "right"), (574, 390, 24));
    }

    #[test]
    fn music_stage_resize_preserves_bottom_center_anchor() {
        assert_eq!(
            anchored_window_position(500, 700, 128, 128, 280, 220),
            (424, 608)
        );
        assert_eq!(
            anchored_window_position(424, 608, 280, 220, 128, 128),
            (500, 700)
        );
    }
}
