mod battery;
mod foreground_window;
mod system_metrics;
mod window_surfaces;

pub use battery::{battery_snapshot, BatterySnapshot};
pub use foreground_window::{
    youtube_music_in_chrome, PlatformForegroundWindowSource, PlatformWindowMinimizer,
};
pub use system_metrics::{SystemMetricsMonitor, SystemMetricsSnapshot};
pub use window_surfaces::{climbable_windows, WindowSurface};
