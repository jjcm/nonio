-- +goose Up
-- SQL in this section is executed when the migration is applied.
CREATE TABLE `payouts` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned NOT NULL DEFAULT 0,
  `amount` float unsigned NOT NULL DEFAULT 10,
  `payout_date` timestamp NOT NULL DEFAULT "0000-00-00 00:00:00",
  `created_at` timestamp NOT NULL DEFAULT NOW(),
  `tallied` boolean NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- +goose Down
-- SQL in this section is executed when the migration is rolled back.