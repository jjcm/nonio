package handlers

import "net/http"

// Home This handler func is just kind of a dummy route to return a generic
// response when someone hits the root domain
func Home(w http.ResponseWriter, r *http.Request) {
	response := map[string]string{
		"status":  "success",
		"message": "welcome to SOCI v0.1!",
	}
	SendResponse(w, response, 200)
}
