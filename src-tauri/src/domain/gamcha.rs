use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, Deserialize, Eq, Ord, PartialEq, PartialOrd, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum GamchaRarity {
    Common,
    Rare,
    Epic,
    Legendary,
    Special,
}

pub const fn rarity_for_roll(roll: u16) -> GamchaRarity {
    match roll % 10_000 {
        0..=5_999 => GamchaRarity::Common,
        6_000..=8_499 => GamchaRarity::Rare,
        8_500..=9_499 => GamchaRarity::Epic,
        9_500..=9_899 => GamchaRarity::Legendary,
        _ => GamchaRarity::Special,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::costume_catalog::{costume_ids_for, drawable_manifest_count};

    #[test]
    fn rarity_boundaries_match_the_published_rates() {
        assert_eq!(rarity_for_roll(0), GamchaRarity::Common);
        assert_eq!(rarity_for_roll(5_999), GamchaRarity::Common);
        assert_eq!(rarity_for_roll(6_000), GamchaRarity::Rare);
        assert_eq!(rarity_for_roll(8_500), GamchaRarity::Epic);
        assert_eq!(rarity_for_roll(9_500), GamchaRarity::Legendary);
        assert_eq!(rarity_for_roll(9_900), GamchaRarity::Special);
        assert_eq!(rarity_for_roll(9_999), GamchaRarity::Special);
    }

    #[test]
    fn draw_pools_match_every_manifest_entry_without_fixed_counts() {
        let total = [
            GamchaRarity::Common,
            GamchaRarity::Rare,
            GamchaRarity::Epic,
            GamchaRarity::Legendary,
            GamchaRarity::Special,
        ]
        .into_iter()
        .map(|rarity| costume_ids_for(rarity).len())
        .sum::<usize>();

        assert_eq!(total, drawable_manifest_count());
    }
}
