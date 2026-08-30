use std::{
    collections::{BTreeMap, BTreeSet},
    fs, io,
    path::{Path, PathBuf},
    sync::Mutex,
    time::{SystemTime, UNIX_EPOCH},
};

use serde::{Deserialize, Serialize};

use crate::domain::costume_catalog::costume_ids_for;
use crate::domain::gamcha::{rarity_for_roll, GamchaRarity};

const SCHEMA_VERSION: u8 = 1;

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
struct GamchaProgress {
    schema_version: u8,
    tickets: u32,
    total_draws: u32,
    #[serde(default)]
    owned_costume_ids: BTreeSet<String>,
    #[serde(default)]
    equipped_costume_id: Option<String>,
    #[serde(default)]
    costume_alignments: BTreeMap<String, CostumeAlignment>,
}

impl Default for GamchaProgress {
    fn default() -> Self {
        Self {
            schema_version: SCHEMA_VERSION,
            tickets: 0,
            total_draws: 0,
            owned_costume_ids: BTreeSet::new(),
            equipped_costume_id: None,
            costume_alignments: BTreeMap::new(),
        }
    }
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct CostumeAlignment {
    pub x: i16,
    pub y: i16,
    pub size: u16,
}

impl CostumeAlignment {
    fn validate(self) -> Result<Self, String> {
        if !(-80..=80).contains(&self.x)
            || !(-80..=80).contains(&self.y)
            || !(48..=180).contains(&self.size)
        {
            return Err("costume alignment is outside the supported range".to_owned());
        }
        Ok(self)
    }
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GamchaSnapshot {
    pub tickets: u32,
    pub total_draws: u32,
    pub owned_count: usize,
    pub owned_costume_ids: Vec<String>,
    pub equipped_costume_id: Option<String>,
    pub costume_alignments: BTreeMap<String, CostumeAlignment>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GamchaDrawResult {
    pub tickets: u32,
    pub total_draws: u32,
    pub owned_count: usize,
    pub costume_id: String,
    pub rarity: GamchaRarity,
    pub is_new: bool,
}

pub struct GamchaService {
    progress_path: PathBuf,
    progress: Mutex<GamchaProgress>,
}

impl GamchaService {
    pub fn new(app_data_dir: PathBuf) -> Self {
        let progress_path = app_data_dir.join("gamcha.json");
        let progress = Self::load(&progress_path).unwrap_or_else(|_| {
            Self::preserve_corrupt_file(&progress_path);
            GamchaProgress::default()
        });
        Self {
            progress_path,
            progress: Mutex::new(progress),
        }
    }

    pub fn snapshot(&self) -> Result<GamchaSnapshot, String> {
        let progress = self
            .progress
            .lock()
            .map_err(|_| "GAMCHA progress is unavailable".to_owned())?;
        Ok(Self::to_snapshot(&progress))
    }

    pub fn award_ticket(&self) -> Result<GamchaSnapshot, String> {
        let mut progress = self
            .progress
            .lock()
            .map_err(|_| "GAMCHA progress is unavailable".to_owned())?;
        let mut next = progress.clone();
        next.tickets = next.tickets.saturating_add(1);
        self.save(&next)?;
        *progress = next;
        Ok(Self::to_snapshot(&progress))
    }

    pub fn draw(&self) -> Result<GamchaDrawResult, String> {
        let mut progress = self
            .progress
            .lock()
            .map_err(|_| "GAMCHA progress is unavailable".to_owned())?;
        if progress.tickets == 0 {
            return Err("GAMCHA ticket is required".to_owned());
        }

        let mut next = progress.clone();
        let rarity = rarity_for_roll(Self::random_u16()? % 10_000);
        let rarity_pool = costume_ids_for(rarity);
        let unowned = rarity_pool
            .iter()
            .filter(|id| !next.owned_costume_ids.contains(id.as_str()))
            .cloned()
            .collect::<Vec<_>>();
        let pool = if unowned.is_empty() {
            rarity_pool.to_vec()
        } else {
            unowned
        };
        let costume_id = pool[usize::from(Self::random_u16()?) % pool.len()].clone();
        let is_new = next.owned_costume_ids.insert(costume_id.clone());
        next.tickets -= 1;
        next.total_draws = next.total_draws.saturating_add(1);
        self.save(&next)?;
        *progress = next;

        Ok(GamchaDrawResult {
            tickets: progress.tickets,
            total_draws: progress.total_draws,
            owned_count: progress.owned_costume_ids.len(),
            costume_id,
            rarity,
            is_new,
        })
    }

    pub fn equip(&self, costume_id: Option<String>) -> Result<GamchaSnapshot, String> {
        let mut progress = self
            .progress
            .lock()
            .map_err(|_| "GAMCHA progress is unavailable".to_owned())?;
        if costume_id
            .as_ref()
            .is_some_and(|id| !progress.owned_costume_ids.contains(id))
        {
            return Err("only an owned costume can be equipped".to_owned());
        }
        let mut next = progress.clone();
        next.equipped_costume_id = costume_id;
        self.save(&next)?;
        *progress = next;
        Ok(Self::to_snapshot(&progress))
    }

    pub fn set_alignment(
        &self,
        costume_id: String,
        alignment: Option<CostumeAlignment>,
    ) -> Result<GamchaSnapshot, String> {
        let mut progress = self
            .progress
            .lock()
            .map_err(|_| "GAMCHA progress is unavailable".to_owned())?;
        if !progress.owned_costume_ids.contains(&costume_id) {
            return Err("only an owned costume can be aligned".to_owned());
        }
        let mut next = progress.clone();
        match alignment {
            Some(alignment) => {
                next.costume_alignments
                    .insert(costume_id, alignment.validate()?);
            }
            None => {
                next.costume_alignments.remove(&costume_id);
            }
        }
        self.save(&next)?;
        *progress = next;
        Ok(Self::to_snapshot(&progress))
    }

    fn random_u16() -> Result<u16, String> {
        let mut bytes = [0u8; 2];
        getrandom::fill(&mut bytes).map_err(|_| "secure random draw failed".to_owned())?;
        Ok(u16::from_le_bytes(bytes))
    }

    fn to_snapshot(progress: &GamchaProgress) -> GamchaSnapshot {
        GamchaSnapshot {
            tickets: progress.tickets,
            total_draws: progress.total_draws,
            owned_count: progress.owned_costume_ids.len(),
            owned_costume_ids: progress.owned_costume_ids.iter().cloned().collect(),
            equipped_costume_id: progress.equipped_costume_id.clone(),
            costume_alignments: progress.costume_alignments.clone(),
        }
    }

    fn load(path: &Path) -> Result<GamchaProgress, String> {
        if !path.exists() {
            return Ok(GamchaProgress::default());
        }
        let json = fs::read_to_string(path).map_err(Self::safe_io_error)?;
        let progress: GamchaProgress =
            serde_json::from_str(&json).map_err(|_| "GAMCHA progress is invalid".to_owned())?;
        if progress.schema_version != SCHEMA_VERSION {
            return Err("GAMCHA progress schema is unsupported".to_owned());
        }
        Ok(progress)
    }

    fn save(&self, progress: &GamchaProgress) -> Result<(), String> {
        let parent = self
            .progress_path
            .parent()
            .ok_or_else(|| "GAMCHA progress path has no parent".to_owned())?;
        fs::create_dir_all(parent).map_err(Self::safe_io_error)?;
        let bytes = serde_json::to_vec_pretty(progress)
            .map_err(|_| "GAMCHA progress could not be serialized".to_owned())?;
        let temporary = self.progress_path.with_extension("json.tmp");
        let previous = self.progress_path.with_extension("json.previous");
        fs::write(&temporary, bytes).map_err(Self::safe_io_error)?;
        if self.progress_path.exists() {
            let _ = fs::remove_file(&previous);
            fs::rename(&self.progress_path, &previous).map_err(Self::safe_io_error)?;
        }
        if let Err(error) = fs::rename(&temporary, &self.progress_path) {
            if previous.exists() {
                let _ = fs::rename(&previous, &self.progress_path);
            }
            return Err(Self::safe_io_error(error));
        }
        let _ = fs::remove_file(previous);
        Ok(())
    }

    fn preserve_corrupt_file(path: &Path) {
        if !path.exists() {
            return;
        }
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|duration| duration.as_secs())
            .unwrap_or_default();
        let corrupt = path.with_file_name(format!("gamcha.corrupt-{timestamp}.json"));
        let _ = fs::rename(path, corrupt);
    }

    fn safe_io_error(_error: io::Error) -> String {
        "GAMCHA storage operation failed".to_owned()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temporary_directory(name: &str) -> PathBuf {
        std::env::temp_dir().join(format!("desktop-pet-gamcha-{name}-{}", std::process::id()))
    }

    #[test]
    fn ticket_and_collection_survive_restart() {
        let directory = temporary_directory("persistence");
        let _ = fs::remove_dir_all(&directory);
        let service = GamchaService::new(directory.clone());
        assert_eq!(service.award_ticket().unwrap().tickets, 1);
        let result = service.draw().unwrap();
        assert_eq!(result.tickets, 0);
        assert!(result.is_new);
        service.equip(Some(result.costume_id.clone())).unwrap();
        service
            .set_alignment(
                result.costume_id.clone(),
                Some(CostumeAlignment {
                    x: -7,
                    y: 12,
                    size: 96,
                }),
            )
            .unwrap();

        let restarted = GamchaService::new(directory.clone());
        let snapshot = restarted.snapshot().unwrap();
        assert_eq!(snapshot.total_draws, 1);
        assert_eq!(snapshot.owned_count, 1);
        assert_eq!(snapshot.equipped_costume_id, Some(result.costume_id));
        assert_eq!(snapshot.costume_alignments.len(), 1);
        let _ = fs::remove_dir_all(directory);
    }

    #[test]
    fn drawing_without_a_ticket_is_rejected() {
        let directory = temporary_directory("no-ticket");
        let _ = fs::remove_dir_all(&directory);
        let service = GamchaService::new(directory.clone());

        assert_eq!(service.draw().unwrap_err(), "GAMCHA ticket is required");
        let _ = fs::remove_dir_all(directory);
    }

    #[test]
    fn unowned_costumes_cannot_be_equipped() {
        let directory = temporary_directory("unowned-equip");
        let _ = fs::remove_dir_all(&directory);
        let service = GamchaService::new(directory.clone());

        assert_eq!(
            service.equip(Some("legendary_001".to_owned())).unwrap_err(),
            "only an owned costume can be equipped"
        );
        assert_eq!(service.equip(None).unwrap().equipped_costume_id, None);
        let _ = fs::remove_dir_all(directory);
    }

    #[test]
    fn alignment_requires_an_owned_costume_and_safe_ranges() {
        let directory = temporary_directory("alignment-validation");
        let _ = fs::remove_dir_all(&directory);
        let service = GamchaService::new(directory.clone());
        let alignment = CostumeAlignment {
            x: 0,
            y: 0,
            size: 96,
        };
        assert_eq!(
            service
                .set_alignment("common_001".to_owned(), Some(alignment))
                .unwrap_err(),
            "only an owned costume can be aligned"
        );
        service.award_ticket().unwrap();
        let result = service.draw().unwrap();
        assert_eq!(
            service
                .set_alignment(
                    result.costume_id,
                    Some(CostumeAlignment {
                        x: 81,
                        y: 0,
                        size: 96
                    }),
                )
                .unwrap_err(),
            "costume alignment is outside the supported range"
        );
        let _ = fs::remove_dir_all(directory);
    }
}
