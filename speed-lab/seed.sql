-- speed-lab/seed.sql
-- LAB ONLY. Deterministic fixture for measuring in-app SPA transitions.
-- Never run against production.
--
-- Shape (chosen so all three measured navigations are realistic):
--   3 authors            -> homepage -> user is a real multi-post author page
--   21 posts (10 image, 10 text, 1 video)
--   5 tags, 2-3 per post -> homepage -> tag is a real tagged-filter feed
--   comments on posts    -> homepage -> post exercises the comment waterfall

SET NAMES utf8mb4;

INSERT INTO users (id, email, username, name, password, description, created_at, updated_at)
VALUES
  (9001, 'speedlab@local.test', 'speedlab', 'Speed Lab', 'speedlab', 'Fixture author for the transition speed lab.', '2026-08-17 21:00:00', '2026-08-17 21:00:00'),
  (9002, 'artcritic@local.test', 'artcritic', 'Art Critic', 'artcritic', 'Second fixture author so the user route has a distinct feed.', '2026-08-17 21:00:00', '2026-08-17 21:00:00'),
  (9003, 'devlog@local.test', 'devlog', 'Dev Log', 'devlog', 'Third fixture author.', '2026-08-17 21:00:00', '2026-08-17 21:00:00')
ON DUPLICATE KEY UPDATE
  email = VALUES(email), username = VALUES(username), name = VALUES(name),
  password = VALUES(password), description = VALUES(description);

INSERT IGNORE INTO communities (id, name, url, description, created_at, updated_at)
VALUES (1, 'nonio', 'nonio', 'nonio', '2026-08-17 21:00:00', '2026-08-17 21:00:00');

DELETE FROM posts_tags_votes WHERE post_id BETWEEN 1001 AND 1021;
DELETE FROM posts_tags WHERE post_id BETWEEN 1001 AND 1021;
DELETE FROM comments WHERE post_id BETWEEN 1001 AND 1021;
DELETE FROM posts WHERE id BETWEEN 1001 AND 1021;
DELETE FROM tags WHERE id BETWEEN 5001 AND 5005;

