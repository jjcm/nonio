package models

import (
	"encoding/json"
	"fmt"
	"regexp"
	"time"
)

// Community - struct representation of a single community
type Community struct {
	ID          int       `db:"id" json:"id"`
	Name        string    `db:"name" json:"name"`
	URL         string    `db:"url" json:"url"`
	Description string    `db:"description" json:"description"`
	CreatorID   int       `db:"creator_id" json:"creatorID"`
	PrivacyType string    `db:"privacy_type" json:"privacyType"`
	PostPermission    string    `db:"post_permission" json:"postPermission"`
	CommentPermission string    `db:"comment_permission" json:"commentPermission"`
	CreatedAt   time.Time `db:"created_at" json:"createdAt"`
	UpdatedAt   time.Time `db:"updated_at" json:"updatedAt"`
}

// MarshalJSON custom JSON builder for Community structs
func (c *Community) MarshalJSON() ([]byte, error) {
	return json.Marshal(&struct {
		ID          int    `json:"id"`
		Name        string `json:"name"`
		URL         string `json:"url"`
		Description string `json:"description"`
		CreatorID   int    `json:"creatorID"`
		PrivacyType string `json:"privacyType"`
		PostPermission    string `json:"postPermission"`
		CommentPermission string `json:"commentPermission"`
		CreatedAt   int64  `json:"createdAt"`
	}{
		ID:          c.ID,
		Name:        c.Name,
		URL:         c.URL,
		Description: c.Description,
		CreatorID:   c.CreatorID,
		PrivacyType: c.PrivacyType,
		PostPermission: c.PostPermission,
		CommentPermission: c.CommentPermission,
		CreatedAt:   c.CreatedAt.UnixNano() / int64(time.Millisecond),
	})
}

// ToJSON - get a string representation of this Community in JSON
func (c *Community) ToJSON() string {
	jsonData, err := json.Marshal(c)
	if err != nil {
		return err.Error()
	}
	return string(jsonData)
}

/************************************************/
/******************** CREATE ********************/
/************************************************/

// CreateCommunity - create a new community in the database
func (u *User) CreateCommunity(name, url, description, privacyType string) (Community, error) {
	c := Community{}
	now := time.Now().Format("2006-01-02 15:04:05")

	if len(name) == 0 {
		return c, fmt.Errorf("community must contain a name")
	}

	if len(url) == 0 {
		return c, fmt.Errorf("community must contain a url")
	}

	// Validate URL characters
	validURL := regexp.MustCompile(`^[a-zA-Z0-9\-\._]*$`)
	if !validURL.MatchString(url) {
		return c, fmt.Errorf("url contains invalid characters")
	}

	if privacyType == "" {
		privacyType = "public"
	}

	result, err := DBConn.Exec("INSERT INTO communities (name, url, description, privacy_type, creator_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)", name, url, description, privacyType, u.ID, now, now)
	if err != nil {
		return c, err
	}

	insertID, err := result.LastInsertId()
	if err != nil {
		return c, err
	}

	c.FindByID(int(insertID))

	// Add creator as moderator
	_, err = DBConn.Exec("INSERT INTO community_moderators (community_id, user_id, created_at) VALUES (?, ?, ?)", c.ID, u.ID, now)
	if err != nil {
		return c, err
	}

	return c, nil
}

/************************************************/
/********************* READ *********************/
/************************************************/

// FindByID - find a given community in the database by its primary key
func (c *Community) FindByID(id int) error {
	dbCommunity := Community{}
	err := DBConn.Get(&dbCommunity, "SELECT * FROM communities WHERE id = ?", id)
	if err != nil {
		return err
	}

	*c = dbCommunity
	return nil
}

// FindByURL - find a given community in the database by its URL
func (c *Community) FindByURL(url string) error {
	dbCommunity := Community{}
	err := DBConn.Get(&dbCommunity, "SELECT * FROM communities WHERE url = ?", url)
	if err != nil {
		return err
	}

	*c = dbCommunity
	return nil
}

// GetCommunities - get all communities
func GetCommunities() ([]Community, error) {
	communities := []Community{}
	err := DBConn.Select(&communities, "SELECT * FROM communities ORDER BY name ASC")
	if err != nil {
		return communities, err
	}
	return communities, nil
}

