package handlers

import (
	"errors"
	"net/http"
	"strings"

	"soci-backend/httpd/utils"
	"soci-backend/models"
)

// GetSubscriptions - gets a user's posttagvotes.
func GetSubscriptions(w http.ResponseWriter, r *http.Request) {
	u := models.User{}
	u.FindByID(r.Context().Value("user_id").(int))

	communitySlug := strings.TrimSpace(r.FormValue("community"))
	communityID := 0
	if communitySlug != "" {
		id, err := resolveCommunityID(communitySlug)
		if err != nil {
			sendNotFound(w, errors.New("we couldn't find a community matching `"+communitySlug+"`"))
			return
		}
		communityID = id
	}

	subscriptions, err := u.GetSubscriptions(communityID)
	if err != nil {
		SendResponse(w, utils.MakeError(err.Error()), 500)
		return
	}

	output := map[string]interface{}{
		"subscriptions": subscriptions,
	}
	SendResponse(w, output, 200)
}
