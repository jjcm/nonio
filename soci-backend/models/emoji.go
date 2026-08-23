package models

import (
	"encoding/json"
	"errors"
	"regexp"
	"strings"
	"time"

	"github.com/jmoiron/sqlx"
)

var validEmojiName = regexp.MustCompile(`^[a-z0-9_]{2,32}$`)

type Emoji struct {
	ID          int       `db:"id" json:"id"`
	CommunityID *int      `db:"community_id" json:"communityID,omitempty"`
	OwnerUserID *int      `db:"owner_user_id" json:"ownerUserID,omitempty"`
	Name        string    `db:"name" json:"name"`
	Animated    bool      `db:"animated" json:"animated"`
	CreatedAt   time.Time `db:"created_at" json:"createdAt"`
}

func (e *Emoji) MarshalJSON() ([]byte, error) {
	return json.Marshal(&struct {
		ID          int    `json:"id"`
		CommunityID *int   `json:"communityID,omitempty"`
		OwnerUserID *int   `json:"ownerUserID,omitempty"`
		Name        string `json:"name"`
		Animated    bool   `json:"animated"`
		CreatedAt   int64  `json:"createdAt"`
	}{
		ID:          e.ID,
		CommunityID: e.CommunityID,
		OwnerUserID: e.OwnerUserID,
		Name:        e.Name,
		Animated:    e.Animated,
		CreatedAt:   e.CreatedAt.UnixNano() / int64(time.Millisecond),
	})
}

func sanitizeEmojiName(name string) (string, error) {
	name = strings.TrimSpace(strings.ToLower(name))
	if !validEmojiName.MatchString(name) {
		return "", errors.New("emoji name must match ^[a-z0-9_]{2,32}$")
	}
	return name, nil
}

func CreateCommunityEmoji(communityID, userID int, name string, animated bool) (Emoji, error) {
	n, err := sanitizeEmojiName(name)
	if err != nil {
		return Emoji{}, err
	}
	now := time.Now().Format("2006-01-02 15:04:05")
	res, err := DBConn.Exec(
		"INSERT INTO emojis (community_id, owner_user_id, name, animated, created_at) VALUES (?, NULL, ?, ?, ?)",
		communityID, n, animated, now,
	)
	if err != nil {
		if strings.Contains(err.Error(), "Duplicate entry") {
			return Emoji{}, errors.New("emoji name already taken")
		}
		return Emoji{}, err
	}
	id, err := res.LastInsertId()
	if err != nil {
		return Emoji{}, err
	}
	return GetEmojiByID(int(id))
}

func CreateUserEmoji(userID int, name string, animated bool) (Emoji, error) {
	n, err := sanitizeEmojiName(name)
	if err != nil {
		return Emoji{}, err
	}
	now := time.Now().Format("2006-01-02 15:04:05")
	res, err := DBConn.Exec(
		"INSERT INTO emojis (community_id, owner_user_id, name, animated, created_at) VALUES (NULL, ?, ?, ?, ?)",
		userID, n, animated, now,
	)
	if err != nil {
		if strings.Contains(err.Error(), "Duplicate entry") {
			return Emoji{}, errors.New("emoji name already taken")
		}
		return Emoji{}, err
	}
	id, err := res.LastInsertId()
	if err != nil {
		return Emoji{}, err
	}
	return GetEmojiByID(int(id))
}

func GetEmojiByID(id int) (Emoji, error) {
	e := Emoji{}
	err := DBConn.Get(&e, "SELECT * FROM emojis WHERE id = ?", id)
	return e, err
}

func GetCommunityEmojis(communityID int) ([]Emoji, error) {
	items := []Emoji{}
	err := DBConn.Select(&items, "SELECT * FROM emojis WHERE community_id = ? ORDER BY name ASC", communityID)
	return items, err
}

func GetUserOwnedEmojis(userID int) ([]Emoji, error) {
	items := []Emoji{}
	err := DBConn.Select(&items, "SELECT * FROM emojis WHERE owner_user_id = ? ORDER BY name ASC", userID)
	return items, err
}

func GetUserSubscribedEmojis(userID int) ([]Emoji, error) {
	items := []Emoji{}
	err := DBConn.Select(&items, `
		SELECT e.* FROM emojis e
		JOIN user_emoji_subscriptions s ON s.emoji_id = e.id
		WHERE s.user_id = ?
		ORDER BY e.name ASC
	`, userID)
	return items, err
}

func SubscribeToEmoji(userID, emojiID int) error {
	now := time.Now().Format("2006-01-02 15:04:05")
	_, err := DBConn.Exec(
		"INSERT IGNORE INTO user_emoji_subscriptions (user_id, emoji_id, created_at) VALUES (?, ?, ?)",
		userID, emojiID, now,
	)
	return err
}

func SubscribeToEmojiByName(userID int, name string) error {
	name = strings.TrimSpace(strings.ToLower(name))
	if name == "" {
		return errors.New("name is required")
	}
	var emojiID int
	err := DBConn.Get(&emojiID, "SELECT id FROM emojis WHERE name = ?", name)
	if err != nil {
		return err
	}
	return SubscribeToEmoji(userID, emojiID)
}

func GetEmojisByIDs(ids []int) ([]Emoji, error) {
	if len(ids) == 0 {
		return []Emoji{}, nil
	}
	query, args, err := sqlx.In("SELECT * FROM emojis WHERE id IN (?) ORDER BY id ASC", ids)
	if err != nil {
		return nil, err
	}
	query = DBConn.Rebind(query)
	items := []Emoji{}
	if err := DBConn.Select(&items, query, args...); err != nil {
		return nil, err
	}
	return items, nil
}

type DefaultEmoji struct {
	Name  string `json:"name"`
	Emoji string `json:"emoji"`
}

func GetDefaultEmojis() []DefaultEmoji {
	return []DefaultEmoji{
		{Name: "heart", Emoji: "❤️"},
		{Name: "laugh", Emoji: "😂"},
		{Name: "thumbs_up", Emoji: "👍"},
		{Name: "thumbs_down", Emoji: "👎"},
		{Name: "sad", Emoji: "😢"},
		{Name: "checkbox", Emoji: "✅"},
		{Name: "party", Emoji: "🎉"},
		{Name: "surprised", Emoji: "😮"},
	}
}
