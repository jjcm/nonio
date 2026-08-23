-- +goose Up
-- SQL in this section is executed when the migration is applied.
ALTER TABLE users ADD `description` TEXT NOT NULL DEFAULT "";

-- +goose Down
-- SQL in this section is executed when the migration is rolled back.
