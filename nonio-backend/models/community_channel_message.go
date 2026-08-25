package models

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jmoiron/sqlx"
)

// CommunityChannelMessage - a single message in a text channel
type CommunityChannelMessage struct {
	ID         int                             `db:"id" json:"id"`
	ChannelID  int                             `db:"channel_id" json:"channelID"`
	AuthorID   int                             `db:"author_id" json:"authorID"`
	Content    string                          `db:"content" json:"content"`
	ImageURL   string                          `db:"image_url" json:"imageUrl,omitempty"`
	ParentID   *int                            `db:"parent_id" json:"parentID,omitempty"`
	CreatedAt  time.Time                       `db:"created_at" json:"createdAt"`
	Author     User                            `db:"-" json:"-"`
	ReplyCount int                             `db:"-" json:"replyCount"`
	ReplyUsers []string                        `db:"-" json:"replyUsers,omitempty"`
	Reactions  []ChannelMessageReactionSummary `db:"-" json:"reactions"`
}

func normalizeImageURLs(imageURLs []string) []string {
	out := make([]string, 0, len(imageURLs))
	seen := map[string]struct{}{}
	for _, imageURL := range imageURLs {
		value := strings.TrimSpace(imageURL)
		if value == "" {
			continue
		}
		if _, exists := seen[value]; exists {
			continue
		}
		seen[value] = struct{}{}
		out = append(out, value)
	}
	return out
}

func parseImageURLs(raw string) []string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return []string{}
	}
	if strings.HasPrefix(raw, "[") {
		var parsed []string
		if err := json.Unmarshal([]byte(raw), &parsed); err == nil {
			return normalizeImageURLs(parsed)
		}
	}
	if strings.Contains(raw, ",") {
		return normalizeImageURLs(strings.Split(raw, ","))
	}
	return []string{raw}
}

func serializeImageURLs(imageURLs []string) string {
	normalized := normalizeImageURLs(imageURLs)
	if len(normalized) == 0 {
		return ""
	}
	return strings.Join(normalized, ",")
}

type ChannelMessageReactionSummary struct {
	Emoji   string `json:"emoji"`
	Count   int    `json:"count"`
	Reacted bool   `json:"reacted"`
}

// MarshalJSON custom JSON for API
func (m *CommunityChannelMessage) MarshalJSON() ([]byte, error) {
	username := ""
	if m.Author.ID != 0 {
		username = m.Author.GetDisplayName()
	} else if m.AuthorID > 0 {
		u := User{}
		_ = u.FindByID(m.AuthorID)
		username = u.GetDisplayName()
	}
	imageURLs := parseImageURLs(m.ImageURL)
	imageURL := ""
	if len(imageURLs) > 0 {
		imageURL = imageURLs[0]
	}
	return json.Marshal(&struct {
		ID         int                             `json:"id"`
		ChannelID  int                             `json:"channelID"`
		AuthorID   int                             `json:"authorID"`
		User       string                          `json:"user"`
		Content    string                          `json:"content"`
		ImageURL   string                          `json:"imageUrl,omitempty"`
		ImageURLs  []string                        `json:"imageUrls,omitempty"`
		ParentID   *int                            `json:"parentID,omitempty"`
		ReplyCount int                             `json:"replyCount"`
		ReplyUsers []string                        `json:"replyUsers,omitempty"`
		Reactions  []ChannelMessageReactionSummary `json:"reactions"`
		Date       int64                           `json:"date"`
	}{
		ImageURLs:  imageURLs,
		ID:         m.ID,
		ChannelID:  m.ChannelID,
		AuthorID:   m.AuthorID,
		User:       username,
		Content:    m.Content,
		ImageURL:   imageURL,
		ParentID:   m.ParentID,
		ReplyCount: m.ReplyCount,
		ReplyUsers: m.ReplyUsers,
		Reactions:  m.Reactions,
		Date:       m.CreatedAt.UnixNano() / int64(time.Millisecond),
	})
}

// CreateChannelMessage - insert a message (caller must verify channel is text and user is member)
func (u *User) CreateChannelMessage(channelID int, content string, imageURLs []string) (CommunityChannelMessage, error) {
	return u.CreateChannelMessageWithParent(channelID, content, imageURLs, nil)
}

