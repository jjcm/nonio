-- +goose Up
-- +goose StatementBegin
ALTER TABLE users ADD `account_type` VARCHAR(64) NOT NULL DEFAULT "new";
-- +goose StatementEnd
