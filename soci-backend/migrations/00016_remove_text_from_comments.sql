-- +goose Up
-- SQL in this section is executed when the migration is applied.
ALTER TABLE comments DROP COLUMN `text`;

-- +goose Down
-- SQL in this section is executed when the migration is rolled back.
