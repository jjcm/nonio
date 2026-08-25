package models

import (
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"
)

// CommunityChannel - struct representation of a community channel (voice or text)
type CommunityChannel struct {
	ID            int       `db:"id" json:"id"`
	CommunityID   int       `db:"community_id" json:"communityID"`
	Kind          string    `db:"kind" json:"kind"`
	Slug          string    `db:"slug" json:"slug"`
	Name          string    `db:"name" json:"name"`
	CreatorUserID int       `db:"creator_user_id" json:"creatorUserID"`
	CreatedAt     time.Time `db:"created_at" json:"createdAt"`
	UpdatedAt     time.Time `db:"updated_at" json:"updatedAt"`
}

// MarshalJSON custom JSON for API responses
func (c *CommunityChannel) MarshalJSON() ([]byte, error) {
	return json.Marshal(&struct {
		ID            int    `json:"id"`
		CommunityID   int    `json:"communityID"`
		Kind          string `json:"kind"`
		Slug          string `json:"slug"`
		Name          string `json:"name"`
		CreatorUserID int    `json:"creatorUserID"`
		CreatedAt     int64  `json:"createdAt"`
		UpdatedAt     int64  `json:"updatedAt"`
	}{
		ID:            c.ID,
		CommunityID:   c.CommunityID,
		Kind:          c.Kind,
		Slug:          c.Slug,
		Name:          c.Name,
		CreatorUserID: c.CreatorUserID,
		CreatedAt:     c.CreatedAt.UnixNano() / int64(time.Millisecond),
		UpdatedAt:     c.UpdatedAt.UnixNano() / int64(time.Millisecond),
	})
}

const (
	ChannelKindVoice = "voice"
	ChannelKindText  = "text"
)

var validSlug = regexp.MustCompile(`^[a-zA-Z0-9\-_.]+$`)

// FindByID - find a channel by primary key
func (c *CommunityChannel) FindByID(id int) error {
	ch := CommunityChannel{}
	err := DBConn.Get(&ch, "SELECT * FROM community_channels WHERE id = ?", id)
	if err != nil {
		return err
	}
	*c = ch
	return nil
}

// FindByCommunityAndSlug - find a channel by community id and slug
func (c *CommunityChannel) FindByCommunityAndSlug(communityID int, slug string) error {
	ch := CommunityChannel{}
	err := DBConn.Get(&ch, "SELECT * FROM community_channels WHERE community_id = ? AND slug = ?", communityID, slug)
	if err != nil {
		return err
	}
	*c = ch
	return nil
}

// GetChannelsByCommunityID - list all channels for a community, ordered (e.g. voice first, then text; then by name)
func GetChannelsByCommunityID(communityID int) ([]CommunityChannel, error) {
	channels := []CommunityChannel{}
	query := `
		SELECT * FROM community_channels
		WHERE community_id = ?
		ORDER BY kind ASC, name ASC
	`
	err := DBConn.Select(&channels, query, communityID)
	return channels, err
}

// CreateChannel - create a new channel (caller must verify user is moderator)
func (u *User) CreateChannel(communityID int, kind, slug, name string) (CommunityChannel, error) {
	ch := CommunityChannel{}
	now := time.Now().Format("2006-01-02 15:04:05")

	slug = strings.TrimSpace(strings.ToLower(slug))
	name = strings.TrimSpace(name)

	if kind != ChannelKindVoice && kind != ChannelKindText {
		return ch, fmt.Errorf("kind must be %q or %q", ChannelKindVoice, ChannelKindText)
	}
	if slug == "" {
		return ch, errors.New("slug is required")
	}
	if !validSlug.MatchString(slug) {
		return ch, errors.New("slug contains invalid characters")
	}
	if name == "" {
		return ch, errors.New("name is required")
	}

	// Voice channels: convention slug like "voice-1" or "voice-general"
	if kind == ChannelKindVoice && !strings.HasPrefix(slug, "voice-") {
		slug = "voice-" + slug
	}

	result, err := DBConn.Exec(
		"INSERT INTO community_channels (community_id, kind, slug, name, creator_user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
		communityID, kind, slug, name, u.ID, now, now,
	)
	if err != nil {
		return ch, err
	}
	insertID, err := result.LastInsertId()
	if err != nil {
		return ch, err
	}
	err = ch.FindByID(int(insertID))
	return ch, err
}

// IsModeratorOf - returns true if user is a moderator of the community that owns this channel
func (c *CommunityChannel) IsModeratorOf(userID int) (bool, error) {
	var count int
	err := DBConn.Get(&count, "SELECT COUNT(*) FROM community_moderators WHERE community_id = ? AND user_id = ?", c.CommunityID, userID)
	return count > 0, err
}
