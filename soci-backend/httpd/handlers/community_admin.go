package handlers

import (
	"encoding/json"
	"errors"
	"net/http"
	"soci-backend/httpd/utils"
	"soci-backend/models"
	"strings"
	"time"
)

// AddModerator - add a moderator to a community
func AddModerator(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		SendResponse(w, utils.MakeError("you can only POST to this route"), 405)
		return
	}

	type requestPayload struct {
		CommunityURL string `json:"community"`
		Username     string `json:"username"`
	}
	var payload requestPayload
	decoder := json.NewDecoder(r.Body)
	decoder.Decode(&payload)

	c := models.Community{}
	if err := c.FindByURL(payload.CommunityURL); err != nil {
		sendNotFound(w, errors.New("community not found"))
		return
	}

	// Check if requester is a moderator
	requesterID := r.Context().Value("user_id").(int)
	mods, err := c.GetModerators()
	if err != nil {
		sendSystemError(w, err)
		return
	}
	isMod := false
	for _, mod := range mods {
		if mod.ID == requesterID {
			isMod = true
			break
		}
	}
	if !isMod {
		SendResponse(w, utils.MakeError("only moderators can add moderators"), 403)
		return
	}

	newMod := models.User{}
	if err := newMod.FindByUsername(payload.Username); err != nil {
		sendNotFound(w, errors.New("user not found"))
		return
	}

	now := time.Now().Format("2006-01-02 15:04:05")
	_, err = models.DBConn.Exec("INSERT INTO community_moderators (community_id, user_id, created_at) VALUES (?, ?, ?)", c.ID, newMod.ID, now)
	if err != nil {
		sendSystemError(w, err)
		return
	}

	SendResponse(w, true, 200)
}

// RemoveModerator - remove a moderator from a community
func RemoveModerator(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		SendResponse(w, utils.MakeError("you can only POST to this route"), 405)
		return
	}

	type requestPayload struct {
		CommunityURL string `json:"community"`
		Username     string `json:"username"`
	}
	var payload requestPayload
	decoder := json.NewDecoder(r.Body)
	decoder.Decode(&payload)

	c := models.Community{}
	if err := c.FindByURL(payload.CommunityURL); err != nil {
		sendNotFound(w, errors.New("community not found"))
		return
	}

	// Check if requester is a moderator
	requesterID := r.Context().Value("user_id").(int)
	mods, err := c.GetModerators()
	if err != nil {
		sendSystemError(w, err)
		return
	}
	isMod := false
	for _, mod := range mods {
		if mod.ID == requesterID {
			isMod = true
			break
		}
	}
	if !isMod {
		SendResponse(w, utils.MakeError("only moderators can remove moderators"), 403)
		return
	}

	userToRemove := models.User{}
	if err := userToRemove.FindByUsername(payload.Username); err != nil {
		sendNotFound(w, errors.New("user not found"))
		return
	}

	_, err = models.DBConn.Exec("DELETE FROM community_moderators WHERE community_id = ? AND user_id = ?", c.ID, userToRemove.ID)
	if err != nil {
		sendSystemError(w, err)
		return
	}

	SendResponse(w, true, 200)
}

// AddMember - add a member to a community (admin action)
func AddMember(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		SendResponse(w, utils.MakeError("you can only POST to this route"), 405)
		return
	}

	type requestPayload struct {
		CommunityURL string `json:"community"`
		Username     string `json:"username"`
	}
	var payload requestPayload
	decoder := json.NewDecoder(r.Body)
	decoder.Decode(&payload)

	c := models.Community{}
	if err := c.FindByURL(payload.CommunityURL); err != nil {
		sendNotFound(w, errors.New("community not found"))
		return
	}

	// Check if requester is a moderator
	requesterID := r.Context().Value("user_id").(int)
	mods, err := c.GetModerators()
	if err != nil {
		sendSystemError(w, err)
		return
	}
	isMod := false
	for _, mod := range mods {
		if mod.ID == requesterID {
			isMod = true
			break
		}
	}
	if !isMod {
		SendResponse(w, utils.MakeError("only moderators can add members"), 403)
		return
	}

	member := models.User{}
	if err := member.FindByUsername(payload.Username); err != nil {
		sendNotFound(w, errors.New("user not found"))
		return
	}

	if err := c.Subscribe(member.ID); err != nil {
		// Treat duplicate subscriptions as success to keep the action idempotent.
		if !strings.Contains(strings.ToLower(err.Error()), "duplicate") {
			sendSystemError(w, err)
			return
		}
	}

	SendResponse(w, true, 200)
}

