-- +goose Up
-- SQL in this section is executed when the migration is applied.
ALTER TABLE users ADD `last_login` timestamp NOT NULL DEFAULT "0000-00-00 00:00:00" AFTER password;

-- +goose Down
-- SQL in this section is executed when the migration is rolled back.
