-- +goose Up
-- SQL in this section is executed when the migration is applied.
ALTER TABLE posts ADD `width` int unsigned NOT NULL DEFAULT 0;
ALTER TABLE posts ADD `height` int unsigned NOT NULL DEFAULT 0;

-- +goose Down
-- SQL in this section is executed when the migration is rolled back.
