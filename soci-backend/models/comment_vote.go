package models

import (
	"database/sql"
	"fmt"
	"time"
)

// CommentVote - struct representation of a comment vote
type CommentVote struct {
	ID        int       `db:"id" json:"-"`
	Comment   *Comment  `db:"-" json:"-"`
	CommentID int       `db:"comment_id" json:"comment_id"`
	Voter     *User     `db:"-" json:"-"`
	VoterName string    `db:"-" json:"-"`
	VoterID   int       `db:"voter_id" json:"-"`
	Upvote    bool      `db:"upvote" json:"upvote"`
	Post      *Post     `db:"-" json:"-"`
	PostID    int       `db:"post_id" json:"-"`
	PostURL   string    `db:"-" json:"-"`
	CreatedAt time.Time `db:"created_at" json:"-"`
}

type CommentVoteQueryParams struct {
	UserID int
	PostID int
}

/************************************************/
/******************** CREATE ********************/
/************************************************/

// CreateCommentVote adds a vote for the user for a comment. It will change the lineage score for the comment and its ancestors.
func (u *User) CreateCommentVote(commentID int, upvote bool) error {
	vote := CommentVote{}
	// Check if a vote already exists
	vote.FindByUK(commentID, u.ID)
	if vote.ID != 0 {
		// The vote exists, so we need to update the existing one
		return u.UpdateCommentVote(commentID, upvote)
	} else {
		// The comment vote doesn't yet exist, so we need to create it.

		// Find the comment we're voting on
		comment := Comment{}
		if err := comment.FindByID(commentID); comment.ID == 0 {
			// Comment does not exist, so throw an error
			return fmt.Errorf("Comment does not exist: %v", err)
		}

		if err := WithTransaction(func(tx Transaction) error {
			// Create the comment vote, return if there's an error
			if _, err := tx.Exec("INSERT INTO comment_votes (comment_id, voter_id, upvote, post_id) VALUES (?, ?, ?, ?)", commentID, u.ID, upvote, comment.PostID); err != nil {
				return err
			}

			if upvote {
				// The comment vote is an upvote
				if err := comment.AddUpvoteWithTx(tx); err != nil {
					return err
				}
			} else {
				// The comment vote is a downvote
				if err := comment.AddDownvoteWithTx(tx); err != nil {
					return err
				}
			}

			return nil
		}); err != nil {
			return err
		}
	}

	return nil
}

/************************************************/
/********************* READ *********************/
/************************************************/

// FindByID - find a given CommentVote in the database by ID
func (v *CommentVote) FindByID(id int) error {
	dbCommentVote := CommentVote{}
	err := DBConn.Get(&dbCommentVote, "SELECT * FROM comment_votes WHERE id = ?", id)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil
		}
		return err
	}

	*v = dbCommentVote
	return nil
}

// FindByUK - find a given CommentVote in the database by unique keys
func (v *CommentVote) FindByUK(commentID int, userID int) error {
	dbCommentVote := CommentVote{}
	err := DBConn.Get(&dbCommentVote, "SELECT * FROM comment_votes WHERE voter_id = ? AND comment_id = ?", userID, commentID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil
		}
		return err
	}

	*v = dbCommentVote
	return nil
}

// GetCommentVotesForPost will return every comment the user has voted on for a specific post
func (u *User) GetCommentVotesForPost(postID int) ([]CommentVote, error) {
	votes := []CommentVote{}

	err := DBConn.Select(&votes, "SELECT * FROM comment_votes WHERE voter_id = ? AND post_id = ?", u.ID, postID)
	if err != nil {
		return votes, err
	}

	return votes, nil
}

// GetCommentVotesByParams - get the comment votes by parameters
func GetCommentVotesByParams(user *User, params *CommentVoteQueryParams) ([]*CommentVote, error) {
	args := []interface{}{}

	var query string
	args = append(args, user.ID)

	// user
	if params.UserID > 0 {
		query = "select comment_id, upvote from comment_votes INNER JOIN comments ON comment_votes.comment_id = comments.id where voter_id = ? and author_id = ?"
		args = append(args, params.UserID)
	} else {
		query = "select comment_id, upvote from comment_votes where voter_id = ?"
	}

	// post
	if params.PostID > 0 {
		query = query + " and comment_votes.post_id = ?"
		args = append(args, params.PostID)
	}

	commentVotes := []*CommentVote{}
	// exec the query string
	if err := DBConn.Select(&commentVotes, query, args...); err != nil {
		return nil, err
	}

	return commentVotes, nil
}

/************************************************/
/******************** UPDATE ********************/
/************************************************/
func (u *User) UpdateCommentVote(commentID int, upvote bool) error {
	// Select the comment vote
	vote := CommentVote{}
	vote.FindByUK(commentID, u.ID)

	comment := Comment{}
	comment.FindByID(commentID)

	if vote.ID != 0 {
		if vote.Upvote == upvote {
			// it's the same type of vote, so we don't need to do anything
			return nil
		} else {
			if err := WithTransaction(func(tx Transaction) error {
				// the vote is different, so lets change the vote first then update the lineage score
				if _, err := tx.Exec("update comment_votes set upvote = ? where comment_id = ? and voter_id = ?", upvote, commentID, u.ID); err != nil {
					return err
				}

				if upvote {
					// we're upvoting the comment, so we need to remove the downvote and add an upvote
					if err := comment.RemoveDownvoteWithTx(tx); err != nil {
						return err
					}
					if err := comment.AddUpvoteWithTx(tx); err != nil {
						return err
					}
				} else {
					// we're downvoting the comment, so we need to remove the upvote and add a downvote
					if err := comment.RemoveUpvoteWithTx(tx); err != nil {
						return err
					}
					if err := comment.AddDownvoteWithTx(tx); err != nil {
						return err
					}
				}

				return nil
			}); err != nil {
				return err
			}
		}
	} else {
		return fmt.Errorf("vote for comment not found. Comment ID: %v, User ID: %v", commentID, u.ID)
	}

	return nil
}

/************************************************/
/******************** DELETE ********************/
/************************************************/

// RemoveVote removes a user's vote on a comment, if it exists, via a transaction. It will change the lineage score for the comment and its ancestors.
func (u *User) DeleteCommentVote(commentID int) error {
	// Select the comment vote
	commentVote := CommentVote{}
	commentVote.FindByUK(commentID, u.ID)

	comment := Comment{}
	comment.FindByID(commentID)

	if err := WithTransaction(func(tx Transaction) error {
		if commentVote.Upvote {
			// The comment vote is an upvote
			if err := comment.RemoveUpvoteWithTx(tx); err != nil {
				return err
			}
		} else {
			// The comment vote is a downvote
			if err := comment.RemoveDownvoteWithTx(tx); err != nil {
				return err
			}
		}

		// Then delete the comment vote
		if _, err := tx.Exec("delete from comment_votes where comment_id = ? and voter_id = ?", commentID, u.ID); err != nil {
			return err
		}

		return nil
	}); err != nil {
		return err
	}

	return nil
}
