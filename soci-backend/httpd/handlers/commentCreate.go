package handlers

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"soci-backend/httpd/utils"
	"soci-backend/models"
)

// CommentOnPost will read in the JSON payload to add a comment to a given post
func CommentOnPost(w http.ResponseWriter, r *http.Request) {
	type requestPayload struct {
		PostURL   string `json:"post"`
		Community string `json:"community"`
		Content   string `json:"content"`
		ParentID  *int   `json:"parent"`
	}

	if r.Method != "POST" {
		SendResponse(w, utils.MakeError("you can only POST to the registration route"), 405)
		return
	}

	var payload requestPayload
	decoder := json.NewDecoder(r.Body)
	decoder.Decode(&payload)
	// before we even check for the existance of the related items, let's verify this comment payload is even valid
	if payload.Content == "" {
		sendSystemError(w, errors.New("can not send us an empty comment. `content` key is required"))
	}

	// first, find the post we are commenting on
	communityID, err := resolveCommunityID(payload.Community)
	if err != nil {
		sendSystemError(w, fmt.Errorf("community lookup: %v", err))
		return
	}

	post := models.Post{}
	if err := post.FindByURL(payload.PostURL, communityID); err != nil || post.ID == 0 {
		sendNotFound(w, errors.New("Post with URL '"+payload.PostURL+"' was not found"))
		return
	}

	// second, find the user that is trying to write the post
	u := models.User{}
	u.FindByID(r.Context().Value("user_id").(int))

	// are we commenting on a comment, or directly on the post itself?
	parentComment := models.Comment{}
	if payload.ParentID != nil {
		parentComment.FindByID(*(payload.ParentID))
	}

	comment, err := u.CreateComment(post, &parentComment, payload.Content)
	if err != nil {
		sendSystemError(w, fmt.Errorf("create comment: %v", err))
		return
	}

	// if the parent comment is not nil, increment the descendentCommentCount
	if parentComment.ID > 0 {
		if err := parentComment.IncrementDescendentComment(parentComment.ID); err != nil {
			sendSystemError(w, fmt.Errorf("increment descendent comment: %v", err))
			return
		}
	}

	// status 201 for "created"
	SendResponse(w, &comment, 201)

	// Nuke the cache
	PostCache = make(map[string]PostQueryResponse)
}
