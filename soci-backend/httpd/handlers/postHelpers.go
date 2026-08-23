package handlers

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"soci-backend/httpd/utils"
	"soci-backend/models"
)

// CheckIfURLIsAvailable - return a boolean value to see if a given URL is
// already taken
func CheckIfURLIsAvailable(w http.ResponseWriter, r *http.Request) {
	requestedURL := utils.ParseRouteParameter(r.URL.Path, "/post/url-is-available/")
	if strings.TrimSpace(requestedURL) == "" {
		sendSystemError(w, errors.New("please pass a valid URL for us to get you your requested content"))
		return
	}

	communitySlug := strings.TrimSpace(r.URL.Query().Get("community"))
	communityID, err := resolveCommunityID(communitySlug)
	if err != nil {
		sendSystemError(w, err)
		return
	}

	Log.Info("Checking if URL is available: " + requestedURL)
	isAvailable, err := models.URLIsAvailable(requestedURL, communityID)
	if err != nil {
		sendSystemError(w, err)
		return
	}

	SendResponse(w, isAvailable, 200)
}

// resolveCommunity takes a community slug (with or without @ prefix) and returns:
// - the Community (nil for root/frontpage)
// - the normalized slug (without @, trimmed)
func resolveCommunity(communitySlug string) (*models.Community, string, error) {
	trimmed := strings.TrimSpace(communitySlug)
	if trimmed == "" {
		return nil, "", nil
	}

	if trimmed[0] == '@' {
		trimmed = trimmed[1:]
	}

	c := models.Community{}
	if err := c.FindByURL(trimmed); err != nil {
		return nil, trimmed, err
	}

	return &c, trimmed, nil
}

// resolveCommunityID takes a community slug (with or without @ prefix) and returns its ID.
// An empty slug represents the root/frontpage and returns 0.
func resolveCommunityID(communitySlug string) (int, error) {
	c, _, err := resolveCommunity(communitySlug)
	if err != nil {
		return 0, err
	}
	if c == nil {
		return 0, nil
	}
	return c.ID, nil
}

// parseCommunityAndSlug parses a path like "/posts/@community/slug" or "/posts/slug"
// into its community slug (without @) and post slug.
func parseCommunityAndSlug(path string, prefix string) (string, string) {
	trimmed := utils.ParseRouteParameter(path, prefix)
	parts := strings.SplitN(trimmed, "/", 2)

	if len(parts) == 2 && strings.HasPrefix(parts[0], "@") {
		return strings.TrimPrefix(parts[0], "@"), parts[1]
	}

	return "", trimmed
}

func CheckExternalURLTitle(w http.ResponseWriter, r *http.Request) {
	type requestPayload struct {
		URL string `json:"url"`
	}

	if r.Method != "POST" {
		SendResponse(w, utils.MakeError("you can only POST to the check external url route"), 405)
		return
	}

	var payload requestPayload
	decoder := json.NewDecoder(r.Body)
	decoder.Decode(&payload)
	if payload.URL == "" {
		sendSystemError(w, errors.New("`url` cannot be empty"))
	}

	title, err := models.ParseExternalURL(strings.TrimSpace(payload.URL))
	if err != nil {
		sendSystemError(w, err)
		return
	}

	SendResponse(w, title, 200)
}
