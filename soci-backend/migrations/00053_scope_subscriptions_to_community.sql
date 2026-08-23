-- +goose Up
-- SQL in this section is executed when the migration is applied.
-- Subscriptions are scoped to a community via the subscribed tag.
-- Add:
--  - primary key `id` (for easier lookups)
--  - `community_id` (denormalized from tags.community_id for fast filtering)
-- NOTE: some environments may already have an `id` column; make this migration idempotent.

-- Ensure `id` exists.
-- IMPORTANT: MySQL requires AUTO_INCREMENT columns to be indexed at the time they're created/modified.
-- So we add the column first (non-auto), add PK if needed, then enable AUTO_INCREMENT once it's keyed.
SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'subscriptions' AND COLUMN_NAME = 'id') = 0,
  'ALTER TABLE `subscriptions` ADD `id` bigint(20) unsigned NOT NULL FIRST',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- If `id` exists but is unset/duplicated (common when added without AUTO_INCREMENT),
-- backfill unique values before adding a PRIMARY KEY.
SET @needs_backfill := (
  SELECT COUNT(*) FROM `subscriptions` WHERE `id` IS NULL OR `id` = 0
);
SET @has_pk := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'subscriptions'
    AND CONSTRAINT_TYPE = 'PRIMARY KEY'
);
SET @max_id := (SELECT IFNULL(MAX(id),0) FROM `subscriptions`);
SET @i := @max_id;
SET @sql := IF(
  @needs_backfill > 0 AND @has_pk = 0,
  'UPDATE `subscriptions` SET `id` = (@i := @i + 1) WHERE `id` IS NULL OR `id` = 0 ORDER BY `user_id`, `tag_id`',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Ensure primary key exists (on `id`).
SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'subscriptions' AND CONSTRAINT_TYPE = 'PRIMARY KEY') = 0,
  'ALTER TABLE `subscriptions` ADD PRIMARY KEY (`id`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Ensure `id` is AUTO_INCREMENT once it's a key.
SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'subscriptions' AND COLUMN_NAME = 'id' AND EXTRA LIKE '%auto_increment%') = 0
  AND
  (SELECT COUNT(*) FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'subscriptions' AND INDEX_NAME = 'PRIMARY' AND COLUMN_NAME = 'id') > 0,
  'ALTER TABLE `subscriptions` MODIFY `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Ensure `community_id` exists.
SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'subscriptions' AND COLUMN_NAME = 'community_id') = 0,
  'ALTER TABLE `subscriptions` ADD `community_id` int(11) NOT NULL DEFAULT 0 AFTER `user_id`',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Backfill community_id from the subscribed tag (safe to re-run).
UPDATE `subscriptions` s
JOIN `tags` t ON t.id = s.tag_id
SET s.community_id = t.community_id;

-- Helpful index for the common query pattern: "all subscriptions for user in community"
SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'subscriptions' AND INDEX_NAME = 'user_community_idx') = 0,
  'ALTER TABLE `subscriptions` ADD INDEX `user_community_idx` (`user_id`, `community_id`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- +goose Down
-- SQL in this section is executed when the migration is rolled back.
-- Down migrations should be non-destructive: only remove what we added that's clearly safe.
SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'subscriptions' AND INDEX_NAME = 'user_community_idx') > 0,
  'ALTER TABLE `subscriptions` DROP INDEX `user_community_idx`',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'subscriptions' AND COLUMN_NAME = 'community_id') > 0,
  'ALTER TABLE `subscriptions` DROP COLUMN `community_id`',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;


