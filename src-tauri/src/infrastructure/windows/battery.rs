use serde::Serialize;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BatterySnapshot {
    pub present: bool,
    pub percent: Option<u8>,
    pub charging: bool,
}

#[cfg(windows)]
mod platform {
    use windows_sys::Win32::System::Power::{GetSystemPowerStatus, SYSTEM_POWER_STATUS};

    use super::BatterySnapshot;

    const BATTERY_FLAG_CHARGING: u8 = 8;
    const BATTERY_FLAG_NO_BATTERY: u8 = 128;
    const UNKNOWN_PERCENT: u8 = 255;

    fn snapshot_from_raw(ac_line_status: u8, battery_flag: u8, percent: u8) -> BatterySnapshot {
        let present = battery_flag & BATTERY_FLAG_NO_BATTERY == 0;
        BatterySnapshot {
            present,
            percent: (present && percent != UNKNOWN_PERCENT).then_some(percent.min(100)),
            charging: present && (ac_line_status == 1 || battery_flag & BATTERY_FLAG_CHARGING != 0),
        }
    }

    pub fn battery_snapshot() -> Result<BatterySnapshot, String> {
        let mut status: SYSTEM_POWER_STATUS = unsafe { std::mem::zeroed() };
        if unsafe { GetSystemPowerStatus(&mut status) } == 0 {
            return Err("battery status is unavailable".to_owned());
        }
        Ok(snapshot_from_raw(
            status.ACLineStatus,
            status.BatteryFlag,
            status.BatteryLifePercent,
        ))
    }

    #[cfg(test)]
    mod tests {
        use super::snapshot_from_raw;

        #[test]
        fn normalizes_battery_and_desktop_states() {
            let low = snapshot_from_raw(0, 2, 19);
            assert!(low.present);
            assert_eq!(low.percent, Some(19));
            assert!(!low.charging);

            let charging = snapshot_from_raw(1, 8, 44);
            assert!(charging.charging);

            let desktop = snapshot_from_raw(1, 128, 255);
            assert!(!desktop.present);
            assert_eq!(desktop.percent, None);
        }
    }
}

#[cfg(not(windows))]
mod platform {
    use super::BatterySnapshot;

    pub fn battery_snapshot() -> Result<BatterySnapshot, String> {
        Ok(BatterySnapshot {
            present: false,
            percent: None,
            charging: false,
        })
    }
}

pub use platform::battery_snapshot;
