-- +goose Up
-- +goose StatementBegin
ALTER TABLE users ADD `stripe_connect_account_id` VARCHAR(64) NOT NULL DEFAULT "" AFTER stripe_customer_id;
-- +goose StatementEnd
