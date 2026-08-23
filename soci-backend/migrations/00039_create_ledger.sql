-- +goose Up
-- +goose StatementBegin
CREATE TABLE IF NOT EXISTS ledger
(
    `id`          bigint(20) unsigned NOT NULL AUTO_INCREMENT,
    `author_id`     bigint(20) unsigned NOT NULL,
    `contributor_id`     bigint(20) signed DEFAULT NULL,
    `type`        varchar(191)        NOT NULL DEFAULT '',
    `amount`      float unsigned      NOT NULL DEFAULT 0,
    `description` varchar(191)        NOT NULL,
    `created_at`  datetime default CURRENT_TIMESTAMP null,
    PRIMARY KEY (id),
    CONSTRAINT `users_fk` FOREIGN KEY (author_id) REFERENCES users (id)
)
-- +goose StatementEnd
