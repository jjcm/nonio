package handlers

import (
	"encoding/json"
	"errors"
	"net/http"
	"soci-backend/httpd/utils"
	"soci-backend/models"
	"strings"
)

// CreateCommunity - create a new community
func CreateCommunity(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		SendResponse(w, utils.MakeError("you can only POST to the community creation route"), 405)
		return
	}

	type requestPayload struct {
		Name        string `json:"name"`
		URL         string `json:"url"`
		Description string `json:"description"`
		PrivacyType string `json:"privacyType"`
	}

	var payload requestPayload
	decoder := json.NewDecoder(r.Body)
	decoder.Decode(&payload)

	u := models.User{}
	u.FindByID(r.Context().Value("user_id").(int))

	// Check if user can create community (maybe limit to subscribers?)
	// For now, let's assume any logged in user can create one.

	newCommunity, err := u.CreateCommunity(payload.Name, payload.URL, payload.Description, payload.PrivacyType)
	if err != nil {
		sendSystemError(w, err)
		return
	}

	SendResponse(w, &newCommunity, 200)
}

// GetCommunity - get a community by URL
func GetCommunity(w http.ResponseWriter, r *http.Request) {
	url := utils.ParseRouteParameter(r.URL.Path, "/communities/")
	if strings.TrimSpace(url) == "" {
		// If no specific community, list all?
		// Or maybe we have a separate handler for listing.
		// For now, let's return error if no URL.
		sendSystemError(w, errors.New("please pass a valid URL"))
		return
	}

	c := models.Community{}
	err := c.FindByURL(url)
	if err != nil {
		sendNotFound(w, errors.New("community not found"))
		return
	}

	userID := r.Context().Value("user_id")
	isAdmin := false
	if userID != nil {
		// Check if moderator
		mods, _ := c.GetModerators()
		for _, mod := range mods {
			if mod.ID == userID.(int) {
				isAdmin = true
				break
			}
		}
	}

	if c.PrivacyType == "invite-only" {
		if userID == nil {
			SendResponse(w, utils.MakeError("this community is invite-only"), 403)
			return
		}

		u := models.User{}
		u.FindByID(userID.(int))

		// Check if site admin
		isSiteAdmin, _ := u.IsAdmin()
		if isSiteAdmin || isAdmin {
			// Convert to map for response
			response := make(map[string]interface{})
			jsonBytes, _ := json.Marshal(c)
			json.Unmarshal(jsonBytes, &response)
			response["isAdmin"] = isAdmin
			SendResponse(w, response, 200)
			return
		}

		// Check if subscribed
		subs, _ := u.GetSubscribedCommunities()
		isSubscribed := false
		for _, sub := range subs {
			if sub.ID == c.ID {
				isSubscribed = true
				break
			}
		}

		if !isSubscribed {
			SendResponse(w, utils.MakeError("this community is invite-only"), 403)
			return
		}
	}

	// Convert to map for response
	response := make(map[string]interface{})
	jsonBytes, _ := json.Marshal(c)
	json.Unmarshal(jsonBytes, &response)
	response["isAdmin"] = isAdmin

	SendResponse(w, response, 200)
}

// GetCommunities - get all communities
func GetCommunities(w http.ResponseWriter, r *http.Request) {
	communities, err := models.GetCommunities()
	if err != nil {
		sendSystemError(w, err)
		return
	}

	output := map[string]interface{}{
		"communities": communities,
	}
	SendResponse(w, output, 200)
}

// GetSubscribedCommunities - get communities user is subscribed to
func GetSubscribedCommunities(w http.ResponseWriter, r *http.Request) {
	u := models.User{}
	u.FindByID(r.Context().Value("user_id").(int))

	communities, err := u.GetSubscribedCommunities()
	if err != nil {
		sendSystemError(w, err)
		return
	}

	output := map[string]interface{}{
		"communities": communities,
	}
	SendResponse(w, output, 200)
}

// SubscribeToCommunity - subscribe to a community
func SubscribeToCommunity(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		SendResponse(w, utils.MakeError("you can only POST to this route"), 405)
		return
	}

	type requestPayload struct {
		CommunityURL string `json:"community"`
	}
	var payload requestPayload
	decoder := json.NewDecoder(r.Body)
	decoder.Decode(&payload)

	c := models.Community{}
	if err := c.FindByURL(payload.CommunityURL); err != nil {
		sendNotFound(w, errors.New("community not found"))
		return
	}

	userID := r.Context().Value("user_id").(int)
	if err := c.Subscribe(userID); err != nil {
		sendSystemError(w, err)
		return
	}

	SendResponse(w, true, 200)
}

// UnsubscribeFromCommunity - unsubscribe from a community
func UnsubscribeFromCommunity(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		SendResponse(w, utils.MakeError("you can only POST to this route"), 405)
		return
	}

	type requestPayload struct {
		CommunityURL string `json:"community"`
	}
	var payload requestPayload
	decoder := json.NewDecoder(r.Body)
	decoder.Decode(&payload)

	c := models.Community{}
	if err := c.FindByURL(payload.CommunityURL); err != nil {
		sendNotFound(w, errors.New("community not found"))
		return
	}

	userID := r.Context().Value("user_id").(int)
	if err := c.Unsubscribe(userID); err != nil {
		sendSystemError(w, err)
		return
	}

	SendResponse(w, true, 200)
}

// GetModerators - get moderators of a community
func GetModerators(w http.ResponseWriter, r *http.Request) {
	communityURL := strings.TrimSpace(r.FormValue("community"))
	if communityURL == "" {
		sendSystemError(w, errors.New("please pass a community url"))
		return
	}

	c := models.Community{}
	err := c.FindByURL(communityURL)
	if err != nil {
		sendNotFound(w, errors.New("community not found"))
		return
	}

	moderators, err := c.GetModerators()
	if err != nil {
		sendSystemError(w, err)
		return
	}

	output := map[string]interface{}{
		"moderators": moderators,
	}
	SendResponse(w, output, 200)
}