// RemoveMember - remove a member from a community (admin action)
func RemoveMember(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		SendResponse(w, utils.MakeError("you can only POST to this route"), 405)
		return
	}

	type requestPayload struct {
		CommunityURL string `json:"community"`
		Username     string `json:"username"`
	}
	var payload requestPayload
	decoder := json.NewDecoder(r.Body)
	decoder.Decode(&payload)

	c := models.Community{}
	if err := c.FindByURL(payload.CommunityURL); err != nil {
		sendNotFound(w, errors.New("community not found"))
		return
	}

	// Check if requester is a moderator
	requesterID := r.Context().Value("user_id").(int)
	mods, err := c.GetModerators()
	if err != nil {
		sendSystemError(w, err)
		return
	}
	isMod := false
	for _, mod := range mods {
		if mod.ID == requesterID {
			isMod = true
			break
		}
	}
	if !isMod {
		SendResponse(w, utils.MakeError("only moderators can remove members"), 403)
		return
	}

	member := models.User{}
	if err := member.FindByUsername(payload.Username); err != nil {
		sendNotFound(w, errors.New("user not found"))
		return
	}

	if err := c.Unsubscribe(member.ID); err != nil {
		sendSystemError(w, err)
		return
	}

	SendResponse(w, true, 200)
}

// UpdateCommunity - update a community
func UpdateCommunity(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		SendResponse(w, utils.MakeError("you can only POST to this route"), 405)
		return
	}

	type requestPayload struct {
		CommunityURL      string `json:"community"`
		Name              string `json:"name"`
		Description       string `json:"description"`
		PrivacyType       string `json:"privacyType"`
		PostPermission    string `json:"postPermission"`
		CommentPermission string `json:"commentPermission"`
	}
	var payload requestPayload
	decoder := json.NewDecoder(r.Body)
	decoder.Decode(&payload)

	c := models.Community{}
	if err := c.FindByURL(payload.CommunityURL); err != nil {
		sendNotFound(w, errors.New("community not found"))
		return
	}

	// Check if requester is a moderator
	requesterID := r.Context().Value("user_id").(int)
	mods, err := c.GetModerators()
	if err != nil {
		sendSystemError(w, err)
		return
	}
	isMod := false
	for _, mod := range mods {
		if mod.ID == requesterID {
			isMod = true
			break
		}
	}
	if !isMod {
		SendResponse(w, utils.MakeError("only moderators can update community settings"), 403)
		return
	}

	if err := c.Update(payload.Name, payload.Description, payload.PrivacyType, payload.PostPermission, payload.CommentPermission); err != nil {
		sendSystemError(w, err)
		return
	}

	SendResponse(w, true, 200)
}

// BanUser - ban a user from a community
func BanUser(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		SendResponse(w, utils.MakeError("you can only POST to this route"), 405)
		return
	}

	type requestPayload struct {
		CommunityURL string `json:"community"`
		Username     string `json:"username"`
	}
	var payload requestPayload
	decoder := json.NewDecoder(r.Body)
	decoder.Decode(&payload)

	c := models.Community{}
	if err := c.FindByURL(payload.CommunityURL); err != nil {
		sendNotFound(w, errors.New("community not found"))
		return
	}

	// Check if requester is a moderator
	requesterID := r.Context().Value("user_id").(int)
	mods, err := c.GetModerators()
	if err != nil {
		sendSystemError(w, err)
		return
	}
	isMod := false
	for _, mod := range mods {
		if mod.ID == requesterID {
			isMod = true
			break
		}
	}
	if !isMod {
		SendResponse(w, utils.MakeError("only moderators can ban users"), 403)
		return
	}

	userToBan := models.User{}
	if err := userToBan.FindByUsername(payload.Username); err != nil {
		sendNotFound(w, errors.New("user not found"))
		return
	}

	if err := c.BanUser(userToBan.ID); err != nil {
		sendSystemError(w, err)
		return
	}

	SendResponse(w, true, 200)
}

