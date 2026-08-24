#[cfg(windows)]
mod platform {
    use std::{ffi::OsString, os::windows::ffi::OsStringExt, path::Path};

    use windows_sys::Win32::{
        Foundation::{
            CloseHandle, GetLastError, ERROR_ACCESS_DENIED, HWND, INVALID_HANDLE_VALUE, RECT,
        },
        Graphics::Gdi::{
            GetMonitorInfoW, MonitorFromWindow, MONITORINFO, MONITOR_DEFAULTTONEAREST,
        },
        System::{
            Diagnostics::ToolHelp::{
                CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W,
                TH32CS_SNAPPROCESS,
            },
            Threading::{
                OpenProcess, QueryFullProcessImageNameW, PROCESS_QUERY_LIMITED_INFORMATION,
            },
        },
        UI::WindowsAndMessaging::{
            EnumWindows, GetForegroundWindow, GetWindowRect, GetWindowTextLengthW, GetWindowTextW,
            GetWindowThreadProcessId, IsIconic, IsWindow, IsWindowVisible, ShowWindow, SW_MINIMIZE,
        },
    };

    use crate::domain::foreground::{
        ForegroundReadError, ForegroundWindowSource, WindowMinimizer, WindowSnapshot,
    };

    #[derive(Default)]
    pub struct PlatformForegroundWindowSource;

    #[derive(Default)]
    pub struct PlatformWindowMinimizer;

    fn matches_youtube_music_window(process_name: Option<&str>, title: Option<&str>) -> bool {
        process_name.is_some_and(|name| name.eq_ignore_ascii_case("chrome.exe"))
            && title.is_some_and(|value| value.to_ascii_lowercase().contains("youtube music"))
    }

    unsafe extern "system" fn find_youtube_music_window(window: HWND, parameter: isize) -> i32 {
        if IsWindowVisible(window) == 0 {
            return 1;
        }
        let Some(title) = PlatformForegroundWindowSource::window_title(window) else {
            return 1;
        };
        if !title.to_ascii_lowercase().contains("youtube music") {
            return 1;
        }
        let mut process_id = 0;
        GetWindowThreadProcessId(window, &mut process_id);
        let process_name = PlatformForegroundWindowSource::process_name(process_id)
            .ok()
            .flatten();
        if matches_youtube_music_window(process_name.as_deref(), Some(&title)) {
            *(parameter as *mut bool) = true;
            return 0;
        }
        1
    }

    pub fn youtube_music_in_chrome() -> bool {
        let mut found = false;
        unsafe {
            EnumWindows(
                Some(find_youtube_music_window),
                (&mut found as *mut bool) as isize,
            );
        }
        found
    }

    impl PlatformForegroundWindowSource {
        pub const fn new() -> Self {
            Self
        }

        fn window_title(window: HWND) -> Option<String> {
            let length = unsafe { GetWindowTextLengthW(window) };
            if length <= 0 {
                return None;
            }
            let mut buffer = vec![0u16; length as usize + 1];
            let copied =
                unsafe { GetWindowTextW(window, buffer.as_mut_ptr(), buffer.len() as i32) };
            (copied > 0).then(|| String::from_utf16_lossy(&buffer[..copied as usize]))
        }

        fn process_name(process_id: u32) -> Result<Option<String>, ForegroundReadError> {
            let process = unsafe { OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, process_id) };
            if process.is_null() {
                let error = unsafe { GetLastError() };
                return Self::process_name_from_snapshot(process_id)
                    .map(Some)
                    .ok_or(if error == ERROR_ACCESS_DENIED {
                        ForegroundReadError::AccessDenied
                    } else {
                        ForegroundReadError::InspectionFailed
                    });
            }
            let mut buffer = vec![0u16; 32_768];
            let mut length = buffer.len() as u32;
            let succeeded =
                unsafe { QueryFullProcessImageNameW(process, 0, buffer.as_mut_ptr(), &mut length) };
            unsafe { CloseHandle(process) };
            if succeeded == 0 {
                return Self::process_name_from_snapshot(process_id)
                    .map(Some)
                    .ok_or(ForegroundReadError::InspectionFailed);
            }
            let path = OsString::from_wide(&buffer[..length as usize]);
            Ok(Path::new(&path)
                .file_name()
                .map(|name| name.to_string_lossy().into_owned()))
        }

