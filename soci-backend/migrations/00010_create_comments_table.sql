-- +goose Up
-- SQL in this section is executed when the migration is applied.
CREATE TABLE `comments` (
    `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
    `author_id` bigint(20) unsigned NOT NULL,
    `post_id` int unsigned NOT NULL DEFAULT 0,
    `created_at` timestamp NOT NULL DEFAULT NOW(),
    `type` varchar(191) NOT NULL DEFAULT "",
    `content` varchar(191) NOT NULL DEFAULT "",
    `text` varchar(191) NOT NULL DEFAULT "",
    `parent_id` bigint(20) unsigned NOT NULL DEFAULT 0, -- comments are self referential, so this id will reference other comments
    PRIMARY KEY (`id`),
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- +goose Down
-- SQL in this section is executed when the migration is rolled back.
