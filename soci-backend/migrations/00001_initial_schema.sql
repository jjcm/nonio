-- +goose Up
-- Initial schema for a fresh Nonio database.
--
-- This single migration replaces the historical chain of 55 incremental
-- migrations (00001..00055). It reproduces the exact schema that chain
-- produced, captured from a database migrated to version 55.
--
-- Notes:
--  * The historical data backfills (e.g. `UPDATE users SET name = email`)
--    only rewrote rows that existed mid-chain; a fresh database has no such
--    rows, so no seed data is required here.
--  * The old 00037_add_admin_users.sql.sql migration was a silent no-op
--    under goose (double .sql extension; goose logged OK without executing
--    the statement), so no `admin_users` table has ever existed on a fresh
--    database and nothing in the code references it. It is intentionally
--    absent here.
--  * Databases created with the old chain are already at goose version 55
--    and will treat this file (version 1) as already applied. To pick up
--    the new hot-path indexes below on such a database, run the ALTERs in
--    scripts/2026-08-23-add-hot-path-indexes.sql once.
--  * On top of the historical schema, this file adds five secondary
--    indexes on hot query paths (marked "hot path" below): comments.post_id,
--    posts(community_id, created_at), posts.user_id,
--    posts_tags_votes.voter_id, notifications.user_id.

