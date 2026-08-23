-- +goose Up
-- +goose StatementBegin
CREATE TABLE `admin_users` (
    `user_id` bigint(20) unsigned NOT NULL,
    CONSTRAINT `users` FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- +goose StatementEnd
