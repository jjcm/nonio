-- +goose Up
-- SQL in this section is executed when the migration is applied.
ALTER TABLE users ADD `stripe_customer_id` VARCHAR(64) NOT NULL DEFAULT "" AFTER email;

-- +goose Down
-- SQL in this section is executed when the migration is rolled back.