INSERT INTO posts (id, title, url, user_id, thumbnail, type, score, content, created_at, updated_at, width, height, link, domain, is_encoding, community_id, comment_count) VALUES
  (1001, 'Speed lab image 01 — crimson field', 'sl-img-01', 9001, 'sl-img-01', 'image', 21, '', '2026-08-17 21:00:00', '2026-08-17 21:00:00', 800, 450, '', '', 0, 0, 3),
  (1002, 'Speed lab image 02 — amber field', 'sl-img-02', 9002, 'sl-img-02', 'image', 20, '', '2026-08-17 21:00:01', '2026-08-17 21:00:01', 800, 450, '', '', 0, 0, 2),
  (1003, 'Speed lab image 03 — gold field', 'sl-img-03', 9001, 'sl-img-03', 'image', 19, '', '2026-08-17 21:00:02', '2026-08-17 21:00:02', 800, 450, '', '', 0, 0, 0),
  (1004, 'Speed lab image 04 — lime field', 'sl-img-04', 9003, 'sl-img-04', 'image', 18, '', '2026-08-17 21:00:03', '2026-08-17 21:00:03', 800, 450, '', '', 0, 0, 4),
  (1005, 'Speed lab image 05 — verdant field', 'sl-img-05', 9001, 'sl-img-05', 'image', 17, '', '2026-08-17 21:00:04', '2026-08-17 21:00:04', 800, 450, '', '', 0, 0, 0),
  (1006, 'Speed lab image 06 — teal field', 'sl-img-06', 9002, 'sl-img-06', 'image', 16, '', '2026-08-17 21:00:05', '2026-08-17 21:00:05', 800, 450, '', '', 0, 0, 1),
  (1007, 'Speed lab image 07 — cobalt field', 'sl-img-07', 9001, 'sl-img-07', 'image', 15, '', '2026-08-17 21:00:06', '2026-08-17 21:00:06', 800, 450, '', '', 0, 0, 0),
  (1008, 'Speed lab image 08 — indigo field', 'sl-img-08', 9003, 'sl-img-08', 'image', 14, '', '2026-08-17 21:00:07', '2026-08-17 21:00:07', 800, 450, '', '', 0, 0, 0),
  (1009, 'Speed lab image 09 — violet field', 'sl-img-09', 9001, 'sl-img-09', 'image', 13, '', '2026-08-17 21:00:08', '2026-08-17 21:00:08', 800, 450, '', '', 0, 0, 2),
  (1010, 'Speed lab image 10 — magenta field', 'sl-img-10', 9002, 'sl-img-10', 'image', 12, '', '2026-08-17 21:00:09', '2026-08-17 21:00:09', 800, 450, '', '', 0, 0, 0),
  (1011, 'Speed lab text post 01: cold-start feed paint', 'sl-txt-01', 9001, '', 'text', 11, 'Speed lab text post 01: this paragraph is a fixed-length markdown body used to measure first-contentful-paint on a text-only card. It must stay unique so the feed cannot collapse identical nodes.', '2026-08-17 21:00:10', '2026-08-17 21:00:10', 0, 0, '', '', 0, 0, 5),
  (1012, 'Speed lab text post 02: warm-cache list reuse', 'sl-txt-02', 9003, '', 'text', 10, 'Speed lab text post 02: second unique body for warm navigation. The copy mentions thumbnail reuse and list virtualization so LCP candidates stay distinct from the image lane.', '2026-08-17 21:00:11', '2026-08-17 21:00:11', 0, 0, '', '', 0, 0, 0),
  (1013, 'Speed lab text post 03: image-to-text swap', 'sl-txt-03', 9001, '', 'text', 9, 'Speed lab text post 03: measures layout shift when a text card follows a 800x450 image card. Deterministic wording keeps hash-based caches stable across runs.', '2026-08-17 21:00:12', '2026-08-17 21:00:12', 0, 0, '', '', 0, 0, 1),
  (1014, 'Speed lab text post 04: comment-empty baseline', 'sl-txt-04', 9002, '', 'text', 8, 'Speed lab text post 04: empty comment_count fixture. Use this row to time the comments drawer open on a post that has never been discussed.', '2026-08-17 21:00:13', '2026-08-17 21:00:13', 0, 0, '', '', 0, 0, 0),
  (1015, 'Speed lab text post 05: long-title wrap', 'sl-txt-05', 9001, '', 'text', 7, 'Speed lab text post 05: title wrapping and two-line clamp. The body is still short so the card height stays predictable at default feed density.', '2026-08-17 21:00:14', '2026-08-17 21:00:14', 0, 0, '', '', 0, 0, 0),
  (1016, 'Speed lab text post 06: markdown emphasis', 'sl-txt-06', 9003, '', 'text', 6, 'Speed lab text post 06: **bold**, *italic*, and `inline code` exercise the markdown renderer without pulling images. Keep this file under 400 bytes.', '2026-08-17 21:00:15', '2026-08-17 21:00:15', 0, 0, '', '', 0, 0, 2),
  (1017, 'Speed lab text post 07: link-less body', 'sl-txt-07', 9001, '', 'text', 5, 'Speed lab text post 07: no outbound links, no embeds. Isolates text layout cost from the link-unfurl path in nonio-frontend.', '2026-08-17 21:00:16', '2026-08-17 21:00:16', 0, 0, '', '', 0, 0, 0),
  (1018, 'Speed lab text post 08: community default scope', 'sl-txt-08', 9002, '', 'text', 4, 'Speed lab text post 08: community_id=0 default-from-migration-00050. Used to confirm scoped url uniqueness does not hide the seed posts.', '2026-08-17 21:00:17', '2026-08-17 21:00:17', 0, 0, '', '', 0, 0, 0),
  (1019, 'Speed lab text post 09: score-order sentinel', 'sl-txt-09', 9001, '', 'text', 3, 'Speed lab text post 09: score is fixed so this card always sits at the same offset in the home feed.', '2026-08-17 21:00:18', '2026-08-17 21:00:18', 0, 0, '', '', 0, 0, 0),
  (1020, 'Speed lab text post 10: last text before video', 'sl-txt-10', 9003, '', 'text', 2, 'Speed lab text post 10: final text fixture immediately above the single video card. Marks the image/text/video boundary for LCP attribution.', '2026-08-17 21:00:19', '2026-08-17 21:00:19', 0, 0, '', '', 0, 0, 0),
  (1021, 'Speed lab video 01 — steel field', 'sl-vid-01', 9001, 'sl-vid-01', 'video', 1, '', '2026-08-17 21:00:20', '2026-08-17 21:00:20', 1280, 720, '', '', 0, 0, 1);

