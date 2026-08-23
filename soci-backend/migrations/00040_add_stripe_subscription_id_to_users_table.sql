-- +goose Up
-- SQL in this section is executed when the migration is applied.
ALTER TABLE users ADD `stripe_subscription_id` VARCHAR(64) NOT NULL DEFAULT "";

-- +goose Down
-- SQL in this section is executed when the migration is rolled back.
