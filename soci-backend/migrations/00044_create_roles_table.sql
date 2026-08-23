-- +goose Up
-- SQL in this section is executed when the migration is applied.
CREATE TABLE `roles` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned NOT NULL DEFAULT 0,
  `role` varchar(255) NOT NULL DEFAULT '',
  `expires_at` timestamp NOT NULL DEFAULT '0000-00-00 00:00:00',
  `created_at` timestamp NOT NULL DEFAULT NOW(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/* this effectively replaces the admin_users table, and is a more flexible approach */
drop table admin_users;

-- +goose Down
-- SQL in this section is executed when the migration is rolled back.