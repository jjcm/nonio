package handlers

import (
	"errors"
	"net/http"
	"soci-backend/httpd/utils"
	"soci-backend/models"
	"strings"
)

// GetTags - get tags out of the database, 100 at a time, optional offset
func GetTags(w http.ResponseWriter, r *http.Request) {
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

	tags, err := models.GetTags(0, 100, communityID)
	if err != nil {
		SendResponse(w, utils.MakeError(err.Error()), 500)
		return
	}

	output := map[string]interface{}{
		"tags": tags,
	}
	SendResponse(w, output, 200)
}

// GetTagsByPrefix - search for tags beginning with a string
func GetTagsByPrefix(w http.ResponseWriter, r *http.Request) {
	prefix := strings.TrimSpace(utils.ParseRouteParameter(r.URL.Path, "/tags/"))
	if prefix == "" {
		GetTags(w, r)
		return
	}

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

	tags, err := models.GetTagsByPrefix(prefix, communityID)
	if err != nil {
		SendResponse(w, utils.MakeError(err.Error()), 500)
		return
	}

	output := map[string]interface{}{
		"tags": tags,
	}
	SendResponse(w, output, 200)
}
