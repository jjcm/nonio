# Soci Backend API

API documentation for soci-backend. Base URL: https://api.non.io (or configured WEB_HOST).

## Authentication

Most routes require a JWT. Send `Authorization: Bearer <accessToken>` header. Obtain tokens via POST /user/login or POST /user/register. Refresh via POST /user/refresh-access-token.

---

## Models

### Post
```json
{
  "title": "String",
  "url": "String",
  "user": "username",
  "score": "Number",
  "date": "Number",
  "content": "String",
  "type": "String",
  "tags": ["postTag"]
}
```

### PostTag
```json
{
  "tag": "tag",
  "post": "post",
  "score": "Number"
}
```

### PostTagVote
```json
{
  "tag": "tag",
  "post": "post",
  "user": "username",
  "score": "Number"
}
```

### Tag
```json
{
  "name": "String",
  "count": "Number"
}
```

### Comment
```json
{
  "id": "String",
  "time": "Number",
  "post": "post",
  "parent": "comment",
  "childCount": "Number",
  "content": "String",
  "user": "username",
  "upvotes": "Number",
  "downvotes": "Number",
  "threadUpvotes": "Number",
  "threadDownvotes": "Number"
}
```

### CommentVote
```json
{
  "comment": "comment",
  "post": "post",
  "user": "user",
  "date": "Date",
  "positive": "Boolean"
}
```

### Notification
```json
{
  "id": "Number",
  "comment_id": "Number",
  "date": "Number",
  "post": "String",
  "post_title": "String",
  "post_type": "String",
  "content": "String",
  "user": "String",
  "upvotes": "Number",
  "downvotes": "Number",
  "parent": "Number",
  "parent_content": "String",
  "edited": "Boolean",
  "read": "Boolean"
}
```

---

## Posts

### GET /posts
Returns 100 posts. Query params: offset, sort (popular|top|new), time (all|day|week|month|year), tag, user, community, type (image|video|blog|link|audio). Auth optional.

### GET /posts/:url or /posts/@community/:url
Returns a single post by URL. Use ?community=slug as fallback. Public.

### POST /post/create
Create a post. Auth required. JSON: title, url, content, type, link?, tags?, width?, height?, community?

### POST /post/delete
Delete a post. Auth required. JSON: url, community.

### GET /post/url-is-available/:url
Returns boolean if URL is available. ?community=slug optional. Public.

### POST /post/encoding-complete
Internal. Called by video CDN when encoding done.

### POST /post/parse-external-url
Returns opengraph data for a URL. Auth required. JSON: url.

---

## Tags

### GET /tags
Returns up to 100 tags. ?community=slug required for community-scoped tags.

### GET /tags/:prefix
Returns tags starting with prefix. ?community=slug optional.

---

## PostTags

### POST /posttag/create
Add tag to post. Auth required. JSON: post (url), tag, community? (@slug for community posts).

### POST /posttag/add-vote
Vote for posttag. Auth required. JSON: post, tag.

### POST /posttag/remove-vote
Remove vote. Auth required. JSON: post, tag.

---

## Comments

### GET /comments
Query params: post (post url), community (slug), user (username), offset, sort (top|new), time. Returns comments. Public.

### POST /comment/create
Create comment. Auth required. JSON: post, community? (@slug), parent?, content.

### POST /comment/edit
Edit comment. Auth required. JSON: id, content.

### POST /comment/delete
Delete comment. Auth required. JSON: id.

### POST /comment/abandon
Abandon a comment (soft delete). Auth required.

### POST /comment/add-vote
Add vote. Auth required.

### POST /comment/remove-vote
Remove vote. Auth required.

---

## User

### POST /user/login
Login. JSON: email, password. Returns accessToken, refreshToken, username, roles.

### POST /user/refresh-access-token
Refresh tokens. JSON: refreshToken.

### POST /user/register
Register. JSON: username, email, password. Returns accessToken, refreshToken, username.

### GET /user/username-is-available/:username
Returns boolean. Public.

### GET /users/:username
Get user profile. Public.

### POST /user/forgot-password-request
Send reset email. JSON: email.

### POST /user/change-forgotten-password
Reset password. JSON: token, newPassword, confirmPassword.

### POST /user/change-password
Change password. Auth required.

### POST /user/update-description
Update description. Auth required.

