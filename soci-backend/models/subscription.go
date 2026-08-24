package models

import (
	"encoding/json"
	"time"
)

// Subscription - code representation of a users subscription to a tag
type Subscription struct {
	ID        int       `db:"id" json:"-"`
	Tag       Tag       `db:"-" json:"tag"`
	TagName   string    `db:"-" json:"tagName"`
	TagID     int       `db:"tag_id" json:"-"`
	User      User      `db:"-" json:"-"`
	UserID    int       `db:"user_id" json:"-"`
	CommunityID int     `db:"community_id" json:"-"`
	CreatedAt time.Time `db:"created_at" json:"-"`
}

// MarshalJSON custom JSON builder for Tag structs
func (s *Subscription) MarshalJSON() ([]byte, error) {
	// hydrate the tag
	if s.Tag.ID == 0 {
		s.Tag.FindByID(s.TagID)
	}

	// return the custom JSON for this post
	return json.Marshal(&struct {
		Tag string `json:"tag"`
	}{
		Tag: s.Tag.Name,
	})
}

// ToJSON - get a string representation of this Tag in JSON
func (s *Subscription) ToJSON() string {
	jsonData, err := json.Marshal(s)
	if err != nil {
		return err.Error()
	}
	return string(jsonData)
}

/************************************************/
/******************** CREATE ********************/
/************************************************/

// CreateSubscription - create a subscription in the database for a tag
func (u *User) CreateSubscription(tag Tag) (Subscription, error) {
	s := Subscription{}
	now := time.Now().Format("2006-01-02 15:04:05")

	communityID := 0
	if tag.CommunityID != nil {
		communityID = *tag.CommunityID
	}
	_, err := DBConn.Exec("INSERT INTO subscriptions (tag_id, user_id, community_id, created_at) VALUES (?, ?, ?, ?)", tag.ID, u.ID, communityID, now)
	if err != nil {
		return s, err
	}

	err = s.FindSubscription(tag.ID, u.ID)
	return s, err
}

/************************************************/
/********************* READ *********************/
/************************************************/

// FindSubscription - find a given tag in the database by the tag/user pairing
func (s *Subscription) FindSubscription(tagID int, userID int) error {
	dbSubscription := Subscription{}
	err := DBConn.Get(&dbSubscription, "SELECT * FROM subscriptions WHERE tag_id = ? AND user_id = ?", tagID, userID)
	if err != nil {
		return err
	}

	*s = dbSubscription
	return nil
}

// GetSubscriptions will return the user's tag subscriptions
func (u *User) GetSubscriptions(communityID int) ([]*Subscription, error) {
	subscriptions := []*Subscription{}

	err := DBConn.Select(&subscriptions, "SELECT * FROM subscriptions WHERE user_id = ? AND community_id = ?", u.ID, communityID)

	if err != nil {
		return subscriptions, err
	}

	return subscriptions, nil
}

/************************************************/
/******************** UPDATE ********************/
/************************************************/
// Not needed

/************************************************/
/******************** DELETE ********************/
/************************************************/

// DeleteSubscription - create a subscription in the database for a tag
func (u *User) DeleteSubscription(tag Tag) error {
	_, err := DBConn.Exec("DELETE FROM subscriptions WHERE tag_id = ? AND user_id = ?", tag.ID, u.ID)
	return err
}
