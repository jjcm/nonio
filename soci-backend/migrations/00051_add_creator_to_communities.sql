-- +goose Up
-- SQL in this section is executed when the migration is applied.
ALTER TABLE `communities` ADD COLUMN `creator_id` int(11) NOT NULL DEFAULT 0 AFTER `description`;

-- +goose Down
-- SQL in this section is executed when the migration is rolled back.
ALTER TABLE `communities` DROP COLUMN `creator_id`;

