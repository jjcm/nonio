-- +goose Up
-- SQL in this section is executed when the migration is applied.
CREATE TABLE `posts` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `title` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT "",
  `url` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT "",
  `user_id` int unsigned NOT NULL DEFAULT 0,
  `thumbnail` varchar(191) NOT NULL DEFAULT "",
  `score` int NOT NULL DEFAULT 0,
  `content` text NOT NULL DEFAULT "",
  `created_at` timestamp NOT NULL DEFAULT NOW(),
  `updated_at` timestamp NOT NULL DEFAULT NOW(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `url_unique` (`url`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- +goose Down
-- SQL in this section is executed when the migration is rolled back.
