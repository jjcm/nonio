package models

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"time"
)

// Comment - struct representation of a single comment
type Comment struct {
	ID                     int           `db:"id" json:"-"`
	Post                   Post          `db:"-" json:"-"`
	PostID                 int           `db:"post_id" json:"-"`
	PostURL                string        `db:"-" json:"post"`
	PostTitle              string        `db:"-" json:"post_title"`
	CreatedAt              time.Time     `db:"created_at" json:"date"`
	Content                string        `db:"content" json:"content"`
	Edited                 bool          `db:"edited" json:"edited"`
	ParentID               int           `db:"parent_id" json:"-"`
	User                   string        `db:"-" json:"user"`
	Author                 User          `db:"-" json:"-"`
	AuthorID               sql.NullInt32 `db:"author_id" json:"-"`
	Upvotes                int           `db:"upvotes" json:"upvotes"`
	Downvotes              int           `db:"downvotes" json:"downvotes"`
	LineageScore           int           `db:"lineage_score" json:"lineage_score"`
	DescendentCommentCount int           `db:"descendent_comment_count" json:"descendent_comment_count"`
}

type CommentQueryParams struct {
	UserID int
	PostID int
	Offset int
	Sort   string
	Since  string
}

// MarshalJSON custom JSON builder for Comment structs
func (c *Comment) MarshalJSON() ([]byte, error) {
	// populate user if it currently isn't hydrated
	if c.Author.ID == 0 {
		if c.AuthorID.Valid {
			c.Author.FindByID(int(c.AuthorID.Int32))
		} else {
			anonymous := User{}
			anonymous.Username = "Anonymous coward"
			c.Author = anonymous
		}
	}
	if c.Post.ID == 0 {
		c.Post.FindByID(c.PostID)
	}

	// return the custom JSON for this post
	return json.Marshal(&struct {
		ID                     int    `json:"id"`
		Date                   int64  `json:"date"`
		Post                   string `json:"post"`
		PostTitle              string `json:"post_title"`
		Content                string `json:"content"`
		User                   string `json:"user"`
		Upvotes                int    `json:"upvotes"`
		Downvotes              int    `json:"downvotes"`
		Parent                 int    `json:"parent"`
		LineageScore           int    `json:"lineage_score"`
		DescendentCommentCount int    `json:"descendent_comment_count"`
		Edited                 bool   `json:"edited"`
	}{
		ID:                     c.ID,
		Date:                   c.CreatedAt.UnixNano() / int64(time.Millisecond),
		Post:                   c.Post.URL,
		PostTitle:              c.Post.Title,
		Content:                c.Content,
		User:                   c.Author.GetDisplayName(),
		Upvotes:                c.Upvotes,
		Downvotes:              c.Downvotes,
		Parent:                 c.ParentID,
		LineageScore:           c.LineageScore,
		DescendentCommentCount: c.DescendentCommentCount,
		Edited:                 c.Edited,
	})
}

/************************************************/
/******************** CREATE ********************/
/************************************************/

// CreateComment will try and create a comment in the database
func (u *User) CreateComment(post Post, parent *Comment, content string) (Comment, error) {
	c := Comment{}
	now := time.Now().Format("2006-01-02 15:04:05")

	if u.ID == 0 || post.ID == 0 {
		return c, errors.New("can't create a comment for an invalid user or post")
	}

	var commentParentID int
	if parent != nil {
		commentParentID = parent.ID
	}

	var notificationRecepientID int
	if commentParentID != 0 {
		notificationRecepientID = int(parent.AuthorID.Int32)
	} else {
		notificationRecepientID = post.AuthorID
	}

	var insertID int64
	if err := WithTransaction(func(tx Transaction) error {
		// Create the comment, return if there's an error
		result, err := tx.Exec("INSERT INTO comments (author_id, post_id, created_at, content, parent_id) VALUES (?, ?, ?, ?, ?)", u.ID, post.ID, now, content, commentParentID)
		if err != nil {
			return err
		}
		insertID, err = result.LastInsertId()
		if err != nil {
			return err
		}

		_, err = tx.Exec("UPDATE posts set comment_count = comment_count + 1 WHERE id = ?", post.ID)
		if err != nil {
			return err
		}

		if u.ID != notificationRecepientID {
			_, err = tx.Exec("INSERT INTO notifications (user_id, comment_id, created_at) VALUES (?, ?, ?)", notificationRecepientID, insertID, now)
			if err != nil {
				return err
			}
		}

		return nil
	}); err != nil {
		return c, err
	}

	err := c.FindByID(int(insertID))
	return c, err
}

/************************************************/
/********************* READ *********************/
/************************************************/

// FindByID - find a given comment in the database by its primary key
func (c *Comment) FindByID(id int) error {
	dbComment := Comment{}
	if err := DBConn.Get(&dbComment, "SELECT * FROM comments WHERE id = ?", id); err != nil {
		if err == sql.ErrNoRows {
			return nil
		}
		return err
	}

	*c = dbComment
	return nil
}

// GetCommentsByParams - get the posts by parameters
func GetCommentsByParams(params *CommentQueryParams) ([]*Comment, error) {
	args := []interface{}{}

	query := "select * from comments where true"
	if params.Since != "" {
		query = query + " and created_at > ?"
		// time range
		args = append(args, params.Since)
	}

	// user
	if params.UserID > 0 {
		query = query + " and author_id = ?"
		args = append(args, params.UserID)
	}

	// post
	if params.PostID > 0 {
		query = query + " and post_id = ?"
		args = append(args, params.PostID)
	}

	// orders
	if params.Sort == "popular" || params.Sort == "top" {
		query = query + " order by (upvotes - downvotes) desc"
	}
	if params.Sort == "new" {
		query = query + " order by created_at desc"
	}

	// offset
	query = query + " limit 100 offset ?"
	args = append(args, params.Offset)

	comments := []*Comment{}
	// exec the query string
	if err := DBConn.Select(&comments, query, args...); err != nil {
		return nil, err
	}

	return comments, nil
}

