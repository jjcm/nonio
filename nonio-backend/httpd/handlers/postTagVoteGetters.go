package handlers

import (
	"net/http"

	"nonio-backend/httpd/utils"
	"nonio-backend/models"
)

// GetVotes - gets a user's posttagvotes.
func GetVotes(w http.ResponseWriter, r *http.Request) {
	u := models.User{}
	u.FindByID(r.Context().Value("user_id").(int))

	votes, err := u.GetVotes()
	if err != nil {
		SendResponse(w, utils.MakeError(err.Error()), 500)
		return
	}

	output := map[string]interface{}{
		"votes": votes,
	}
	SendResponse(w, output, 200)
}
