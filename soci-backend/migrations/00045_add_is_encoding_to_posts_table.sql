-- +goose Up
-- SQL in this section is executed when the migration is applied.
ALTER TABLE `posts` ADD COLUMN `is_encoding` BOOLEAN NOT NULL DEFAULT FALSE;

-- +goose Down
-- SQL in this section is executed when the migration is rolled back.
ALTER TABLE `posts` DROP COLUMN `is_encoding`;