// GetSubscribedCommunities - get communities a user is subscribed to
func (u *User) GetSubscribedCommunities() ([]Community, error) {
	communities := []Community{}
	query := `
		SELECT c.* 
		FROM communities c
		JOIN community_subscribers cs ON c.id = cs.community_id
		WHERE cs.user_id = ?
		ORDER BY c.name ASC
	`
	err := DBConn.Select(&communities, query, u.ID)
	if err != nil {
		return communities, err
	}
	return communities, nil
}

// GetModerators - get moderators of a community
func (c *Community) GetModerators() ([]User, error) {
	moderators := []User{}
	query := `
		SELECT u.* 
		FROM users u
		JOIN community_moderators cm ON u.id = cm.user_id
		WHERE cm.community_id = ?
	`
	err := DBConn.Select(&moderators, query, c.ID)
	return moderators, err
}

// GetSubscribers - get users subscribed to a community
func (c *Community) GetSubscribers() ([]User, error) {
	subscribers := []User{}
	query := `
		SELECT u.* 
		FROM users u
		JOIN community_subscribers cs ON u.id = cs.user_id
		WHERE cs.community_id = ?
	`
	err := DBConn.Select(&subscribers, query, c.ID)
	return subscribers, err
}

// GetBannedUsers - get banned users of a community
func (c *Community) GetBannedUsers() ([]User, error) {
	bannedUsers := []User{}
	query := `
		SELECT u.* 
		FROM users u
		JOIN community_banned_users cbu ON u.id = cbu.user_id
		WHERE cbu.community_id = ?
	`
	err := DBConn.Select(&bannedUsers, query, c.ID)
	return bannedUsers, err
}

type CommunityUserFinancials struct {
	UserID   int     `db:"user_id" json:"userID"`
	Username string  `db:"username" json:"username"`
	Amount   float64 `db:"amount" json:"amount"`
}

// GetFinancials - get financial data for the community
func (c *Community) GetFinancials(since time.Time) ([]CommunityUserFinancials, error) {
	financials := []CommunityUserFinancials{}
	query := `
		SELECT u.id as user_id, u.username, SUM(l.amount) as amount
		FROM ledger l
		JOIN users u ON l.author_id = u.id
		WHERE l.community_id = ? AND l.created_at >= ?
		GROUP BY u.id, u.username
		ORDER BY amount DESC
	`
	err := DBConn.Select(&financials, query, c.ID, since)
	return financials, err
}

/************************************************/
/******************** UPDATE ********************/
/************************************************/

// Update - update community details
func (c *Community) Update(name, description, privacyType, postPermission, commentPermission string) error {
	now := time.Now().Format("2006-01-02 15:04:05")
	_, err := DBConn.Exec("UPDATE communities SET name = ?, description = ?, privacy_type = ?, post_permission = ?, comment_permission = ?, updated_at = ? WHERE id = ?", name, description, privacyType, postPermission, commentPermission, now, c.ID)
	return err
}

// Subscribe - subscribe a user to a community
func (c *Community) Subscribe(userID int) error {
	now := time.Now().Format("2006-01-02 15:04:05")
	_, err := DBConn.Exec("INSERT INTO community_subscribers (community_id, user_id, created_at) VALUES (?, ?, ?)", c.ID, userID, now)
	return err
}

// Unsubscribe - unsubscribe a user from a community
func (c *Community) Unsubscribe(userID int) error {
	_, err := DBConn.Exec("DELETE FROM community_subscribers WHERE community_id = ? AND user_id = ?", c.ID, userID)
	return err
}

// BanUser - ban a user from a community
func (c *Community) BanUser(userID int) error {
	now := time.Now().Format("2006-01-02 15:04:05")
	_, err := DBConn.Exec("INSERT INTO community_banned_users (community_id, user_id, created_at) VALUES (?, ?, ?)", c.ID, userID, now)
	return err
}

// UnbanUser - unban a user from a community
func (c *Community) UnbanUser(userID int) error {
	_, err := DBConn.Exec("DELETE FROM community_banned_users WHERE community_id = ? AND user_id = ?", c.ID, userID)
	return err
}

/************************************************/
/******************** DELETE ********************/
/************************************************/

// Delete - delete a community
// TODO: Handle cascading deletes (posts, tags, etc.) or soft delete
