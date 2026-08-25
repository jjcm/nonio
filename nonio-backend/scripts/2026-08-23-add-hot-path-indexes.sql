-- One-shot for databases created before the condensed initial migration
-- (goose version 55 databases). Fresh databases get these indexes from
-- migrations/00001_initial_schema.sql and must NOT run this file.
--
--   mysql socidb < scripts/2026-08-23-add-hot-path-indexes.sql

ALTER TABLE `comments` ADD KEY `post_id` (`post_id`);
ALTER TABLE `posts` ADD KEY `community_created` (`community_id`, `created_at`);
ALTER TABLE `posts` ADD KEY `user_id` (`user_id`);
ALTER TABLE `posts_tags_votes` ADD KEY `voter_id` (`voter_id`);
ALTER TABLE `notifications` ADD KEY `user_id` (`user_id`);
