package handlers

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"soci-backend/httpd/utils"
	"soci-backend/models"
)

// CheckIfUsernameIsAvailable - return a boolean value to see if a given username is
// already taken
func CheckIfUsernameIsAvailable(w http.ResponseWriter, r *http.Request) {
	requestedUsername := utils.ParseRouteParameter(r.URL.Path, "/user/username-is-available/")
	if strings.TrimSpace(requestedUsername) == "" {
		sendSystemError(w, errors.New("please pass a valid username for us to get you your requested content"))
		return
	}

	isAvailable, err := models.UsernameIsAvailable(requestedUsername)
	if err != nil {
		sendSystemError(w, err)
		return
	}

	SendResponse(w, isAvailable, 200)
}

// ChangePassword changes the password of the user as long as the checks on the new/old passwords go through
func ChangePassword(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		SendResponse(w, utils.MakeError("you can only POST to the password change route"), 405)
		return
	}

	type requestPayload struct {
		OldPassword     string `json:"oldPassword"`
		NewPassword     string `json:"newPassword"`
		ConfirmPassword string `json:"confirmPassword"`
	}

	var payload requestPayload
	decoder := json.NewDecoder(r.Body)
	decoder.Decode(&payload)

	// get the user from context
	user := models.User{}
	user.FindByID(r.Context().Value("user_id").(int))

	err := user.ChangePassword(payload.OldPassword, payload.NewPassword, payload.ConfirmPassword)
	if err != nil {
		sendSystemError(w, err)
		return
	}

	user.FindByID(r.Context().Value("user_id").(int))

	SendResponse(w, true, 200)
}

// UpdateDescription updates the description for the user
func UpdateDescription(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		SendResponse(w, utils.MakeError("you can only POST to the description update route"), 405)
		return
	}

	type requestPayload struct {
		Description string `json:"description"`
	}

	var payload requestPayload
	decoder := json.NewDecoder(r.Body)
	decoder.Decode(&payload)

	// get the user from context
	user := models.User{}
	user.FindByID(r.Context().Value("user_id").(int))

	err := user.UpdateDescription(payload.Description)
	if err != nil {
		sendSystemError(w, err)
		return
	}

	user.FindByID(r.Context().Value("user_id").(int))

	SendResponse(w, user.Description, 200)
}

func ForgotPasswordRequest(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		SendResponse(w, utils.MakeError("you can only POST to the forgot password request route"), 405)
		return
	}

	type requestPayload struct {
		Email string `json:"email"`
	}

	var payload requestPayload
	decoder := json.NewDecoder(r.Body)
	decoder.Decode(&payload)

	if payload.Email == "" {
		SendResponse(w, utils.MakeError("Email is required to initiate a forgot password request"), 400)
		return
	}

	user := models.User{}
	err := user.ForgotPasswordRequest(payload.Email)
	if err != nil {
		sendSystemError(w, err)
		return
	}

	SendResponse(w, true, 200)
}

// ChangeForgottenPassword changes the password of the user as long as the checks on the new/old passwords go through
func ChangeForgottenPassword(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		SendResponse(w, utils.MakeError("you can only POST to the forgotten password change route"), 405)
		return
	}

	type requestPayload struct {
		Token           string `json:"token"`
		NewPassword     string `json:"newPassword"`
		ConfirmPassword string `json:"confirmPassword"`
	}

	var payload requestPayload
	decoder := json.NewDecoder(r.Body)
	decoder.Decode(&payload)

	user := models.User{}
	err := user.ChangeForgottenPassword(payload.Token, payload.NewPassword, payload.ConfirmPassword)
	if err != nil {
		sendSystemError(w, err)
		return
	}

	SendResponse(w, true, 200)
}

// ChooseFreeAccount sets the account type to free
func ChooseFreeAccount(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		SendResponse(w, utils.MakeError("you can only POST to the choose free account route"), 405)
		return
	}

	// get the user from context
	user := models.User{}
	user.FindByID(r.Context().Value("user_id").(int))

	err := user.UpdateAccountType("free")
	if err != nil {
		sendSystemError(w, err)
		return
	}

	user.FindByID(r.Context().Value("user_id").(int))

	SendResponse(w, true, 200)
}