### GET /user/get-financials
Get financial summary. Auth required.

### GET /user/get-financial-ledger
Get financial ledger. Auth required.

### GET /users/search?q=:query
Search users. Auth required.

### POST /user/choose-free-account
Switch to free account. Auth required.

---

## Notifications

### GET /notifications
Returns notifications. ?unread=true|false. Auth required.

### GET /notifications/unread-count
Returns unread count. Auth required.

### POST /notification/mark-read
Mark notification read. Auth required. JSON: id.

---

## Communities

### GET /communities
List communities. Public.

### GET /communities/:slug
Get community. Optional auth.

### POST /community/create
Create community. Auth required. JSON: url, name, description?.

### POST /community/subscribe
Subscribe. Auth required. JSON: community (@slug).

### POST /community/unsubscribe
Unsubscribe. Auth required.

### GET /communities/subscribed
User's subscribed communities. Auth required.

### POST /community/add-moderator
Add moderator. Creator/moderator only. Auth required.

### POST /community/remove-moderator
Remove moderator. Auth required.

### POST /community/add-member
Add member. Moderator only. Auth required.

### POST /community/remove-member
Remove member. Auth required.

### GET /community/moderators?community=:slug
Get moderators. Auth required.

### POST /community/update
Update community. Moderator only. Auth required.

### POST /community/ban
Ban user. Moderator only. Auth required.

### POST /community/unban
Unban user. Auth required.

### GET /community/users?community=:slug
Get members. Auth required.

### GET /community/financials?community=:slug
Get financials. Creator/moderator only. Auth required.

---

## Channels

### GET /community/channels?community=:slug
List channels. Member-gated. Auth required.

### POST /community/channel/create
Create channel. Moderator only. Kind: text or voice. JSON: community, kind, slug, name.

### GET /community/channel/messages?community=:slug&channel=:slug&before=:id&limit=50
List messages. Auth required.

### POST /community/channel/messages
Create message. Auth required. JSON: community, channel, content, imageURL?.

### GET /community/channel/ws?community=:slug&channel=:slug&token=:jwt
WebSocket for real-time text-channel events. Emits:
- `channel.message.created` with a full message payload.
- `channel.message.reaction` with `{ messageID, emoji, reacted, count }`.

### GET /community/channel/thread?community=:slug&channel=:slug&message=:id
Get thread replies. Auth required.

### POST /community/channel/message/react
Toggle reaction. Auth required. JSON: community, channel, message, emoji.

---

## Voice (LiveKit)

Requires LIVEKIT_* env vars.

### POST /voice/join
Get LiveKit token. Auth required. JSON: community, channel.

### POST /voice/presence
Get voice presence. Auth required. JSON: community.

### GET /voice/presence/ws
WebSocket for real-time presence. ?community=:slug + auth.

---

## Stripe

### POST /stripe/subscription/create
Create subscription. Auth required.

### POST /stripe/subscription/delete
Cancel subscription. Auth required.

### POST /stripe/subscription/edit
Edit subscription. Auth required.

### GET /stripe/subscription
Get subscription. Auth required.

### GET /stripe/price-config
Get price config. Auth required.

### POST /stripe/create-customer
Create customer. Auth required.

### GET /stripe/get-connect-link
Get Connect link. Auth required.

### POST /stripe/webhooks
Webhook endpoint. Internal.

---

## Subscriptions (tag/creator)

### GET /subscriptions?community=:slug
User subscriptions. Auth required.

### POST /subscription/create
Create subscription. Auth required.

### POST /subscription/delete
Delete subscription. Auth required.

---

## Admin

### POST /admin/ban
Ban user site-wide. Admin only.

### POST /admin/nuke
Nuke user. Admin only.

---

## Emojis

### GET /community/emojis?community=:slug
Get community emojis. Auth required.

### POST /community/emoji/create
Create community emoji. Moderator only. Auth required.

### POST /emoji/create
Create user emoji. Auth required.

### GET /emojis/sets
Get emoji sets. Auth required.

### POST /emoji/subscribe
Subscribe to emoji set. Auth required.

### GET /emoji?id=:id
Get emoji by ID. Auth required.

---

## Other

### GET /votes
Get user votes. Auth required.

### GET /comment-votes
Get comment votes. Auth required.

### GET /protected
Get token details. Auth required.