-- Tags. community_id 0 = frontpage (migration 00052 scopes tags to community).
INSERT INTO tags (id, name, user_id, created_at, count, community_id) VALUES
  (5001, 'photography', 9001, '2026-08-17 21:00:00', 0, 0),
  (5002, 'art',         9001, '2026-08-17 21:00:00', 0, 0),
  (5003, 'code',        9003, '2026-08-17 21:00:00', 0, 0),
  (5004, 'music',       9002, '2026-08-17 21:00:00', 0, 0),
  (5005, 'nature',      9001, '2026-08-17 21:00:00', 0, 0);

-- 2-3 tags per post. `photography` is the measured tag: 10 posts, mixed image/text/video,
-- which is a big enough result set for the filtered feed to be a real render.
INSERT INTO posts_tags (post_id, tag_id, score, created_at) VALUES
  (1001, 5001, 18, '2026-08-17 21:00:00'), (1001, 5002, 11, '2026-08-17 21:00:00'), (1001, 5005, 7, '2026-08-17 21:00:00'),
  (1002, 5001, 17, '2026-08-17 21:00:00'), (1002, 5005, 9, '2026-08-17 21:00:00'),
  (1003, 5001, 16, '2026-08-17 21:00:00'), (1003, 5002, 8, '2026-08-17 21:00:00'),
  (1004, 5001, 15, '2026-08-17 21:00:00'), (1004, 5005, 10, '2026-08-17 21:00:00'), (1004, 5002, 4, '2026-08-17 21:00:00'),
  (1005, 5001, 14, '2026-08-17 21:00:00'), (1005, 5005, 6, '2026-08-17 21:00:00'),
  (1006, 5001, 13, '2026-08-17 21:00:00'), (1006, 5004, 5, '2026-08-17 21:00:00'),
  (1007, 5001, 12, '2026-08-17 21:00:00'), (1007, 5002, 6, '2026-08-17 21:00:00'), (1007, 5005, 3, '2026-08-17 21:00:00'),
  (1008, 5002, 11, '2026-08-17 21:00:00'), (1008, 5004, 4, '2026-08-17 21:00:00'),
  (1009, 5002, 10, '2026-08-17 21:00:00'), (1009, 5005, 5, '2026-08-17 21:00:00'),
  (1010, 5002, 9,  '2026-08-17 21:00:00'), (1010, 5004, 3, '2026-08-17 21:00:00'),
  (1011, 5003, 9,  '2026-08-17 21:00:00'), (1011, 5001, 8, '2026-08-17 21:00:00'),
  (1012, 5003, 8,  '2026-08-17 21:00:00'), (1012, 5004, 2, '2026-08-17 21:00:00'),
  (1013, 5003, 7,  '2026-08-17 21:00:00'), (1013, 5001, 6, '2026-08-17 21:00:00'),
  (1014, 5003, 6,  '2026-08-17 21:00:00'), (1014, 5002, 3, '2026-08-17 21:00:00'),
  (1015, 5003, 5,  '2026-08-17 21:00:00'), (1015, 5005, 2, '2026-08-17 21:00:00'),
  (1016, 5003, 4,  '2026-08-17 21:00:00'), (1016, 5004, 2, '2026-08-17 21:00:00'),
  (1017, 5003, 3,  '2026-08-17 21:00:00'), (1017, 5002, 2, '2026-08-17 21:00:00'),
  (1018, 5004, 3,  '2026-08-17 21:00:00'), (1018, 5005, 2, '2026-08-17 21:00:00'),
  (1019, 5004, 2,  '2026-08-17 21:00:00'), (1019, 5002, 1, '2026-08-17 21:00:00'),
  (1020, 5004, 2,  '2026-08-17 21:00:00'), (1020, 5001, 1, '2026-08-17 21:00:00'),
  (1021, 5001, 5,  '2026-08-17 21:00:00'), (1021, 5005, 4, '2026-08-17 21:00:00'), (1021, 5004, 1, '2026-08-17 21:00:00');

