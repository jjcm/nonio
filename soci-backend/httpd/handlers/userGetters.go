package handlers

import (
	"net/http"
	"strings"

	"soci-backend/httpd/utils"
	"soci-backend/models"
)

// GetTokenDetails This is a protected route. This will only work if you have a
// valid JWT token in the request headers, and if the token is still valid. You
// can use this route to see what is currently stored in a token
func GetTokenDetails(w http.ResponseWriter, r *http.Request) {
	data := map[string]interface{}{
		"email":    r.Context().Value("user_email").(string),
		"username": r.Context().Value("user_username").(string),
		"id":       r.Context().Value("user_id").(int),
	}
	SendResponse(w, data, 200)
}

// GetFinancials gets the current cash and subscription amount for a user.
func GetFinancials(w http.ResponseWriter, r *http.Request) {
	// get the user from context
	user := models.User{}
	user.FindByID(r.Context().Value("user_id").(int))

	financialData, err := user.GetFinancialData()
	if err != nil {
		sendSystemError(w, err)
		return
	}

	SendResponse(w, &financialData, 200)
}

// GetFinancialLedger returns all of the ledger entries for a user
func GetFinancialLedger(w http.ResponseWriter, r *http.Request) {
	// get the user from context
	user := models.User{}
	user.FindByID(r.Context().Value("user_id").(int))

	financialLedger, err := user.GetLedgerEntries()
	if err != nil {
		sendSystemError(w, err)
		return
	}

	SendResponse(w, &financialLedger, 200)
}

// GetUser gets details for a specific user
func GetUser(w http.ResponseWriter, r *http.Request) {
	username := strings.ToLower(utils.ParseRouteParameter(r.URL.Path, "/users/"))
	// get the user from context
	user := models.User{}
	user.FindByUsername(username)

	info, err := user.GetInfo()
	if err != nil {
		sendSystemError(w, err)
		return
	}

	SendResponse(w, &info, 200)
}

// SearchUsers returns usernames that start with the provided query.
func SearchUsers(w http.ResponseWriter, r *http.Request) {
	type result struct {
		Username string `db:"username" json:"username"`
	}

	query := strings.ToLower(strings.TrimSpace(r.FormValue("q")))
	if len(query) < 2 {
		SendResponse(w, map[string]interface{}{"users": []result{}}, 200)
		return
	}

	results := []result{}
	err := models.DBConn.Select(&results, "SELECT username FROM users WHERE LOWER(username) LIKE ? ORDER BY username ASC LIMIT 8", query+"%")
	if err != nil {
		sendSystemError(w, err)
		return
	}

	SendResponse(w, map[string]interface{}{"users": results}, 200)
}
