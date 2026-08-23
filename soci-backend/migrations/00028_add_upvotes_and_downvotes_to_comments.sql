-- +goose Up
-- SQL in this section is executed when the migration is applied.
ALTER TABLE comments ADD `upvotes` int NOT NULL DEFAULT 0;
ALTER TABLE comments ADD `downvotes` int NOT NULL DEFAULT 0;

-- +goose Down
-- SQL in this section is executed when the migration is rolled back.
