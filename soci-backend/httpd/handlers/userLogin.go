package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"

	"soci-backend/httpd/utils"
	"soci-backend/models"

	"github.com/dgrijalva/jwt-go"
)

// Login try and log a user in, if successful generate a JWT token and return that
func Login(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		SendResponse(w, utils.MakeError("You can only POST to the login route"), 405)
		return
	}

	requestUser := models.User{}
	decoder := json.NewDecoder(r.Body)
	decoder.Decode(&requestUser)
	if requestUser.Email == "" {
		SendResponse(w, utils.MakeError("both password and email are required"), 400)
		return
	}

	u := models.User{}
	err := u.FindByEmail(requestUser.Email)
	if err != nil {
		sendNotFound(w, err)
		return
	}

	err = u.Login(requestUser.Password)
	if err != nil {
		sendNotFound(w, err)
		return
	}

	// Generate an access token valid for 1 week
	accessToken, err := utils.TokenCreator(u.Email, 24*7, "access")
	if err != nil {
		SendResponse(w, utils.MakeError("there was an error signing your JWT token: "+err.Error()), 500)
		return
	}

	// Generate a refresh token valid for 2 months
	refreshToken, err := utils.TokenCreator(u.Email, 24*7*60, "refresh")
	if err != nil {
		SendResponse(w, utils.MakeError("there was an error signing your JWT token: "+err.Error()), 500)
		return
	}

	roles, err := u.GetRoles()
	if err != nil {
		SendResponse(w, utils.MakeError("there was an error getting your roles: "+err.Error()), 500)
		return
	}

	response := map[string]interface{}{
		"accessToken":  accessToken,
		"refreshToken": refreshToken,
		"username":     u.Username,
		"roles":        roles,
	}

	SendResponse(w, response, 200)
}

// RefreshAccessToken function
func RefreshAccessToken(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		SendResponse(w, utils.MakeError("You can only POST to the login route"), 405)
		return
	}

	type requestPayload struct {
		RefreshToken string `json:"refreshToken"`
	}

	var payload requestPayload
	decoder := json.NewDecoder(r.Body)
	decoder.Decode(&payload)

	Log.Info("refresh token: ", payload.RefreshToken)

	if payload.RefreshToken == "" {
		SendResponse(w, utils.MakeError("Refresh token is required"), 400)
		return
	}

	// Parse and validate the refresh token
	token, err := jwt.Parse(payload.RefreshToken, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return utils.HmacSampleSecret, nil
	})

	if err != nil {
		SendResponse(w, utils.MakeError("Invalid refresh token"), 500)
		return
	}

	if claims, ok := token.Claims.(jwt.MapClaims); ok && token.Valid {
		// Check if the token type is "refresh"
		if claims["type"] != "refresh" {
			SendResponse(w, utils.MakeError("Invalid token type"), 400)
			return
		}

		u := models.User{}
		err = u.FindByEmail(claims["email"].(string))
		if err != nil {
			sendNotFound(w, err)
			return
		}

		// Generate an access token valid for 1 week
		newAccessToken, err := utils.TokenCreator(u.Email, 24*7, "access")
		if err != nil {
			SendResponse(w, utils.MakeError("there was an error signing your JWT token: "+err.Error()), 500)
			return
		}

		// TODO - we should track and validate the refresh tokens, and invalidate any refresh token that's been used already.
		// Generate a new refresh token valid for 2 mo
		newRefreshToken, err := utils.TokenCreator(u.Email, 24*7*60, "refresh")
		if err != nil {
			SendResponse(w, utils.MakeError("there was an error signing your JWT token: "+err.Error()), 500)
			return
		}

		// Send the new access token to the client
		response := map[string]interface{}{
			"accessToken":  newAccessToken,
			"refreshToken": newRefreshToken,
		}

		SendResponse(w, response, 200)

	} else {
		SendResponse(w, utils.MakeError("Invalid refresh token"), 400)
	}
}
