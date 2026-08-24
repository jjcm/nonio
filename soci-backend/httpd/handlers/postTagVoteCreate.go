package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"

	"soci-backend/httpd/utils"
	"soci-backend/models"
)

// AddPostTagVote - protected http handler
// the user associated with the passed auth token can create a new post-tag
func AddPostTagVote(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		SendResponse(w, utils.MakeError("you can only POST to AddPostTagVote route"), 405)
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

	postTag := &models.PostTag{}
	// check if the PostTag exists
	if err := postTag.FindByUK(post.ID, tag.ID); err != nil {
		sendSystemError(w, fmt.Errorf("query post-tag: %v", err))
		return
	}
	// if the PostTag doesn't exist, return an error
	if postTag.ID == 0 {
		sendSystemError(w, fmt.Errorf("PostTag does not exist"))
		return
	}

	// find the PostTagVote by post id, tag id, user id
	postTagVote := &models.PostTagVote{}
	if err := postTagVote.FindByUK(post.ID, tag.ID, user.ID); err != nil {
		sendSystemError(w, fmt.Errorf("query post-tag-vote: %v", err))
		return
	}
	// if there exists vote rows, return directly
	if postTagVote.ID > 0 {
		postTagVote.PostURL = post.URL
		postTagVote.TagName = tag.Name
		postTagVote.VoterName = user.Name

		SendResponse(w, postTagVote, 200)
		return
	}

	// check if this is the first PostTagVote by user for the specific post
	votes, err := postTagVote.GetVotesByPostUser(post.ID, user.ID)
	if err != nil {
		sendSystemError(w, fmt.Errorf("query votes: %v", err))
		return
	}
	needUpdatePost := true
	if len(votes) > 0 {
		needUpdatePost = false
	}

	// prepare the PostTagVote for insertion
	postTagVote.Post = post
	postTagVote.PostID = post.ID
	postTagVote.PostURL = post.URL
	postTagVote.Tag = tag
	postTagVote.TagID = tag.ID
	postTagVote.TagName = tag.Name
	postTagVote.Voter = user
	postTagVote.VoterID = user.ID
	postTagVote.VoterName = user.Name
	postTagVote.CreatorID = post.AuthorID

	if err = models.WithTransaction(func(tx models.Transaction) error {
		// insert the PostTagVote to database
		if err := postTagVote.CreatePostTagVoteWithTx(tx); err != nil {
			return fmt.Errorf("create PostTagVote: %v", err)
		}

		// increment the score for PostTag
		if err := postTag.IncrementScoreWithTx(tx, post.ID, tag.ID); err != nil {
			return fmt.Errorf("increment PostTag's score: %v", err)
		}

		// check if it needs to increment the score of post
		if needUpdatePost {
			// increment the score of Post
			if err := post.IncrementScoreWithTx(tx, post.ID); err != nil {
				return fmt.Errorf("increment Post's score: %v", err)
			}
		}

		return nil
	}); err != nil {
		sendSystemError(w, err)
		return
	}

	SendResponse(w, postTagVote, 200)
}