        fn process_name_from_snapshot(process_id: u32) -> Option<String> {
            let snapshot = unsafe { CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0) };
            if snapshot == INVALID_HANDLE_VALUE {
                return None;
            }
            let mut entry: PROCESSENTRY32W = unsafe { std::mem::zeroed() };
            entry.dwSize = std::mem::size_of::<PROCESSENTRY32W>() as u32;
            let mut found = None;
            let mut available = unsafe { Process32FirstW(snapshot, &mut entry) } != 0;
            while available {
                if entry.th32ProcessID == process_id {
                    let length = entry
                        .szExeFile
                        .iter()
                        .position(|value| *value == 0)
                        .unwrap_or(entry.szExeFile.len());
                    found = Some(
                        OsString::from_wide(&entry.szExeFile[..length])
                            .to_string_lossy()
                            .into_owned(),
                    );
                    break;
                }
                available = unsafe { Process32NextW(snapshot, &mut entry) } != 0;
            }
            unsafe { CloseHandle(snapshot) };
            found
        }
    }

    impl ForegroundWindowSource for PlatformForegroundWindowSource {
        fn foreground_window(&self) -> Result<Option<WindowSnapshot>, ForegroundReadError> {
            let window = unsafe { GetForegroundWindow() };
            if window.is_null() {
                return Ok(None);
            }
            let mut process_id = 0;
            unsafe { GetWindowThreadProcessId(window, &mut process_id) };
            if process_id == 0 {
                return Err(ForegroundReadError::InspectionFailed);
            }
            let mut rect: RECT = unsafe { std::mem::zeroed() };
            if unsafe { GetWindowRect(window, &mut rect) } == 0 {
                return Err(ForegroundReadError::InspectionFailed);
            }
            let monitor = unsafe { MonitorFromWindow(window, MONITOR_DEFAULTTONEAREST) };
            let mut monitor_info: MONITORINFO = unsafe { std::mem::zeroed() };
            monitor_info.cbSize = std::mem::size_of::<MONITORINFO>() as u32;
            if monitor.is_null() || unsafe { GetMonitorInfoW(monitor, &mut monitor_info) } == 0 {
                return Err(ForegroundReadError::InspectionFailed);
            }
            let monitor_rect = monitor_info.rcMonitor;
            let is_fullscreen = rect.left <= monitor_rect.left + 8
                && rect.top <= monitor_rect.top + 8
                && rect.right >= monitor_rect.right - 8
                && rect.bottom >= monitor_rect.bottom - 8;
            Ok(Some(WindowSnapshot {
                window_id: window as isize,
                process_id,
                process_name: Self::process_name(process_id)?,
                title: Self::window_title(window),
                is_visible: unsafe { IsWindowVisible(window) != 0 },
                is_minimized: unsafe { IsIconic(window) != 0 },
                is_fullscreen,
                monitor_left: monitor_rect.left,
                x: rect.left,
                y: rect.top,
                width: rect.right.saturating_sub(rect.left) as u32,
                height: rect.bottom.saturating_sub(rect.top) as u32,
            }))
        }
    }

    impl WindowMinimizer for PlatformWindowMinimizer {
        fn minimize(&self, window_id: isize) -> Result<(), ForegroundReadError> {
            let window = window_id as HWND;
            if window.is_null() || unsafe { IsWindow(window) } == 0 {
                return Err(ForegroundReadError::InspectionFailed);
            }
            unsafe { ShowWindow(window, SW_MINIMIZE) };
            Ok(())
        }
    }

    #[cfg(test)]
    mod tests {
        use super::{matches_youtube_music_window, PlatformForegroundWindowSource};

        #[test]
        fn toolhelp_fallback_resolves_the_current_process_name() {
            let name =
                PlatformForegroundWindowSource::process_name_from_snapshot(std::process::id())
                    .expect("current process should appear in the Windows process snapshot");

            assert!(name.to_ascii_lowercase().ends_with(".exe"));
        }

        #[test]
        fn recognizes_youtube_music_only_in_chrome() {
            assert!(matches_youtube_music_window(
                Some("Chrome.EXE"),
                Some("Song title - YouTube Music")
            ));
            assert!(!matches_youtube_music_window(
                Some("msedge.exe"),
                Some("YouTube Music")
            ));
            assert!(!matches_youtube_music_window(
                Some("chrome.exe"),
                Some("YouTube")
            ));
        }
    }
}

#[cfg(not(windows))]
mod platform {
    use crate::domain::foreground::{
        ForegroundReadError, ForegroundWindowSource, WindowMinimizer, WindowSnapshot,
    };

    #[derive(Default)]
    pub struct PlatformForegroundWindowSource;

    #[derive(Default)]
    pub struct PlatformWindowMinimizer;

    impl PlatformForegroundWindowSource {
        pub const fn new() -> Self {
            Self
        }
    }

    impl ForegroundWindowSource for PlatformForegroundWindowSource {
        fn foreground_window(&self) -> Result<Option<WindowSnapshot>, ForegroundReadError> {
            Ok(None)
        }
    }

    impl WindowMinimizer for PlatformWindowMinimizer {
        fn minimize(&self, _window_id: isize) -> Result<(), ForegroundReadError> {
            Err(ForegroundReadError::InspectionFailed)
        }
    }

    pub fn youtube_music_in_chrome() -> bool {
        false
    }
}

pub use platform::{
    youtube_music_in_chrome, PlatformForegroundWindowSource, PlatformWindowMinimizer,
};
