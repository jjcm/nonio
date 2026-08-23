-- +goose Up
-- SQL in this section is executed when the migration is applied.
ALTER TABLE `posts` DROP INDEX `url_unique`;
UPDATE `posts` SET `community_id` = IFNULL(`community_id`, 0);
ALTER TABLE `posts` MODIFY `community_id` int(11) NOT NULL DEFAULT 0;
ALTER TABLE `posts` ADD UNIQUE KEY `url_community_unique` (`url`, `community_id`);

-- +goose Down
-- SQL in this section is executed when the migration is rolled back.
ALTER TABLE `posts` DROP INDEX `url_community_unique`;
ALTER TABLE `posts` MODIFY `community_id` int(11) DEFAULT NULL;
ALTER TABLE `posts` ADD UNIQUE KEY `url_unique` (`url`);

