-- +goose Up
-- SQL in this section is executed when the migration is applied.
-- Tags should be unique per community (and community_id=0 represents the frontpage/root).
UPDATE `tags` SET `community_id` = IFNULL(`community_id`, 0);
ALTER TABLE `tags` MODIFY `community_id` int(11) NOT NULL DEFAULT 0;
ALTER TABLE `tags` DROP INDEX `url_unique`;
ALTER TABLE `tags` ADD UNIQUE KEY `name_community_unique` (`name`, `community_id`);

-- +goose Down
-- SQL in this section is executed when the migration is rolled back.
ALTER TABLE `tags` DROP INDEX `name_community_unique`;
ALTER TABLE `tags` ADD UNIQUE KEY `url_unique` (`name`);
UPDATE `tags` SET `community_id` = NULL WHERE `community_id` = 0;
ALTER TABLE `tags` MODIFY `community_id` int(11) DEFAULT NULL;


