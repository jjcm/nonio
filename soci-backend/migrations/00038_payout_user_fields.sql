-- +goose Up
-- +goose StatementBegin
ALTER TABLE users ADD `current_period_end` timestamp NOT NULL DEFAULT "0000-00-00 00:00:00" AFTER `account_type`, ADD `next_payout` timestamp NOT NULL DEFAULT "0000-00-00 00:00:00" AFTER `account_type`, ADD `last_payout` timestamp NOT NULL DEFAULT "0000-00-00 00:00:00" AFTER `account_type`;

-- +goose StatementEnd