/************************************************/
/******************** UPDATE ********************/
/************************************************/

// EditComment edits the content of the comment, and flags it as edited.
func (u *User) EditComment(comment *Comment) error {
	if u.ID == 0 || comment.ID == 0 {
		return errors.New("can't edit a comment for an invalid user or comment")
	}

	// double check we actually own this comment
	var dbComment Comment
	dbComment.FindByID(comment.ID)
	if int(dbComment.AuthorID.Int32) != u.ID {
		return errors.New("can't edit a comment that you don't own")
	}

	edited := false
	var replies int
	// if the comment has replies, or it if was made more than five mintues ago, set edited to be true
	DBConn.Get(&replies, "SELECT COUNT(*) FROM comments WHERE parent_id = ?", comment.ID)
	if replies > 0 {
		edited = true
	}
	if time.Now().Add(time.Minute * -5).After(comment.CreatedAt) {
		edited = true
	}

	_, err := DBConn.Exec("UPDATE comments SET content = ?, edited = ? WHERE id = ?", comment.Content, edited, comment.ID)
	if err != nil {
		return err
	}

	return nil
}

// AddUpvoteWithTx increases the upvotes, and also increases the lineage score of the comment
func (c *Comment) AddUpvoteWithTx(tx Transaction) error {
	if _, err := tx.Exec("update comments set upvotes=upvotes+1 where id = ?", c.ID); err != nil {
		return err
	}
	if err := c.IncrementLineageScoreWithTx(tx); err != nil {
		return err
	}
	return nil
}

// RemoveUpvoteWithTx decreases the upvotes, and also decreases the lineage score of the comment
func (c *Comment) RemoveUpvoteWithTx(tx Transaction) error {
	if _, err := tx.Exec("update comments set upvotes=upvotes-1 where id = ?", c.ID); err != nil {
		return err
	}
	if err := c.DecrementLineageScoreWithTx(tx); err != nil {
		return err
	}
	return nil
}

// IncrementLineageScoreWithTx - increment the lineage score by comment id
func (c *Comment) IncrementLineageScoreWithTx(tx Transaction) error {
	id := c.ID

	for {
		comment := Comment{}
		err := comment.FindByID(id)
		if err != nil {
			return err
		}

		if comment.ID == 0 {
			err = fmt.Errorf("comment does not exist")
			return err
		}

		_, err = tx.Exec("update comments set lineage_score=lineage_score+1 where id = ?", id)
		if err != nil {
			return fmt.Errorf("error incrementing lineage score: %v", err)
		}

		if comment.ParentID == 0 {
			break
		}

		id = comment.ParentID
	}

	return nil
}

// AddDownvoteWithTx increases the downvotes, and also decreases the lineage score of the comment
func (c *Comment) AddDownvoteWithTx(tx Transaction) error {
	if _, err := tx.Exec("update comments set downvotes=downvotes+1 where id = ?", c.ID); err != nil {
		return err
	}
	if err := c.DecrementLineageScoreWithTx(tx); err != nil {
		return err
	}
	return nil
}

// RemoveDownvoteWithTx decreases the downvotes, and also increases the lineage score of the comment
func (c *Comment) RemoveDownvoteWithTx(tx Transaction) error {
	if _, err := tx.Exec("update comments set downvotes=downvotes-1 where id = ?", c.ID); err != nil {
		return err
	}
	if err := c.IncrementLineageScoreWithTx(tx); err != nil {
		return err
	}
	return nil
}

// DecrementLineageScoreWithTx - decrement the lineage score by comment id
func (c *Comment) DecrementLineageScoreWithTx(tx Transaction) error {
	id := c.ID

	for {
		comment := Comment{}
		err := comment.FindByID(id)
		if err != nil {
			return err
		}

		if comment.ID == 0 {
			err = fmt.Errorf("Comment does not exist")
			return err
		}

		_, err = tx.Exec("update comments set lineage_score=lineage_score-1 where id = ?", id)
		if err != nil {
			return fmt.Errorf("error incrementing lineage score: %v", err)
		}

		if comment.ParentID == 0 {
			break
		}

		id = comment.ParentID
	}

	return nil
}

// IncrementDescendentComment - increment the descendent comment count
func (c *Comment) IncrementDescendentComment(id int) error {
	_, err := DBConn.Exec("update comments set descendent_comment_count=descendent_comment_count+1 where id = ?", id)
	return err
}

/************************************************/
/******************** DELETE ********************/
/************************************************/

// AbandonComment removes the user from the comment, but leaves the content
func (u *User) AbandonComment(comment *Comment) error {
	if u.ID == 0 || comment.ID == 0 {
		return errors.New("can't abandon a comment for an invalid user or comment")
	}

	_, err := DBConn.Exec("UPDATE comments SET author_id = NULL WHERE id = ?", comment.ID)
	if err != nil {
		return err
	}

	return nil
}

// DeleteComment removes it from the db
func (u *User) DeleteComment(comment *Comment) error {
	if u.ID == 0 || comment.ID == 0 {
		return errors.New("can't delete a comment for an invalid user or comment")
	}

	if err := WithTransaction(func(tx Transaction) error {
		_, err := tx.Exec("DELETE FROM comments WHERE id = ?", comment.ID)
		if err != nil {
			return err
		}

		_, err = tx.Exec("UPDATE posts set comment_count = comment_count - 1 WHERE id = ?", comment.PostID)
		if err != nil {
			return err
		}

		return nil
	}); err != nil {
		return err
	}

	return nil
}
