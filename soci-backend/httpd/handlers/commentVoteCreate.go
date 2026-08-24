package handlers

import (
	"encoding/json"
	"net/http"
	"soci-backend/httpd/utils"
	"soci-backend/models"
)

// AddCommentVote - protected http handler
func AddCommentVote(w http.ResponseWriter, r *http.Request) {
	type requestPayload struct {
		ID     int  `json:"id"`
		Upvote bool `json:"upvoted"`
	}

	if r.Method != "POST" {
		SendResponse(w, utils.MakeError("you can only POST to AddCommentVote route"), 405)
		return
	}

	// decode the request parameters
	var payload requestPayload
	decoder := json.NewDecoder(r.Body)
	decoder.Decode(&payload)

	u := models.User{}
	u.FindByID(r.Context().Value("user_id").(int))

	if err := u.CreateCommentVote(payload.ID, payload.Upvote); err != nil {
		sendSystemError(w, err)
		return
	}

	SendResponse(w, true, 200)
}
