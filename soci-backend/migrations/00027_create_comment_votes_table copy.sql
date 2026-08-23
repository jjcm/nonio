-- +goose Up
-- SQL in this section is executed when the migration is applied.
CREATE TABLE `comment_votes` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `comment_id` int unsigned NOT NULL DEFAULT 0,
  `voter_id` int unsigned NOT NULL DEFAULT 0,
  `post_id` int unsigned NOT NULL DEFAULT 0,
  `upvote` boolean NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT NOW(),
  PRIMARY KEY (`id`),
  CONSTRAINT `vote` UNIQUE (voter_id, comment_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- +goose Down
-- SQL in this section is executed when the migration is rolled back.
