-- +goose Up
-- SQL in this section is executed when the migration is applied.
ALTER TABLE users ADD `cash` float unsigned NOT NULL DEFAULT 0;

-- +goose Down
-- SQL in this section is executed when the migration is rolled back.

ALTER TABLE users DROP COLUMN `cash`;