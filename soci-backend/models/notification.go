package models

import (
	"encoding/json"
	"time"
)

// Notification - code representation of responses to a user's comments or posts
type Notification struct {
	ID        int       `db:"id" json:"-"`
	UserID    int       `db:"user_id" json:"-"`
	Comment   Comment   `db:"-" json:"-"`
	CommentID int       `db:"comment_id" json:"comment_id"`
	Parent    Comment   `db:"-" json:"-"`
	Read      bool      `db:"read" json:"read"`
	CreatedAt time.Time `db:"created_at" json:"-"`
}

// MarshalJSON custom JSON builder for Tag structs
func (n *Notification) MarshalJSON() ([]byte, error) {
	// hydrate the comment
	if n.Comment.ID == 0 {
		n.Comment.FindByID(n.CommentID)
	}

	// hydrate the user
	if n.Comment.Author.ID == 0 {
		n.Comment.Author.FindByID(int(n.Comment.AuthorID.Int32))
	}

	// hydrate the comment's post
	if n.Comment.Post.ID == 0 {
		n.Comment.Post.FindByID(n.Comment.PostID)
	}

	// hydrate the parent comment
	if n.Parent.ID == 0 {
		n.Parent.FindByID(n.Comment.ParentID)
	}

	// return the custom JSON for this post
	return json.Marshal(&struct {
		ID            int    `json:"id"`
		CommentID     int    `json:"comment_id"`
		CommentDate   int64  `json:"date"`
		Post          string `json:"post"`
		PostTitle     string `json:"post_title"`
		PostType      string `json:"post_type"`
		Content       string `json:"content"`
		User          string `json:"user"`
		Upvotes       int    `json:"upvotes"`
		Downvotes     int    `json:"downvotes"`
		Parent        int    `json:"parent"`
		ParentContent string `json:"parent_content"`
		Edited        bool   `json:"edited"`
		Read          bool   `json:"read"`
	}{
		ID:            n.ID,
		CommentID:     n.CommentID,
		CommentDate:   n.CreatedAt.UnixNano() / int64(time.Millisecond),
		Post:          n.Comment.Post.URL,
		PostTitle:     n.Comment.Post.Title,
		PostType:      n.Comment.Post.Type,
		Content:       n.Comment.Content,
		User:          n.Comment.Author.GetDisplayName(),
		Upvotes:       n.Comment.Upvotes,
		Downvotes:     n.Comment.Downvotes,
		Parent:        n.Comment.ParentID,
		ParentContent: n.Parent.Content,
		Edited:        n.Comment.Edited,
		Read:          n.Read,
	})
}

/************************************************/
/******************** CREATE ********************/
/************************************************/

// CreateNotification - create a notification in the database for a comment
func (u *User) CreateNotification(comment Comment) error {
	now := time.Now().Format("2006-01-02 15:04:05")

	_, err := DBConn.Exec("INSERT INTO notifications (comment_id, user_id, created_at) VALUES (?, ?, ?)", comment.ID, u.ID, now)
	if err != nil {
		return err
	}

	return nil
}

/************************************************/
/********************* READ *********************/
/************************************************/

type NotificationQueryParams struct {
	Unread bool
}

// GetNotifications - get all notifications for a user
func (u *User) GetNotifications(params *NotificationQueryParams) ([]Notification, error) {
	notifications := []Notification{}

	// run the correct sql query
	var query = "SELECT * FROM notifications WHERE user_id = ?"
	if params != nil {
		if params.Unread {
			query += " AND `read` = false"
		}
	}

	err := DBConn.Select(&notifications, query, u.ID)
	if err != nil {
		return notifications, err
	}

	return notifications, nil
}

// GetUnreadNotificationCount - get count of all unread notifications for the user
func (u *User) GetUnreadNotificationCount() (int, error) {
	var count int

	// run the correct sql query
	var query = "SELECT count(*) FROM notifications WHERE user_id = ? AND `read` = false"
	err := DBConn.Get(&count, query, u.ID)
	if err != nil {
		return count, err
	}

	return count, nil
}

// FindByID - find a notification by its id
func (n *Notification) FindByID(id int) error {
	err := DBConn.Get(n, "SELECT * FROM notifications WHERE id = ?", id)
	if err != nil {
		return err
	}

	return nil
}

/************************************************/
/******************** UPDATE ********************/
/************************************************/

// MarkRead - mark a notification as read
func (n *Notification) MarkRead() error {
	_, err := DBConn.Exec("UPDATE notifications SET `read` = true WHERE id = ?", n.ID)
	if err != nil {
		return err
	}

	return nil
}
