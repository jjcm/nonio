-- +goose Up
-- SQL in this section is executed when the migration is applied.
UPDATE users SET username = email WHERE username = "";
ALTER TABLE users ADD CONSTRAINT unique_username UNIQUE (username);

-- +goose Down
-- SQL in this section is executed when the migration is rolled back.
