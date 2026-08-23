-- +goose Up
-- SQL in this section is executed when the migration is applied.
ALTER TABLE posts ADD `comment_count` int NOT NULL DEFAULT 0;

-- +goose Down
-- SQL in this section is executed when the migration is rolled back.
