-- +goose Up
-- SQL in this section is executed when the migration is applied.
ALTER TABLE posts_tags ADD `score` int NOT NULL DEFAULT 0 AFTER tag_id;

-- +goose Down
-- SQL in this section is executed when the migration is rolled back.
