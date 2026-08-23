-- +goose Up
-- SQL in this section is executed when the migration is applied.
ALTER TABLE posts_tags ADD `id` bigint(20) unsigned PRIMARY KEY AUTO_INCREMENT FIRST;

-- +goose Down
-- SQL in this section is executed when the migration is rolled back.