UPDATE tags t SET t.count = (SELECT COUNT(*) FROM posts_tags pt WHERE pt.tag_id = t.id) WHERE t.id BETWEEN 5001 AND 5005;

-- Comments. Post 1011 is the measured post: 5 comments incl. one nested reply,
-- so the /comments -> /comment-votes waterfall is exercised.
INSERT INTO comments (id, author_id, post_id, created_at, content, parent_id, lineage_score, descendent_comment_count, upvotes, downvotes, edited) VALUES
  (7001, 9002, 1011, '2026-08-17 22:00:00', 'First comment on the measured post. Long enough to require a markdown render pass in the comment list.', 0, 5, 1, 5, 0, 0),
  (7002, 9003, 1011, '2026-08-17 22:01:00', 'Reply to the first comment, so the tree builder has at least one nested level to lay out.', 7001, 3, 0, 3, 0, 0),
  (7003, 9001, 1011, '2026-08-17 22:02:00', 'Third top-level comment with `inline code` and **bold** to exercise the markdown path.', 0, 4, 0, 4, 0, 0),
  (7004, 9002, 1011, '2026-08-17 22:03:00', 'Fourth comment. Deterministic text keeps response bytes stable between runs.', 0, 2, 0, 2, 0, 0),
  (7005, 9003, 1011, '2026-08-17 22:04:00', 'Fifth and last comment on the measured post.', 0, 1, 0, 1, 0, 0),
  (7006, 9001, 1001, '2026-08-17 22:05:00', 'Comment on image post 01.', 0, 2, 0, 2, 0, 0),
  (7007, 9002, 1001, '2026-08-17 22:06:00', 'Second comment on image post 01.', 0, 1, 0, 1, 0, 0),
  (7008, 9003, 1001, '2026-08-17 22:07:00', 'Third comment on image post 01.', 0, 1, 0, 1, 0, 0),
  (7009, 9001, 1002, '2026-08-17 22:08:00', 'Comment on image post 02.', 0, 1, 0, 1, 0, 0),
  (7010, 9003, 1002, '2026-08-17 22:09:00', 'Second comment on image post 02.', 0, 1, 0, 1, 0, 0),
  (7011, 9001, 1004, '2026-08-17 22:10:00', 'Comment on image post 04.', 0, 2, 0, 2, 0, 0),
  (7012, 9002, 1004, '2026-08-17 22:11:00', 'Second comment on image post 04.', 0, 1, 0, 1, 0, 0),
  (7013, 9001, 1004, '2026-08-17 22:12:00', 'Third comment on image post 04.', 0, 1, 0, 1, 0, 0),
  (7014, 9003, 1004, '2026-08-17 22:13:00', 'Fourth comment on image post 04.', 0, 1, 0, 1, 0, 0),
  (7015, 9002, 1006, '2026-08-17 22:14:00', 'Comment on image post 06.', 0, 1, 0, 1, 0, 0),
  (7016, 9001, 1009, '2026-08-17 22:15:00', 'Comment on image post 09.', 0, 1, 0, 1, 0, 0),
  (7017, 9003, 1009, '2026-08-17 22:16:00', 'Second comment on image post 09.', 0, 1, 0, 1, 0, 0),
  (7018, 9002, 1013, '2026-08-17 22:17:00', 'Comment on text post 03.', 0, 1, 0, 1, 0, 0),
  (7019, 9001, 1016, '2026-08-17 22:18:00', 'Comment on text post 06.', 0, 1, 0, 1, 0, 0),
  (7020, 9003, 1016, '2026-08-17 22:19:00', 'Second comment on text post 06.', 0, 1, 0, 1, 0, 0),
  (7021, 9002, 1021, '2026-08-17 22:20:00', 'Comment on the video post.', 0, 1, 0, 1, 0, 0);
