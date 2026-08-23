-- +goose Up
-- SQL in this section is executed when the migration is applied.
CREATE TABLE `votes` (
    `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
    `voter_id` bigint(20) unsigned NOT NULL,
    `vote` tinyint(1) NOT NULL DEFAULT "1",
    `item_id` int unsigned NOT NULL,
    `item_type` varchar(191) NOT NULL DEFAULT "comment",
    PRIMARY KEY (`id`),
    FOREIGN KEY (voter_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- +goose Down
-- SQL in this section is executed when the migration is rolled back.
