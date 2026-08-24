package handlers

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"soci-backend/httpd/utils"
	"soci-backend/models"
)

// AbandonComment will remove the user from the comment, but leave the content
func AbandonComment(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		SendResponse(w, utils.MakeError("you can only POST to the abandon comment route"), 405)
		return
	}

	type requestPayload struct {
		ID *int `json:"id"`
	}

	var payload requestPayload
	decoder := json.NewDecoder(r.Body)
	decoder.Decode(&payload)

	// before we even check for the existance of the related items, let's verify this comment payload is even valid
	if payload.ID == nil {
		sendSystemError(w, errors.New("abandoning a comment requires the `id` of the comment to be present"))
		return
	}

	// second, find the user that is trying to write the post
	u := models.User{}
	u.FindByID(r.Context().Value("user_id").(int))

	// make sure the comment we're abandoning exists
	comment := models.Comment{}
	comment.FindByID(*(payload.ID))

	// make sure the owner of the comment is the user who's making the request
	if int(comment.AuthorID.Int32) != u.ID {
		SendResponse(w, utils.MakeError("you can only delete comments you own"), 401)
		return
	}

	err := u.AbandonComment(&comment)
	if err != nil {
		sendSystemError(w, fmt.Errorf("abandon comment: %v", err))
		return
	}

	SendResponse(w, true, 200)
}
