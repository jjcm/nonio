-- +goose Up
-- SQL in this section is executed when the migration is applied.
ALTER TABLE posts ADD `link` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT "" AFTER `url`, ADD `domain` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT "" AFTER `url`;

-- +goose Down
-- SQL in this section is executed when the migration is rolled back.
