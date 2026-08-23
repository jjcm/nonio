-- +goose Up
-- SQL in this section is executed when the migration is applied.
ALTER TABLE comments MODIFY COLUMN `content` TEXT NOT NULL DEFAULT "";

-- +goose Down
-- SQL in this section is executed when the migration is rolled back.
