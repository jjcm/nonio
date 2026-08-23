-- +goose Up
-- SQL in this section is executed when the migration is applied.
ALTER TABLE posts_tags_votes ADD `created_at` timestamp NOT NULL DEFAULT NOW();
ALTER TABLE posts_tags_votes ADD `tallied` boolean NOT NULL DEFAULT 0;

-- +goose Down
-- SQL in this section is executed when the migration is rolled back.
