package handlers

import (
	"encoding/json"
	"net/http"
	"soci-backend/httpd/utils"
	"soci-backend/models"
)

// RemoveCommentVote - protected http handler
func RemoveCommentVote(w http.ResponseWriter, r *http.Request) {
	type requestPayload struct {
		ID int `json:"id"`
	}

	if r.Method != "POST" {
		SendResponse(w, utils.MakeError("you can only POST to RemoveCommentVote route"), 405)
		return
	}

	var payload requestPayload
	decoder := json.NewDecoder(r.Body)
	decoder.Decode(&payload)

	u := models.User{}
	u.FindByID(r.Context().Value("user_id").(int))

	if err := u.DeleteCommentVote(payload.ID); err != nil {
		sendSystemError(w, err)
		return
	}

	SendResponse(w, true, 200)
}
