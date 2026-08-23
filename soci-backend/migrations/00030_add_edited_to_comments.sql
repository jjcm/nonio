-- +goose Up
-- SQL in this section is executed when the migration is applied.
ALTER TABLE comments ADD `edited` BOOLEAN NOT NULL DEFAULT 0;

-- +goose Down
-- SQL in this section is executed when the migration is rolled back.
