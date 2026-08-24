mod foreground_window;
mod system_metrics;
mod window_surfaces;

pub use foreground_window::{PlatformForegroundWindowSource, PlatformWindowMinimizer};
pub use system_metrics::{SystemMetricsMonitor, SystemMetricsSnapshot};
pub use window_surfaces::{climbable_windows, WindowSurface};