// CreateChannelMessageWithParent - insert a message with optional parent id
func (u *User) CreateChannelMessageWithParent(channelID int, content string, imageURLs []string, parentID *int) (CommunityChannelMessage, error) {
	msg := CommunityChannelMessage{}
	now := time.Now().Format("2006-01-02 15:04:05")

	ch := CommunityChannel{}
	if err := ch.FindByID(channelID); err != nil {
		return msg, err
	}
	if ch.ID == 0 {
		return msg, errors.New("channel not found")
	}
	if ch.Kind != ChannelKindText {
		return msg, fmt.Errorf("channel is not a text channel")
	}

	content = strings.TrimSpace(content)
	imageURLs = normalizeImageURLs(imageURLs)
	if content == "" && len(imageURLs) == 0 {
		return msg, errors.New("content or image is required")
	}
	imageURL := serializeImageURLs(imageURLs)

	query := "INSERT INTO community_channel_messages (channel_id, author_id, content, image_url, parent_id, created_at) VALUES (?, ?, ?, ?, ?, ?)"
	result, err := DBConn.Exec(query, channelID, u.ID, content, imageURL, parentID, now)
	if err != nil {
		return msg, err
	}
	insertID, err := result.LastInsertId()
	if err != nil {
		return msg, err
	}
	err = msg.FindByID(int(insertID))
	return msg, err
}

// CreateChannelReply - insert a reply to a top-level parent message
func (u *User) CreateChannelReply(channelID, parentMessageID int, content string, imageURLs []string) (CommunityChannelMessage, error) {
	parent := CommunityChannelMessage{}
	if err := parent.FindByID(parentMessageID); err != nil {
		return CommunityChannelMessage{}, err
	}
	if parent.ChannelID != channelID {
		return CommunityChannelMessage{}, errors.New("parent message must be in the same channel")
	}
	if parent.ParentID != nil {
		return CommunityChannelMessage{}, errors.New("you can only reply to top-level messages")
	}
	return u.CreateChannelMessageWithParent(channelID, content, imageURLs, &parentMessageID)
}

// FindByID - load message by id
func (m *CommunityChannelMessage) FindByID(id int) error {
	row := CommunityChannelMessage{}
	err := DBConn.Get(&row, "SELECT * FROM community_channel_messages WHERE id = ?", id)
	if err != nil {
		return err
	}
	*m = row
	return nil
}

// ChannelMessageQueryParams - list params for messages
type ChannelMessageQueryParams struct {
	ChannelID    int
	BeforeID     int
	Limit        int
	TopLevelOnly bool
	ParentID     *int
}

// GetChannelMessages - list messages for a channel, newest first; if BeforeID > 0, return older than that message
func GetChannelMessages(params *ChannelMessageQueryParams) ([]*CommunityChannelMessage, error) {
	limit := params.Limit
	if limit <= 0 {
		limit = 50
	}
	if limit > 100 {
		limit = 100
	}

	query := "SELECT * FROM community_channel_messages WHERE channel_id = ?"
	args := []interface{}{params.ChannelID}
	if params.TopLevelOnly {
		query += " AND parent_id IS NULL"
	} else if params.ParentID != nil {
		query += " AND parent_id = ?"
		args = append(args, *params.ParentID)
	}
	if params.BeforeID > 0 {
		query += " AND id < ?"
		args = append(args, params.BeforeID)
	}
	query += " ORDER BY id DESC LIMIT ?"
	args = append(args, limit)

	msgs := []*CommunityChannelMessage{}
	err := DBConn.Select(&msgs, query, args...)
	return msgs, err
}

// HydrateChannelMessageMetadata populates reply counts + reactions for message list rows.
func HydrateChannelMessageMetadata(messages []*CommunityChannelMessage, userID int) error {
	if len(messages) == 0 {
		return nil
	}
	ids := make([]int, 0, len(messages))
	for _, m := range messages {
		ids = append(ids, m.ID)
	}

	replyCounts, err := GetReplyCountsForMessages(ids)
	if err != nil {
		return err
	}
	replyUsers, err := GetTopReplyUsersForMessages(ids, 5)
	if err != nil {
		return err
	}
	reactionsByMessage, err := GetReactionSummariesForMessages(ids, userID)
	if err != nil {
		return err
	}
	for _, m := range messages {
		m.ReplyCount = replyCounts[m.ID]
		m.ReplyUsers = replyUsers[m.ID]
		m.Reactions = reactionsByMessage[m.ID]
		if m.Reactions == nil {
			m.Reactions = []ChannelMessageReactionSummary{}
		}
	}
	return nil
}

func GetReplyCountsForMessages(messageIDs []int) (map[int]int, error) {
	out := map[int]int{}
	if len(messageIDs) == 0 {
		return out, nil
	}
	query, args, err := sqlx.In(
		"SELECT parent_id, COUNT(*) AS count FROM community_channel_messages WHERE parent_id IN (?) GROUP BY parent_id",
		messageIDs,
	)
	if err != nil {
		return out, err
	}
	query = DBConn.Rebind(query)
	rows := []struct {
		ParentID int `db:"parent_id"`
		Count    int `db:"count"`
	}{}
	if err := DBConn.Select(&rows, query, args...); err != nil {
		return out, err
	}
	for _, r := range rows {
		out[r.ParentID] = r.Count
	}
	return out, nil
}

