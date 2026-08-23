-- +goose Up
-- SQL in this section is executed when the migration is applied.
ALTER TABLE `communities` ADD COLUMN `post_permission` varchar(50) DEFAULT 'all';
ALTER TABLE `communities` ADD COLUMN `comment_permission` varchar(50) DEFAULT 'all';

-- +goose Down
-- SQL in this section is executed when the migration is rolled back.
ALTER TABLE `communities` DROP COLUMN `comment_permission`;
ALTER TABLE `communities` DROP COLUMN `post_permission`;

