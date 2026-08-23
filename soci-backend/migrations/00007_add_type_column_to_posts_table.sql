-- +goose Up
-- SQL in this section is executed when the migration is applied.
ALTER TABLE posts ADD `type` VARCHAR(191) NOT NULL DEFAULT "image" AFTER thumbnail;

-- +goose Down
-- SQL in this section is executed when the migration is rolled back.
