-- +goose Up
-- SQL in this section is executed when the migration is applied.
ALTER TABLE users ADD name varchar(191) NOT NULL DEFAULT "" AFTER email;
UPDATE users SET name = email;

-- +goose Down
-- SQL in this section is executed when the migration is rolled back.
