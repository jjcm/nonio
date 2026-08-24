package handlers

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"soci-backend/httpd/utils"
	"soci-backend/models"
)

// EditComment will remove the user from the comment, but leave the content
func EditComment(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		SendResponse(w, utils.MakeError("you can only POST to the edit comment route"), 405)
		return
	}

	type requestPayload struct {
		ID      *int   `json:"id"`
		Content string `json:"content"`
	}

	var payload requestPayload
	decoder := json.NewDecoder(r.Body)
	decoder.Decode(&payload)

	// before we even check for the existance of the related items, let's verify this comment payload is even valid
	if payload.ID == nil {
		sendSystemError(w, errors.New("editing a comment requires the `id` of the comment to be present"))
		return
	}
	if payload.Content == "" {
		sendSystemError(w, errors.New("editing a comment requires the content of the comment to be present"))
		return
	}

	// second, find the user that is trying to write the post
	u := models.User{}
	u.FindByID(r.Context().Value("user_id").(int))

	// make sure the comment we're editing exists
	comment := models.Comment{}
	comment.FindByID(*(payload.ID))
	if comment.ID == 0 {
		sendSystemError(w, errors.New("comment doesn't exist or can't be found"))
		return
	}
	comment.Content = payload.Content

	err := u.EditComment(&comment)
	if err != nil {
		sendSystemError(w, fmt.Errorf("edit comment: %v", err))
		return
	}

	SendResponse(w, true, 200)
}
