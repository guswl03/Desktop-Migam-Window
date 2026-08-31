use std::{
    collections::{BTreeMap, BTreeSet},
    sync::OnceLock,
};

use serde::Deserialize;

use super::gamcha::GamchaRarity;

#[derive(Debug, Deserialize)]
struct Manifest {
    costumes: Vec<ManifestCostume>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ManifestCostume {
    id: String,
    rarity: String,
}

struct CostumeCatalog {
    ids_by_rarity: BTreeMap<GamchaRarity, Vec<String>>,
    drawable_count: usize,
}

impl CostumeCatalog {
    fn from_embedded_manifest() -> Self {
        let manifest: Manifest = serde_json::from_str(include_str!("../../../pack/manifest.json"))
            .expect("embedded costume manifest must be valid JSON");
        let mut ids_by_rarity = BTreeMap::<GamchaRarity, Vec<String>>::new();
        let mut seen = BTreeSet::new();

        for costume in manifest.costumes {
            let Some(rarity) = parse_rarity(&costume.rarity) else {
                continue;
            };
            assert!(
                seen.insert(costume.id.clone()),
                "embedded costume manifest contains duplicate id {}",
                costume.id
            );
            ids_by_rarity.entry(rarity).or_default().push(costume.id);
        }

        for ids in ids_by_rarity.values_mut() {
            ids.sort_by_key(|id| numeric_suffix(id));
        }
        let drawable_count = ids_by_rarity.values().map(Vec::len).sum();
        Self {
            ids_by_rarity,
            drawable_count,
        }
    }
}

fn parse_rarity(value: &str) -> Option<GamchaRarity> {
    match value {
        "common" => Some(GamchaRarity::Common),
        "rare" => Some(GamchaRarity::Rare),
        "epic" => Some(GamchaRarity::Epic),
        "legendary" => Some(GamchaRarity::Legendary),
        "special" => Some(GamchaRarity::Special),
        _ => None,
    }
}

fn numeric_suffix(id: &str) -> u32 {
    id.rsplit_once('_')
        .and_then(|(_, suffix)| suffix.parse().ok())
        .unwrap_or(u32::MAX)
}

static CATALOG: OnceLock<CostumeCatalog> = OnceLock::new();

fn catalog() -> &'static CostumeCatalog {
    CATALOG.get_or_init(CostumeCatalog::from_embedded_manifest)
}

pub fn costume_ids_for(rarity: GamchaRarity) -> &'static [String] {
    catalog()
        .ids_by_rarity
        .get(&rarity)
        .map(Vec::as_slice)
        .unwrap_or(&[])
}

pub fn drawable_manifest_count() -> usize {
    catalog().drawable_count
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn each_current_rarity_pool_is_sorted_and_nonempty() {
        for rarity in [
            GamchaRarity::Common,
            GamchaRarity::Rare,
            GamchaRarity::Epic,
            GamchaRarity::Legendary,
            GamchaRarity::Special,
        ] {
            let ids = costume_ids_for(rarity);
            assert!(!ids.is_empty());
            assert!(ids
                .windows(2)
                .all(|pair| numeric_suffix(&pair[0]) < numeric_suffix(&pair[1])));
        }
    }

    #[test]
    fn rarity_pools_cover_all_314_blueprint_ids() {
        let expected = [
            (GamchaRarity::Common, 149),
            (GamchaRarity::Rare, 92),
            (GamchaRarity::Epic, 52),
            (GamchaRarity::Legendary, 13),
            (GamchaRarity::Special, 8),
        ];

        for (rarity, count) in expected {
            assert_eq!(costume_ids_for(rarity).len(), count);
        }
        assert_eq!(drawable_manifest_count(), 314);
    }
}
