-- +goose Up
-- SQL in this section is executed when the migration is applied.
ALTER TABLE `community_channel_messages`
  ADD COLUMN `parent_id` int(11) DEFAULT NULL AFTER `image_url`,
  ADD KEY `channel_parent` (`channel_id`, `parent_id`),
  ADD KEY `parent_id` (`parent_id`);

CREATE TABLE `community_channel_message_reactions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `message_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `emoji` varchar(64) NOT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `message_user_emoji` (`message_id`, `user_id`, `emoji`),
  KEY `message_id` (`message_id`),
  KEY `user_id` (`user_id`)
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

CREATE TABLE `user_emoji_subscriptions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `emoji_id` int(11) NOT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_emoji_unique` (`user_id`, `emoji_id`),
  KEY `emoji_id` (`emoji_id`),
  KEY `user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- +goose Down
-- SQL in this section is executed when the migration is rolled back.
DROP TABLE `user_emoji_subscriptions`;
DROP TABLE `emojis`;
DROP TABLE `community_channel_message_reactions`;
ALTER TABLE `community_channel_messages`
  DROP KEY `channel_parent`,
  DROP KEY `parent_id`,
  DROP COLUMN `parent_id`;
