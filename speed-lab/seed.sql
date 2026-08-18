-- speed-lab/seed.sql
-- Idempotent-ish MySQL seed for soci-backend (socidb).
-- EXPERIMENTAL. Do not run against production.

SET NAMES utf8mb4;

-- Lab user (plaintext password is fine; this account is for fixture ownership, not login).
INSERT INTO users (id, email, username, name, password, created_at, updated_at)
VALUES (9001, 'speedlab@local.test', 'speedlab', 'Speed Lab', 'speedlab', '2026-08-17 21:00:00', '2026-08-17 21:00:00')
ON DUPLICATE KEY UPDATE
  email = VALUES(email),
  username = VALUES(username),
  name = VALUES(name),
  password = VALUES(password);

-- Default community if missing. Posts use community_id=0 (migration 00050 default).
INSERT IGNORE INTO communities (id, name, url, description, created_at, updated_at)
VALUES (1, 'nonio', 'nonio', 'nonio', '2026-08-17 21:00:00', '2026-08-17 21:00:00');

DELETE FROM posts WHERE url LIKE 'sl-%' AND user_id = 9001;

INSERT INTO posts (id, title, url, user_id, thumbnail, type, score, content, created_at, updated_at, width, height, link, domain, is_encoding, community_id, comment_count) VALUES
  (1001, 'Speed lab image 01 — crimson field', 'sl-img-01', 9001, 'sl-img-01', 'image', 21, '', '2026-08-17 21:00:00', '2026-08-17 21:00:00', 800, 450, '', '', 0, 0, 0),
  (1002, 'Speed lab image 02 — amber field', 'sl-img-02', 9001, 'sl-img-02', 'image', 20, '', '2026-08-17 21:00:01', '2026-08-17 21:00:01', 800, 450, '', '', 0, 0, 0),
  (1003, 'Speed lab image 03 — gold field', 'sl-img-03', 9001, 'sl-img-03', 'image', 19, '', '2026-08-17 21:00:02', '2026-08-17 21:00:02', 800, 450, '', '', 0, 0, 0),
  (1004, 'Speed lab image 04 — lime field', 'sl-img-04', 9001, 'sl-img-04', 'image', 18, '', '2026-08-17 21:00:03', '2026-08-17 21:00:03', 800, 450, '', '', 0, 0, 0),
  (1005, 'Speed lab image 05 — verdant field', 'sl-img-05', 9001, 'sl-img-05', 'image', 17, '', '2026-08-17 21:00:04', '2026-08-17 21:00:04', 800, 450, '', '', 0, 0, 0),
  (1006, 'Speed lab image 06 — teal field', 'sl-img-06', 9001, 'sl-img-06', 'image', 16, '', '2026-08-17 21:00:05', '2026-08-17 21:00:05', 800, 450, '', '', 0, 0, 0),
  (1007, 'Speed lab image 07 — cobalt field', 'sl-img-07', 9001, 'sl-img-07', 'image', 15, '', '2026-08-17 21:00:06', '2026-08-17 21:00:06', 800, 450, '', '', 0, 0, 0),
  (1008, 'Speed lab image 08 — indigo field', 'sl-img-08', 9001, 'sl-img-08', 'image', 14, '', '2026-08-17 21:00:07', '2026-08-17 21:00:07', 800, 450, '', '', 0, 0, 0),
  (1009, 'Speed lab image 09 — violet field', 'sl-img-09', 9001, 'sl-img-09', 'image', 13, '', '2026-08-17 21:00:08', '2026-08-17 21:00:08', 800, 450, '', '', 0, 0, 0),
  (1010, 'Speed lab image 10 — magenta field', 'sl-img-10', 9001, 'sl-img-10', 'image', 12, '', '2026-08-17 21:00:09', '2026-08-17 21:00:09', 800, 450, '', '', 0, 0, 0),
  (1011, 'Speed lab text post 01: cold-start feed paint', 'sl-txt-01', 9001, '', 'text', 11, 'Speed lab text post 01: this paragraph is a fixed-length markdown body used to measure first-contentful-paint on a text-only card. It must stay unique so the feed cannot collapse identical nodes.', '2026-08-17 21:00:10', '2026-08-17 21:00:10', 0, 0, '', '', 0, 0, 0),
  (1012, 'Speed lab text post 02: warm-cache list reuse', 'sl-txt-02', 9001, '', 'text', 10, 'Speed lab text post 02: second unique body for warm navigation. The copy mentions thumbnail reuse and list virtualization so LCP candidates stay distinct from the image lane.', '2026-08-17 21:00:11', '2026-08-17 21:00:11', 0, 0, '', '', 0, 0, 0),
  (1013, 'Speed lab text post 03: image-to-text swap', 'sl-txt-03', 9001, '', 'text', 9, 'Speed lab text post 03: measures layout shift when a text card follows a 800x450 image card. Deterministic wording keeps hash-based caches stable across Fable and Qwen runs.', '2026-08-17 21:00:12', '2026-08-17 21:00:12', 0, 0, '', '', 0, 0, 0),
  (1014, 'Speed lab text post 04: comment-empty baseline', 'sl-txt-04', 9001, '', 'text', 8, 'Speed lab text post 04: empty comment_count fixture. Use this row to time the comments drawer open on a post that has never been discussed.', '2026-08-17 21:00:13', '2026-08-17 21:00:13', 0, 0, '', '', 0, 0, 0),
  (1015, 'Speed lab text post 05: long-title wrap', 'sl-txt-05', 9001, '', 'text', 7, 'Speed lab text post 05: title wrapping and two-line clamp. The body is still short so the card height stays predictable at default feed density.', '2026-08-17 21:00:14', '2026-08-17 21:00:14', 0, 0, '', '', 0, 0, 0),
  (1016, 'Speed lab text post 06: markdown emphasis', 'sl-txt-06', 9001, '', 'text', 6, 'Speed lab text post 06: **bold**, *italic*, and `inline code` exercise the markdown renderer without pulling images. Keep this file under 400 bytes.', '2026-08-17 21:00:15', '2026-08-17 21:00:15', 0, 0, '', '', 0, 0, 0),
  (1017, 'Speed lab text post 07: link-less body', 'sl-txt-07', 9001, '', 'text', 5, 'Speed lab text post 07: no outbound links, no embeds. Isolates text layout cost from the link-unfurl path in soci-frontend.', '2026-08-17 21:00:16', '2026-08-17 21:00:16', 0, 0, '', '', 0, 0, 0),
  (1018, 'Speed lab text post 08: community default scope', 'sl-txt-08', 9001, '', 'text', 4, 'Speed lab text post 08: community_id=0 default-from-migration-00050. Used to confirm scoped url uniqueness does not hide the seed posts.', '2026-08-17 21:00:17', '2026-08-17 21:00:17', 0, 0, '', '', 0, 0, 0),
  (1019, 'Speed lab text post 09: score-order sentinel', 'sl-txt-09', 9001, '', 'text', 3, 'Speed lab text post 09: score is fixed so this card always sits at the same offset in the home feed. Do not edit the score in seed.sql without updating posts.json.', '2026-08-17 21:00:18', '2026-08-17 21:00:18', 0, 0, '', '', 0, 0, 0),
  (1020, 'Speed lab text post 10: last text before video', 'sl-txt-10', 9001, '', 'text', 2, 'Speed lab text post 10: final text fixture immediately above the single video card. Marks the image/text/video boundary for LCP attribution.', '2026-08-17 21:00:19', '2026-08-17 21:00:19', 0, 0, '', '', 0, 0, 0),
  (1021, 'Speed lab video 01 — steel field', 'sl-vid-01', 9001, 'sl-vid-01', 'video', 1, '', '2026-08-17 21:00:20', '2026-08-17 21:00:20', 1280, 720, '', '', 0, 0, 0);
