package handlers

import (
	"encoding/json"
	"net/http"
	"soci-backend/httpd/utils"
	"soci-backend/models"
)

// NukeUser will remove the user, their comments, their posts, and all associated post tags. This is a destructive action mainly for spam accounts.
func NukeUser(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		SendResponse(w, utils.MakeError("you can only POST to the nuke user route"), 405)
		return
	}

	type requestPayload struct {
		Username *string `json:"username"`
	}

	// ensure the user is an admin
	u := models.User{}
	u.FindByID(r.Context().Value("user_id").(int))
	adminCheck, err := u.IsAdmin()
	if err != nil {
		SendResponse(w, utils.MakeError(err.Error()), 500)
	}

	if !adminCheck {
		SendResponse(w, utils.MakeError("you must be an admin to nuke a user"), 401)
		return
	}

	// parse the request body
	var payload requestPayload
	decoder := json.NewDecoder(r.Body)
	decoder.Decode(&payload)

	// ensure the user exists
	user := models.User{}
	user.FindByUsername(*(payload.Username))
	if user.ID == 0 {
		SendResponse(w, utils.MakeError("user not found"), 404)
		return
	}

	// nuke the user
	if err := user.Nuke(); err != nil {
		SendResponse(w, utils.MakeError(err.Error()), 500)
		return
	}

	SendResponse(w, true, 200)

	// Nuke the cache
	PostCache = make(map[string]PostQueryResponse)
}
