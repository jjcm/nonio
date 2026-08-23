-- +goose Up
-- SQL in this section is executed when the migration is applied.
ALTER TABLE comments MODIFY COLUMN `author_id` bigint(20) unsigned;

-- +goose Down
-- SQL in this section is executed when the migration is rolled back.
