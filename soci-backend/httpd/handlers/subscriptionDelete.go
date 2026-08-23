package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"

	"soci-backend/httpd/utils"
	"soci-backend/models"
)

// DeleteSubscription removes a sub for a tag
func DeleteSubscription(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		SendResponse(w, utils.MakeError("you can only POST to the delete subscription route"), 405)
		return
	}

	type requestPayload struct {
		TagName   string `json:"tag"`
		Community string `json:"community"`
	}

	var payload requestPayload
	decoder := json.NewDecoder(r.Body)
	decoder.Decode(&payload)

	// get the user from context
	user := models.User{}
	user.FindByID(r.Context().Value("user_id").(int))

	communityID, err := resolveCommunityID(payload.Community)
	if err != nil {
		sendNotFound(w, fmt.Errorf("we couldn't find a community matching `%s`", payload.Community))
		return
	}

	// figure out what tag they're trying to remove
	tag := models.Tag{}
	tag.FindByTagName(payload.TagName, communityID)

	if tag.ID == 0 {
		SendResponse(w, utils.MakeError("tag not found"), 404)
		return
	}

	// check if the Subscription exists in the db
	if err := user.DeleteSubscription(tag); err != nil {
		sendSystemError(w, fmt.Errorf("error deleting the subscription: %v", err))
		return
	}

	SendResponse(w, true, 200)
}
