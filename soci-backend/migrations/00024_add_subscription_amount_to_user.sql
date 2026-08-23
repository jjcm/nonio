-- +goose Up
-- SQL in this section is executed when the migration is applied.
ALTER TABLE users ADD `subscription_amount` float unsigned NOT NULL DEFAULT 10;

-- +goose Down
-- SQL in this section is executed when the migration is rolled back.

ALTER TABLE users DROP COLUMN `subscription_amount`;