CREATE TABLE `users` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `email` varchar(191) NOT NULL,
  `stripe_customer_id` varchar(64) NOT NULL DEFAULT '',
  `stripe_connect_account_id` varchar(64) NOT NULL DEFAULT '',
  `username` varchar(191) NOT NULL DEFAULT '',
  `name` varchar(191) NOT NULL DEFAULT '',
  `password` varchar(191) NOT NULL,
  `last_login` timestamp NOT NULL DEFAULT '0000-00-00 00:00:00',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `subscription_amount` float unsigned NOT NULL DEFAULT 10,
  `cash` float unsigned NOT NULL DEFAULT 0,
  `description` text NOT NULL DEFAULT '',
  `account_type` varchar(64) NOT NULL DEFAULT 'new',
  `last_payout` timestamp NOT NULL DEFAULT '0000-00-00 00:00:00',
  `next_payout` timestamp NOT NULL DEFAULT '0000-00-00 00:00:00',
  `current_period_end` timestamp NOT NULL DEFAULT '0000-00-00 00:00:00',
  `stripe_subscription_id` varchar(64) NOT NULL DEFAULT '',
  PRIMARY KEY (`id`),
  UNIQUE KEY `email_unique` (`email`),
  UNIQUE KEY `unique_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `comment_votes` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `comment_id` int(10) unsigned NOT NULL DEFAULT 0,
  `voter_id` int(10) unsigned NOT NULL DEFAULT 0,
  `post_id` int(10) unsigned NOT NULL DEFAULT 0,
  `upvote` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `vote` (`voter_id`,`comment_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `comments` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `author_id` bigint(20) unsigned DEFAULT NULL,
  `post_id` int(10) unsigned NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `content` text NOT NULL DEFAULT '',
  `parent_id` bigint(20) unsigned NOT NULL DEFAULT 0,
  `lineage_score` int(11) NOT NULL DEFAULT 0,
  `descendent_comment_count` int(11) NOT NULL DEFAULT 0,
  `upvotes` int(11) NOT NULL DEFAULT 0,
  `downvotes` int(11) NOT NULL DEFAULT 0,
  `edited` tinyint(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `author_id` (`author_id`),
  -- hot path: every post page loads its thread with WHERE post_id = ?
  KEY `post_id` (`post_id`),
  CONSTRAINT `comments_ibfk_1` FOREIGN KEY (`author_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `communities` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `url` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `creator_id` int(11) NOT NULL DEFAULT 0,
  `privacy_type` varchar(50) DEFAULT 'public',
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  `post_permission` varchar(50) DEFAULT 'all',
  `comment_permission` varchar(50) DEFAULT 'all',
  PRIMARY KEY (`id`),
  UNIQUE KEY `url` (`url`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `community_banned_users` (
  `community_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`community_id`,`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `community_channel_message_reactions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `message_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `emoji` varchar(64) NOT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `message_user_emoji` (`message_id`,`user_id`,`emoji`),
  KEY `message_id` (`message_id`),
  KEY `user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `community_channel_messages` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `channel_id` int(11) NOT NULL,
  `author_id` int(11) NOT NULL,
  `content` text NOT NULL,
  `image_url` varchar(512) DEFAULT NULL,
  `parent_id` int(11) DEFAULT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `channel_created` (`channel_id`,`created_at`),
  KEY `channel_id` (`channel_id`),
  KEY `channel_parent` (`channel_id`,`parent_id`),
  KEY `parent_id` (`parent_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `community_channels` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `community_id` int(11) NOT NULL,
  `kind` varchar(32) NOT NULL DEFAULT 'text',
  `slug` varchar(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `creator_user_id` int(11) NOT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `community_slug` (`community_id`,`slug`),
  KEY `community_id` (`community_id`),
  KEY `kind` (`kind`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `community_moderators` (
  `community_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`community_id`,`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `community_subscribers` (
  `community_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`community_id`,`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `emojis` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `community_id` int(11) DEFAULT NULL,
  `owner_user_id` int(11) DEFAULT NULL,
  `name` varchar(64) NOT NULL,
  `animated` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name_unique` (`name`),
  KEY `community_id` (`community_id`),
  KEY `owner_user_id` (`owner_user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `ledger` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `author_id` bigint(20) unsigned NOT NULL,
  `contributor_id` bigint(20) DEFAULT NULL,
  `type` varchar(191) NOT NULL DEFAULT '',
  `amount` float unsigned NOT NULL DEFAULT 0,
  `description` varchar(191) NOT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `community_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `users_fk` (`author_id`),
  CONSTRAINT `users_fk` FOREIGN KEY (`author_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `notifications` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned NOT NULL DEFAULT 0,
  `comment_id` bigint(20) unsigned NOT NULL DEFAULT 0,
  `read` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  -- hot path: notification list + unread count filter WHERE user_id = ?
  KEY `user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `payouts` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned NOT NULL DEFAULT 0,
  `amount` float unsigned NOT NULL DEFAULT 10,
  `payout_date` timestamp NOT NULL DEFAULT '0000-00-00 00:00:00',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `tallied` tinyint(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `posts` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `title` varchar(191) NOT NULL DEFAULT '',
  `url` varchar(191) NOT NULL DEFAULT '',
  `domain` varchar(191) NOT NULL DEFAULT '',
  `link` varchar(191) NOT NULL DEFAULT '',
  `user_id` int(10) unsigned NOT NULL DEFAULT 0,
  `thumbnail` varchar(191) NOT NULL DEFAULT '',
  `type` varchar(191) NOT NULL DEFAULT 'image',
  `score` int(11) NOT NULL DEFAULT 0,
  `content` text NOT NULL DEFAULT '',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `width` int(10) unsigned NOT NULL DEFAULT 0,
  `height` int(10) unsigned NOT NULL DEFAULT 0,
  `comment_count` int(11) NOT NULL DEFAULT 0,
  `is_encoding` tinyint(1) NOT NULL DEFAULT 0,
  `community_id` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `url_community_unique` (`url`,`community_id`),
  -- hot path: every feed query filters community_id and created_at
  KEY `community_created` (`community_id`,`created_at`),
  -- hot path: user profile feeds filter WHERE user_id = ?
  KEY `user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `posts_tags` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `post_id` int(10) unsigned NOT NULL DEFAULT 0,
  `tag_id` int(10) unsigned NOT NULL DEFAULT 0,
  `score` int(11) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `post_tags` (`post_id`,`tag_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `posts_tags_votes` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `post_id` int(10) unsigned NOT NULL DEFAULT 0,
  `tag_id` int(10) unsigned NOT NULL DEFAULT 0,
  `voter_id` int(10) unsigned NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `tallied` tinyint(1) NOT NULL DEFAULT 0,
  `creator_id` bigint(20) unsigned NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `u_posts_tags_voters` (`post_id`,`tag_id`,`voter_id`),
  -- hot path: /votes loads a signed-in user's votes with WHERE voter_id = ?
  KEY `voter_id` (`voter_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `roles` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned NOT NULL DEFAULT 0,
  `role` varchar(255) NOT NULL DEFAULT '',
  `expires_at` timestamp NOT NULL DEFAULT '0000-00-00 00:00:00',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `subscriptions` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `tag_id` int(10) unsigned NOT NULL DEFAULT 0,
  `user_id` int(10) unsigned NOT NULL DEFAULT 0,
  `community_id` int(11) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `subscription` (`user_id`,`tag_id`),
  KEY `user_community_idx` (`user_id`,`community_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `tags` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(191) NOT NULL DEFAULT '',
  `user_id` int(10) unsigned NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `count` int(11) NOT NULL DEFAULT 0,
  `community_id` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name_community_unique` (`name`,`community_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `user_emoji_subscriptions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `emoji_id` int(11) NOT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_emoji_unique` (`user_id`,`emoji_id`),
  KEY `emoji_id` (`emoji_id`),
  KEY `user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `user_temp_passwords` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `email` varchar(191) NOT NULL,
  `temp_password` varchar(191) NOT NULL DEFAULT '',
  `temp_password_expiry` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email_unique` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `votes` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `voter_id` bigint(20) unsigned NOT NULL,
  `vote` tinyint(1) NOT NULL DEFAULT 1,
  `item_id` int(10) unsigned NOT NULL,
  `item_type` varchar(191) NOT NULL DEFAULT 'comment',
  PRIMARY KEY (`id`),
  KEY `voter_id` (`voter_id`),
  CONSTRAINT `votes_ibfk_1` FOREIGN KEY (`voter_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- +goose Down
DROP TABLE IF EXISTS `votes`;
DROP TABLE IF EXISTS `user_temp_passwords`;
DROP TABLE IF EXISTS `user_emoji_subscriptions`;
DROP TABLE IF EXISTS `tags`;
DROP TABLE IF EXISTS `subscriptions`;
DROP TABLE IF EXISTS `roles`;
DROP TABLE IF EXISTS `posts_tags_votes`;
DROP TABLE IF EXISTS `posts_tags`;
DROP TABLE IF EXISTS `posts`;
DROP TABLE IF EXISTS `payouts`;
DROP TABLE IF EXISTS `notifications`;
DROP TABLE IF EXISTS `ledger`;
DROP TABLE IF EXISTS `emojis`;
DROP TABLE IF EXISTS `community_subscribers`;
DROP TABLE IF EXISTS `community_moderators`;
DROP TABLE IF EXISTS `community_channels`;
DROP TABLE IF EXISTS `community_channel_messages`;
DROP TABLE IF EXISTS `community_channel_message_reactions`;
DROP TABLE IF EXISTS `community_banned_users`;
DROP TABLE IF EXISTS `communities`;
DROP TABLE IF EXISTS `comments`;
DROP TABLE IF EXISTS `comment_votes`;
DROP TABLE IF EXISTS `users`;
