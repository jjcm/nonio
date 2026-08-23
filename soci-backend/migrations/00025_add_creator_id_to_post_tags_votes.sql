-- +goose Up
-- SQL in this section is executed when the migration is applied.
ALTER TABLE posts_tags_votes ADD `creator_id` bigint(20) unsigned NOT NULL DEFAULT 0;

-- +goose Down
-- SQL in this section is executed when the migration is rolled back.
