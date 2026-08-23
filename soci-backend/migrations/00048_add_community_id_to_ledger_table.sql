-- +goose Up
-- SQL in this section is executed when the migration is applied.
ALTER TABLE `ledger` ADD COLUMN `community_id` int(11) DEFAULT NULL;

-- +goose Down
-- SQL in this section is executed when the migration is rolled back.
ALTER TABLE `ledger` DROP COLUMN `community_id`;