func GetTopReplyUsersForMessages(messageIDs []int, limit int) (map[int][]string, error) {
	out := map[int][]string{}
	if len(messageIDs) == 0 {
		return out, nil
	}
	if limit <= 0 {
		limit = 5
	}
	query, args, err := sqlx.In(`
		SELECT
			parent_id,
			author_id,
			COUNT(*) AS count,
			MAX(id) AS last_id
		FROM community_channel_messages
		WHERE parent_id IN (?)
		GROUP BY parent_id, author_id
		ORDER BY parent_id ASC, count DESC, last_id DESC, author_id ASC
	`, messageIDs)
	if err != nil {
		return out, err
	}
	query = DBConn.Rebind(query)
	rows := []struct {
		ParentID int `db:"parent_id"`
		AuthorID int `db:"author_id"`
		Count    int `db:"count"`
		LastID   int `db:"last_id"`
	}{}
	if err := DBConn.Select(&rows, query, args...); err != nil {
		return out, err
	}
	nameByAuthorID := map[int]string{}
	for _, row := range rows {
		if len(out[row.ParentID]) >= limit {
			continue
		}
		name, ok := nameByAuthorID[row.AuthorID]
		if !ok {
			u := User{}
			if err := u.FindByID(row.AuthorID); err != nil {
				return out, err
			}
			name = u.GetDisplayName()
			nameByAuthorID[row.AuthorID] = name
		}
		if name == "" {
			continue
		}
		out[row.ParentID] = append(out[row.ParentID], name)
	}
	return out, nil
}

func GetReactionSummariesForMessages(messageIDs []int, userID int) (map[int][]ChannelMessageReactionSummary, error) {
	out := map[int][]ChannelMessageReactionSummary{}
	if len(messageIDs) == 0 {
		return out, nil
	}
	query, args, err := sqlx.In(`
		SELECT
			r.message_id,
			r.emoji,
			COUNT(*) AS count,
			MAX(CASE WHEN r.user_id = ? THEN 1 ELSE 0 END) AS reacted
		FROM community_channel_message_reactions r
		WHERE r.message_id IN (?)
		GROUP BY r.message_id, r.emoji
		ORDER BY count DESC, r.emoji ASC
	`, userID, messageIDs)
	if err != nil {
		return out, err
	}
	query = DBConn.Rebind(query)
	rows := []struct {
		MessageID int    `db:"message_id"`
		Emoji     string `db:"emoji"`
		Count     int    `db:"count"`
		Reacted   int    `db:"reacted"`
	}{}
	if err := DBConn.Select(&rows, query, args...); err != nil {
		return out, err
	}
	for _, r := range rows {
		out[r.MessageID] = append(out[r.MessageID], ChannelMessageReactionSummary{
			Emoji:   r.Emoji,
			Count:   r.Count,
			Reacted: r.Reacted == 1,
		})
	}
	return out, nil
}

// ToggleChannelMessageReaction toggles a message reaction for a user and emoji.
func ToggleChannelMessageReaction(messageID, userID int, emoji string) (bool, error) {
	emoji = strings.TrimSpace(emoji)
	if emoji == "" {
		return false, errors.New("emoji is required")
	}
	var count int
	if err := DBConn.Get(&count, "SELECT COUNT(*) FROM community_channel_message_reactions WHERE message_id = ? AND user_id = ? AND emoji = ?", messageID, userID, emoji); err != nil {
		return false, err
	}
	if count > 0 {
		_, err := DBConn.Exec("DELETE FROM community_channel_message_reactions WHERE message_id = ? AND user_id = ? AND emoji = ?", messageID, userID, emoji)
		return false, err
	}
	now := time.Now().Format("2006-01-02 15:04:05")
	_, err := DBConn.Exec("INSERT INTO community_channel_message_reactions (message_id, user_id, emoji, created_at) VALUES (?, ?, ?, ?)", messageID, userID, emoji, now)
	if err != nil {
		return false, err
	}
	return true, nil
}

func GetReactionCountForMessageEmoji(messageID int, emoji string) (int, error) {
	emoji = strings.TrimSpace(emoji)
	if messageID <= 0 || emoji == "" {
		return 0, errors.New("messageID and emoji are required")
	}
	var count int
	if err := DBConn.Get(&count, "SELECT COUNT(*) FROM community_channel_message_reactions WHERE message_id = ? AND emoji = ?", messageID, emoji); err != nil {
		return 0, err
	}
	return count, nil
}