// UnbanUser - unban a user from a community
func UnbanUser(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		SendResponse(w, utils.MakeError("you can only POST to this route"), 405)
		return
	}

	type requestPayload struct {
		CommunityURL string `json:"community"`
		Username     string `json:"username"`
	}
	var payload requestPayload
	decoder := json.NewDecoder(r.Body)
	decoder.Decode(&payload)

	c := models.Community{}
	if err := c.FindByURL(payload.CommunityURL); err != nil {
		sendNotFound(w, errors.New("community not found"))
		return
	}

	// Check if requester is a moderator
	requesterID := r.Context().Value("user_id").(int)
	mods, err := c.GetModerators()
	if err != nil {
		sendSystemError(w, err)
		return
	}
	isMod := false
	for _, mod := range mods {
		if mod.ID == requesterID {
			isMod = true
			break
		}
	}
	if !isMod {
		SendResponse(w, utils.MakeError("only moderators can unban users"), 403)
		return
	}

	userToUnban := models.User{}
	if err := userToUnban.FindByUsername(payload.Username); err != nil {
		sendNotFound(w, errors.New("user not found"))
		return
	}

	if err := c.UnbanUser(userToUnban.ID); err != nil {
		sendSystemError(w, err)
		return
	}

	SendResponse(w, true, 200)
}

// GetCommunityUsers - get users (subscribers, banned, moderators) for admin
func GetCommunityUsers(w http.ResponseWriter, r *http.Request) {
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

	// Check if requester is a moderator
	requesterID := r.Context().Value("user_id").(int)
	mods, err := c.GetModerators()
	if err != nil {
		sendSystemError(w, err)
		return
	}
	isMod := false
	for _, mod := range mods {
		if mod.ID == requesterID {
			isMod = true
			break
		}
	}
	if !isMod {
		SendResponse(w, utils.MakeError("only moderators can view user lists"), 403)
		return
	}

	subscribers, err := c.GetSubscribers()
	if err != nil {
		sendSystemError(w, err)
		return
	}

	banned, err := c.GetBannedUsers()
	if err != nil {
		sendSystemError(w, err)
		return
	}

	output := map[string]interface{}{
		"subscribers": subscribers,
		"banned":      banned,
		"moderators":  mods,
	}
	SendResponse(w, output, 200)
}

// GetCommunityFinancials - get financials for admin
func GetCommunityFinancials(w http.ResponseWriter, r *http.Request) {
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

	// Check if requester is a moderator
	requesterID := r.Context().Value("user_id").(int)
	mods, err := c.GetModerators()
	if err != nil {
		sendSystemError(w, err)
		return
	}
	isMod := false
	for _, mod := range mods {
		if mod.ID == requesterID {
			isMod = true
			break
		}
	}
	if !isMod {
		SendResponse(w, utils.MakeError("only moderators can view financials"), 403)
		return
	}

	// Get financials for the current month
	now := time.Now()
	since := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())

	financials, err := c.GetFinancials(since)
	if err != nil {
		sendSystemError(w, err)
		return
	}

	totalEarned := 0.0
	for _, f := range financials {
		totalEarned += f.Amount
	}

	adminPayoutPerAdmin := 0.0
	if len(mods) > 0 {
		adminPayoutPerAdmin = (totalEarned * 0.10) / float64(len(mods))
	}

	output := map[string]interface{}{
		"financials":          financials,
		"totalEarnedThisMonth": totalEarned,
		"adminPayoutPerAdmin": adminPayoutPerAdmin,
	}
	SendResponse(w, output, 200)
}
