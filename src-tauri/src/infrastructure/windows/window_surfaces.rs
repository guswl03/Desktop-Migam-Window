use serde::Serialize;

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowSurface {
    pub window_id: String,
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

#[cfg(windows)]
mod platform {
    use std::process;

    use windows_sys::Win32::{
        Foundation::{BOOL, HWND, LPARAM, RECT},
        Graphics::Dwm::{DwmGetWindowAttribute, DWMWA_EXTENDED_FRAME_BOUNDS},
        UI::WindowsAndMessaging::{
            EnumWindows, GetWindowLongPtrW, GetWindowRect, GetWindowThreadProcessId, IsIconic,
            IsWindowVisible, GWL_EXSTYLE, WS_EX_NOACTIVATE, WS_EX_TOOLWINDOW,
        },
    };

    use super::WindowSurface;

    const MINIMUM_SURFACE_WIDTH: u32 = 96;
    const MINIMUM_SURFACE_HEIGHT: u32 = 48;

    unsafe extern "system" fn collect_window(window: HWND, parameter: LPARAM) -> BOOL {
        let surfaces = &mut *(parameter as *mut Vec<WindowSurface>);
        if IsWindowVisible(window) == 0 || IsIconic(window) != 0 {
            return 1;
        }

        let extended_style = GetWindowLongPtrW(window, GWL_EXSTYLE) as u32;
        if extended_style & (WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE) != 0 {
            return 1;
        }

        let mut process_id = 0;
        GetWindowThreadProcessId(window, &mut process_id);
        if process_id == 0 || process_id == process::id() {
            return 1;
        }

        let mut rect: RECT = std::mem::zeroed();
        if GetWindowRect(window, &mut rect) == 0 {
            return 1;
        }
        let mut visible_rect: RECT = std::mem::zeroed();
        if DwmGetWindowAttribute(
            window,
            DWMWA_EXTENDED_FRAME_BOUNDS as u32,
            (&mut visible_rect as *mut RECT).cast(),
            std::mem::size_of::<RECT>() as u32,
        ) >= 0
        {
            rect = visible_rect;
        }
        let width = rect.right.saturating_sub(rect.left) as u32;
        let height = rect.bottom.saturating_sub(rect.top) as u32;
        if width < MINIMUM_SURFACE_WIDTH || height < MINIMUM_SURFACE_HEIGHT {
            return 1;
        }

        surfaces.push(WindowSurface {
            window_id: format!("{}", window as usize),
            x: rect.left,
            y: rect.top,
            width,
            height,
        });
        1
    }

    pub fn climbable_windows() -> Vec<WindowSurface> {
        let mut surfaces = Vec::new();
        unsafe {
            EnumWindows(
                Some(collect_window),
                (&mut surfaces as *mut Vec<WindowSurface>) as LPARAM,
            );
        }
        surfaces
    }
}

#[cfg(not(windows))]
mod platform {
    use super::WindowSurface;

    pub fn climbable_windows() -> Vec<WindowSurface> {
        Vec::new()
    }
}

pub use platform::climbable_windows;
