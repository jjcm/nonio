package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"

	"soci-backend/httpd/utils"
	"soci-backend/models"
)

// find the structure of user, post, tag with user id, post url, tag name from database
func findUserPostTag(userID int, postURL string, tagName string, communityID int) (*models.User, *models.Post, *models.Tag, error) {
	// query the user by user id
	user := models.User{}
	if err := user.FindByID(userID); err != nil {
		return nil, nil, nil, fmt.Errorf("query user: %v", err)
	}

	// query the post by post id
	post := models.Post{}
	if err := post.FindByURL(postURL, communityID); err != nil {
		return nil, nil, nil, fmt.Errorf("query post: %v", err)
	}

	// query the tag by tag id
	communityKey := communityID
	if post.CommunityID != nil {
		communityKey = *post.CommunityID
	}
	tag, err := models.GetOrCreateTag(tagName, user, communityKey)
	if err != nil {
		return nil, nil, nil, fmt.Errorf("resolve tag: %v", err)
	}

	return &user, &post, &tag, nil
}

// CreatePostTag - protected http handler
// the user associated with the passed auth token can create a new post-tag
func CreatePostTag(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		SendResponse(w, utils.MakeError("you can only POST to the CreatePostTag route"), 405)
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
	// check if the PostTag exists in the database
	if err := postTag.FindByUK(post.ID, tag.ID); err != nil {
		sendSystemError(w, fmt.Errorf("query PostTag: %v", err))
		return
	}
	// if the PostTag exists, return error
	if postTag.PostID > 0 {
		sendSystemError(w, fmt.Errorf("postTag exists"))
		return
	}

	postTagVote := &models.PostTagVote{}
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
	postTagVote = &models.PostTagVote{
		Post:      post,
		PostID:    post.ID,
		PostURL:   post.URL,
		Tag:       tag,
		TagID:     tag.ID,
		TagName:   tag.Name,
		Voter:     user,
		VoterID:   user.ID,
		VoterName: user.Name,
	}

	// do many database operations with transaction
	if err = models.WithTransaction(func(tx models.Transaction) error {
		// insert the PostTag to database
		postTag.PostID = post.ID
		postTag.TagID = tag.ID
		if err := postTag.CreatePostTagWithTx(tx); err != nil {
			return fmt.Errorf("create PostTag: %v", err)
		}

		// insert the PostTagVote to database
		if err := postTagVote.CreatePostTagVoteWithTx(tx); err != nil {
			return fmt.Errorf("create PostTagVote: %v", err)
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

	// Nuke the cache
	PostCache = make(map[string]PostQueryResponse)
}
