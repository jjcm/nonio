package models

import (
	"database/sql"
	"time"
)

// PostTagVote - struct representation of a single post-tag-vote
type PostTagVote struct {
	ID        int       `db:"id" json:"-"`
	Post      *Post     `db:"-" json:"-"`
	PostID    int       `db:"post_id" json:"postID"`
	PostURL   string    `db:"-" json:"-"`
	Tag       *Tag      `db:"-" json:"-"`
	TagName   string    `db:"-" json:"-"`
	TagID     int       `db:"tag_id" json:"tagID"`
	Voter     *User     `db:"-" json:"-"`
	VoterName string    `db:"-" json:"-"`
	VoterID   int       `db:"voter_id" json:"-"`
	Creator   *User     `db:"-" json:"-"`
	CreatorID int       `db:"creator_id" json:"-"`
	Tallied   bool      `db:"tallied" json:"-"`
	CreatedAt time.Time `db:"created_at" json:"-"`
}

/************************************************/
/******************** CREATE ********************/
/************************************************/

// CreatePostTagVote - create the PostTagVote with post and tag information
func (u *User) CreatePostTagVote(postID int, tagID int) error {
	post := &Post{}
	post.FindByID(postID)
	Log.Infof("creating post tag vote for post author %d", post.AuthorID)
	_, err := DBConn.Exec("INSERT INTO posts_tags_votes (post_id, tag_id, voter_id, creator_id) VALUES (?, ?, ?, ?)", postID, tagID, u.ID, post.AuthorID)
	return err
}

// CreatePostTagVote - create the PostTagVote with post and tag information
func (v *PostTagVote) CreatePostTagVote() error {
	post := &Post{}
	post.FindByID(v.PostID)
	// create a new PostTag association
	_, err := DBConn.Exec("INSERT INTO posts_tags_votes (post_id, tag_id, voter_id, creator_id) VALUES (?, ?, ?, ?)", v.PostID, v.TagID, v.VoterID, post.AuthorID)
	return err
}

// CreatePostTagVoteWithTx - create the PostTagVote with post and tag information
func (v *PostTagVote) CreatePostTagVoteWithTx(tx Transaction) error {
	// create a new PostTag association
	_, err := tx.Exec("INSERT INTO posts_tags_votes (post_id, tag_id, voter_id, creator_id) VALUES (?, ?, ?, ?)", v.PostID, v.TagID, v.VoterID, v.CreatorID)
	if err != nil {
		return err
	}
	return nil
}

/************************************************/
/********************* READ *********************/
/************************************************/

// FindByUK - find a given PostTagVote in the database by unique keys
func (v *PostTagVote) FindByID(id int) error {
	dbPostTagVote := PostTagVote{}
	err := DBConn.Get(&dbPostTagVote, "SELECT * FROM posts_tags_votes WHERE id = ?", id)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil
		}
		return err
	}

	*v = dbPostTagVote
	return nil
}

// FindByUK - find a given PostTagVote in the database by unique keys
func (v *PostTagVote) FindByUK(postID int, tagID int, userID int) error {
	dbPostTagVote := PostTagVote{}
	err := DBConn.Get(&dbPostTagVote, "SELECT * FROM posts_tags_votes WHERE post_id = ? and tag_id = ? and voter_id = ?", postID, tagID, userID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil
		}
		return err
	}

	*v = dbPostTagVote
	return nil
}

// TODO - change this to be a user centric version i.e. u.GetVotesForPost
// GetVotesByPostUser - query the rows from posts_tags_votes with post id and user id
func (v *PostTagVote) GetVotesByPostUser(postID int, userID int) ([]PostTagVote, error) {
	votes := []PostTagVote{}

	err := DBConn.Select(&votes, "select * from posts_tags_votes where post_id = ? and voter_id = ?", postID, userID)
	if err == sql.ErrNoRows {
		return votes, nil
	}
	return votes, err
}

// GetUntalliedVotes - query the rows from posts_tags_votes for votes for a specific user that haven't been tallied yet for payout
func (u *User) GetUntalliedVotes(before time.Time) ([]PostTagVote, error) {
	votes := []PostTagVote{}

	timestring := before.UTC().Format("2006-01-02 15:04:05")
	Log.Infof("getting posts before: %s for user %d", timestring, u.ID)
	err := DBConn.Select(&votes, "select * from posts_tags_votes where voter_id = ? AND created_at <= ? AND tallied = ? AND creator_id != ?", u.ID, timestring, 0, u.ID)
	Log.Infof("votes found: %v", len(votes))
	return votes, err
}

// GetUntalliedVotes - returns all untallied votes in the system.
func (v *PostTagVote) GetUntalliedVotes() ([]PostTagVote, error) {
	votes := []PostTagVote{}

	err := DBConn.Select(&votes, "select * from posts_tags_votes where tallied = ?", 0)
	if err == sql.ErrNoRows {
		return votes, nil
	}
	return votes, err
}

// GetVotesByPostTag - query the rows from posts_tags_votes with post id and tag id
func (v *PostTagVote) GetVotesByPostTag(postID int, tagID int) ([]PostTagVote, error) {
	votes := []PostTagVote{}

	err := DBConn.Select(&votes, "select * from posts_tags_votes where post_id = ? and tag_id = ?", postID, tagID)
	if err == sql.ErrNoRows {
		return votes, nil
	}
	return votes, err
}

// GetVotes will return every posttag the user has voted on.
func (u *User) GetVotes() ([]PostTagVote, error) {
	votes := []PostTagVote{}

	// run the correct sql query
	var query = "SELECT * FROM posts_tags_votes WHERE voter_id = ?"
	err := DBConn.Select(&votes, query, u.ID)
	if err != nil {
		return votes, err
	}

	return votes, nil
}

/************************************************/
/******************** UPDATE ********************/
/************************************************/

// MarkVotesAsTallied - Mark all of the votes in an array as being tallied.
func (v *PostTagVote) MarkVotesAsTallied(before time.Time) error {
	_, err := DBConn.Exec("UPDATE posts_tags_votes SET tallied = 1 where created_at < ?", before)
	return err
}

/************************************************/
/******************** DELETE ********************/
/************************************************/

// DeleteByUKWithTx - delete a PostTagVote in the database by unique keys
func (v *PostTagVote) DeleteByUKWithTx(tx Transaction, postID int, tagID int, userID int) error {
	_, err := tx.Exec("delete from posts_tags_votes where post_id = ? and tag_id = ? and voter_id = ?", postID, tagID, userID)
	return err
}
