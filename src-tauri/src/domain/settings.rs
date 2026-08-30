use serde::{Deserialize, Serialize};
use thiserror::Error;

use crate::domain::distraction::DistractionRule;

pub const CURRENT_SCHEMA_VERSION: u32 = 2;

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    pub schema_version: u32,
    pub pet: PetSettings,
    pub pomodoro: PomodoroSettings,
    pub focus_guard: FocusGuardSettings,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PetSettings {
    pub visual_scale_percent: u8,
    #[serde(default)]
    pub resource_response_mode: ResourceResponseMode,
    #[serde(default = "default_true")]
    pub automatic_photo_delivery_enabled: bool,
    #[serde(default = "default_true")]
    pub window_climbing_enabled: bool,
}

const fn default_true() -> bool {
    true
}

#[derive(Clone, Copy, Debug, Default, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum ResourceResponseMode {
    #[default]
    Off,
    Cpu,
    Memory,
    Combined,
}
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PomodoroSettings {
    pub focus_minutes: u16,
    pub short_break_minutes: u16,
    pub long_break_minutes: u16,
    pub sessions_before_long_break: u8,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FocusGuardSettings {
    pub intervention_enabled: bool,
    #[serde(default)]
    pub rules: Vec<DistractionRule>,
}

#[derive(Debug, Error, Eq, PartialEq)]
pub enum ValidationError {
    #[error("focus duration must be between 1 and 120 minutes, got {0}")]
    FocusMinutesOutOfRange(u16),
    #[error("short break duration must be between 1 and 60 minutes, got {0}")]
    ShortBreakMinutesOutOfRange(u16),
    #[error("long break duration must be between 1 and 90 minutes, got {0}")]
    LongBreakMinutesOutOfRange(u16),
    #[error("sessions before a long break must be positive")]
    SessionsBeforeLongBreakMustBePositive,
    #[error("distraction rule {0} is invalid: {1}")]
    InvalidDistractionRule(usize, String),
}

#[derive(Debug, Error)]
pub enum SettingsLoadError {
    #[error("settings JSON is invalid: {0}")]
    Json(#[from] serde_json::Error),
    #[error("unsupported settings schema version {0}")]
    UnsupportedSchemaVersion(u32),
    #[error(transparent)]
    Validation(#[from] ValidationError),
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SchemaVersion {
    schema_version: u32,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SettingsV1 {
    pet: PetSettings,
    pomodoro: PomodoroSettingsV1,
    focus_guard: FocusGuardSettings,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct PomodoroSettingsV1 {
    focus_minutes: u16,
    short_break_minutes: u16,
    long_break_minutes: u16,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            schema_version: CURRENT_SCHEMA_VERSION,
            pet: PetSettings {
                visual_scale_percent: 100,
                resource_response_mode: ResourceResponseMode::Off,
                automatic_photo_delivery_enabled: true,
                window_climbing_enabled: true,
            },
            pomodoro: PomodoroSettings {
                focus_minutes: 25,
                short_break_minutes: 5,
                long_break_minutes: 15,
                sessions_before_long_break: 4,
            },
            focus_guard: FocusGuardSettings {
                intervention_enabled: false,
                rules: Vec::new(),
            },
        }
    }
}

impl Settings {
    pub fn validate(mut self) -> Result<Self, ValidationError> {
        if !(1..=120).contains(&self.pomodoro.focus_minutes) {
            return Err(ValidationError::FocusMinutesOutOfRange(
                self.pomodoro.focus_minutes,
            ));
        }
        if !(1..=60).contains(&self.pomodoro.short_break_minutes) {
            return Err(ValidationError::ShortBreakMinutesOutOfRange(
                self.pomodoro.short_break_minutes,
            ));
        }
        if !(1..=90).contains(&self.pomodoro.long_break_minutes) {
            return Err(ValidationError::LongBreakMinutesOutOfRange(
                self.pomodoro.long_break_minutes,
            ));
        }
        if self.pomodoro.sessions_before_long_break == 0 {
            return Err(ValidationError::SessionsBeforeLongBreakMustBePositive);
        }
        for (index, rule) in self.focus_guard.rules.iter().enumerate() {
            rule.validate().map_err(|error| {
                ValidationError::InvalidDistractionRule(index + 1, error.to_string())
            })?;
        }
        self.pet.visual_scale_percent = self.pet.visual_scale_percent.clamp(50, 200);
        if !self.focus_guard.rules.iter().any(|rule| rule.enabled) {
            self.focus_guard.intervention_enabled = false;
        }
        Ok(self)
    }

    pub fn from_json(input: &str) -> Result<Self, SettingsLoadError> {
        let version = serde_json::from_str::<SchemaVersion>(input)?.schema_version;
        let settings = match version {
            CURRENT_SCHEMA_VERSION => serde_json::from_str(input)?,
            1 => {
                let legacy = serde_json::from_str::<SettingsV1>(input)?;
                Self {
                    schema_version: CURRENT_SCHEMA_VERSION,
                    pet: legacy.pet,
                    pomodoro: PomodoroSettings {
                        focus_minutes: legacy.pomodoro.focus_minutes,
                        short_break_minutes: legacy.pomodoro.short_break_minutes,
                        long_break_minutes: legacy.pomodoro.long_break_minutes,
                        sessions_before_long_break: 4,
                    },
                    focus_guard: legacy.focus_guard,
                }
            }
            unsupported => return Err(SettingsLoadError::UnsupportedSchemaVersion(unsupported)),
        };
        settings.validate().map_err(Into::into)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn defaults_disable_intervention_and_use_pomodoro_cadence() {
        let settings = Settings::default();

        assert!(!settings.focus_guard.intervention_enabled);
        assert!(settings.focus_guard.rules.is_empty());
        assert_eq!(settings.pomodoro.focus_minutes, 25);
        assert_eq!(settings.pomodoro.short_break_minutes, 5);
        assert_eq!(settings.pomodoro.long_break_minutes, 15);
        assert_eq!(settings.pomodoro.sessions_before_long_break, 4);
        assert_eq!(
            settings.pet.resource_response_mode,
            ResourceResponseMode::Off
        );
        assert!(settings.pet.automatic_photo_delivery_enabled);
    }

    #[test]
    fn defaults_enable_window_climbing_and_serialize_the_preference() {
        let value = serde_json::to_value(Settings::default()).unwrap();

        assert_eq!(
            value["pet"]["windowClimbingEnabled"],
            serde_json::Value::Bool(true)
        );
    }

    #[test]
    fn validation_rejects_focus_minutes_outside_one_to_one_hundred_twenty() {
        let mut zero_minutes = Settings::default();
        zero_minutes.pomodoro.focus_minutes = 0;
        assert_eq!(
            zero_minutes.validate(),
            Err(ValidationError::FocusMinutesOutOfRange(0))
        );

        let mut too_many_minutes = Settings::default();
        too_many_minutes.pomodoro.focus_minutes = 121;
        assert_eq!(
            too_many_minutes.validate(),
            Err(ValidationError::FocusMinutesOutOfRange(121))
        );
    }

    #[test]
    fn validation_clamps_visual_scale_to_supported_range() {
        let mut settings = Settings::default();
        settings.pet.visual_scale_percent = 12;

        assert_eq!(settings.validate().unwrap().pet.visual_scale_percent, 50);

        let mut settings = Settings::default();
        settings.pet.visual_scale_percent = 255;

        assert_eq!(settings.validate().unwrap().pet.visual_scale_percent, 200);
    }

    #[test]
    fn migrates_schema_version_one_to_current_settings() {
        let migrated = Settings::from_json(
            r#"{
                "schemaVersion": 1,
                "pet": { "visualScalePercent": 125 },
                "pomodoro": {
                    "focusMinutes": 30,
                    "shortBreakMinutes": 7,
                    "longBreakMinutes": 20
                },
                "focusGuard": { "interventionEnabled": true, "rules": [] }
            }"#,
        )
        .unwrap();

        assert_eq!(migrated.schema_version, CURRENT_SCHEMA_VERSION);
        assert_eq!(migrated.pomodoro.sessions_before_long_break, 4);
        assert!(!migrated.focus_guard.intervention_enabled);
    }

    #[test]
    fn current_settings_without_resource_mode_default_to_off() {
        let settings = Settings::from_json(
            r#"{
                "schemaVersion": 2,
                "pet": { "visualScalePercent": 100 },
                "pomodoro": {
                    "focusMinutes": 25,
                    "shortBreakMinutes": 5,
                    "longBreakMinutes": 15,
                    "sessionsBeforeLongBreak": 4
                },
                "focusGuard": { "interventionEnabled": false, "rules": [] }
            }"#,
        )
        .unwrap();

        assert_eq!(
            settings.pet.resource_response_mode,
            ResourceResponseMode::Off
        );
        assert!(settings.pet.automatic_photo_delivery_enabled);
        let serialized = serde_json::to_value(settings).unwrap();
        assert_eq!(
            serialized["pet"]["windowClimbingEnabled"],
            serde_json::Value::Bool(true)
        );
    }

    #[test]
    fn current_settings_preserve_a_disabled_window_climbing_preference() {
        let settings = Settings::from_json(
            r#"{
                "schemaVersion": 2,
                "pet": {
                    "visualScalePercent": 100,
                    "windowClimbingEnabled": false
                },
                "pomodoro": {
                    "focusMinutes": 25,
                    "shortBreakMinutes": 5,
                    "longBreakMinutes": 15,
                    "sessionsBeforeLongBreak": 4
                },
                "focusGuard": { "interventionEnabled": false, "rules": [] }
            }"#,
        )
        .unwrap();

        let serialized = serde_json::to_value(settings).unwrap();
        assert_eq!(
            serialized["pet"]["windowClimbingEnabled"],
            serde_json::Value::Bool(false)
        );
    }
}
