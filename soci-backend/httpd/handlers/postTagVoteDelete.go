package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"

	"soci-backend/httpd/utils"
	"soci-backend/models"
)

// RemovePostTagVote - protected http handler
// the user associated with the passed auth token can create a new post-tag
func RemovePostTagVote(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		SendResponse(w, utils.MakeError("you can only POST to the remove post tag vote route"), 405)
		return
	}

	type requestPayload struct {
		PostURL   string `json:"post"`
		TagName   string `json:"tag"`
		Community string `json:"community"`
	}

	var payload requestPayload
	decoder := json.NewDecoder(r.Body)
	decoder.Decode(&payload)

	// get the user id from context
	userID := r.Context().Value("user_id").(int)

	communityID, err := resolveCommunityID(payload.Community)
	if err != nil {
		sendSystemError(w, err)
		return
	}

	// find the structure of user, post, tag with user id, post url and tag name
	user, post, tag, err := findUserPostTag(userID, payload.PostURL, payload.TagName, communityID)
	if err != nil {
		sendSystemError(w, err)
		return
	}

	// check if there is PostTagVote for the user id, post id and tag id
	postTagVote := &models.PostTagVote{}
	if err := postTagVote.FindByUK(post.ID, tag.ID, user.ID); err != nil {
		sendSystemError(w, fmt.Errorf("query post-tag-vote: %v", err))
		return
	}
	// if there is not PostTagVote, just return directly
	if postTagVote.ID == 0 {
		SendResponse(w, true, 200)
		return
	}

	// query the votes with post id and tag id
	votes, err := postTagVote.GetVotesByPostTag(post.ID, tag.ID)
	if err != nil {
		sendSystemError(w, fmt.Errorf("query votes: %v", err))
		return
	}
	// only there is the user's PostTagVote, so it needs to delete the PostTag
	needDelPostTag := false
	if len(votes) == 1 {
		needDelPostTag = true
	}

	// check if this is the only one PostTagVote by user for the specific post
	votes, err = postTagVote.GetVotesByPostUser(post.ID, user.ID)
	if err != nil {
		sendSystemError(w, fmt.Errorf("query votes: %v", err))
		return
	}
	needUpdatePost := false
	if len(votes) == 1 {
		needUpdatePost = true
	}

	// do many database operations with transaction
	if err = models.WithTransaction(func(tx models.Transaction) error {
		// delete the PostTagVote with unique key: user id, post id, tag id
		if err := postTagVote.DeleteByUKWithTx(tx, post.ID, tag.ID, user.ID); err != nil {
			return fmt.Errorf("delete post-tag-vote: %v", err)
		}

		postTag := &models.PostTag{}
		if needDelPostTag {
			// delete the PostTag with unique key: post id, tag id
			if err := postTag.DeleteByUKWithTx(tx, post.ID, tag.ID); err != nil {
				return fmt.Errorf("delete post-tag: %v", err)
			}
		} else {
			// decrement the score of the PostTag with unique key: post id, tag id
			if err := postTag.DecrementScoreWithTx(tx, post.ID, tag.ID); err != nil {
				return fmt.Errorf("delete PostTag's score: %v", err)
			}
		}

		// if it needs to decrement the score of the Post with post id
		if needUpdatePost {
			if err := post.DecrementScoreWithTx(tx, post.ID); err != nil {
				return fmt.Errorf("decrement Post's score: %v", err)
			}
		}

		return nil
	}); err != nil {
		sendSystemError(w, err)
		return
	}

	SendResponse(w, true, 200)
}
