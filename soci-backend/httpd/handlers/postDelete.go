package handlers

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"soci-backend/httpd/utils"
	"soci-backend/models"
)

// DeletePost will delete the post matching the URL submitted
func DeletePost(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		SendResponse(w, utils.MakeError("you can only POST to the delete post route"), 405)
		return
	}

	type requestPayload struct {
		URL       *string `json:"url"`
		Community string  `json:"community"`
	}

	var payload requestPayload
	decoder := json.NewDecoder(r.Body)
	decoder.Decode(&payload)

	// Verify the payload is valid
	if payload.URL == nil || *payload.URL == "" {
		sendSystemError(w, errors.New("deleting a post requires the `url` of the post to be present"))
		return
	}

	// Find the user making the request
	u := models.User{}
	u.FindByID(r.Context().Value("user_id").(int))

	// Check if user is admin
	isAdmin, err := u.IsAdmin()
	if err != nil {
		sendSystemError(w, fmt.Errorf("error checking admin status: %v", err))
		return
	}

	communityID, err := resolveCommunityID(payload.Community)
	if err != nil {
		sendSystemError(w, fmt.Errorf("community lookup: %v", err))
		return
	}

	// Find the post
	post := models.Post{}
	err = post.FindByURL(*payload.URL, communityID)
	if err != nil {
		sendNotFound(w, errors.New("post not found"))
		return
	}

	// Verify the user is the owner or an admin
	isMod := false
	if post.CommunityID != nil && *post.CommunityID > 0 {
		c := models.Community{}
		c.FindByID(*post.CommunityID)
		mods, _ := c.GetModerators()
		for _, mod := range mods {
			if mod.ID == u.ID {
				isMod = true
				break
			}
		}
	}

	if post.AuthorID != u.ID && !isAdmin && !isMod {
		SendResponse(w, utils.MakeError("you can only delete posts you own or moderate"), 401)
		return
	}

	// Delete the post
	err = post.DeletePost()
	if err != nil {
		sendSystemError(w, fmt.Errorf("delete post: %v", err))
		return
	}

	// Clear the cache
	PostCache = make(map[string]PostQueryResponse)

	SendResponse(w, true, 200)
}
