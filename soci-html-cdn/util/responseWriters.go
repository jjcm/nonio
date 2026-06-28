package util

import (
	"fmt"
	"net/http"
	"strings"
)

func setCORSHeaders(w http.ResponseWriter, r *http.Request) {
	origin := r.Header.Get("Origin")
	if isAllowedOrigin(origin) {
		w.Header().Set("Access-Control-Allow-Origin", origin)
	} else {
		w.Header().Set("Access-Control-Allow-Origin", "https://non.io")
	}
	w.Header().Set("Access-Control-Max-Age", "604800")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Accept, Content-Type, Content-Length, Accept-Encoding, Authorization")
}

func isAllowedOrigin(origin string) bool {
	if origin == "" {
		return false
	}
	if origin == "https://non.io" {
		return true
	}
	if strings.HasPrefix(origin, "http://localhost") {
		return true
	}
	return false
}

// SendResponse returns our status along with CORS headers
func SendResponse(w http.ResponseWriter, r *http.Request, url string, statusCode int) {
	setCORSHeaders(w, r)
	w.Header().Set("Content-Type", "text/plain")

	w.WriteHeader(statusCode)
	w.Write([]byte(url))
}

// SendError sends an error message back to the client
func SendError(w http.ResponseWriter, r *http.Request, message string, statusCode int) {
	setCORSHeaders(w, r)
	w.Header().Set("Content-Type", "text/plain")

	fmt.Println(message)

	w.WriteHeader(statusCode)
	w.Write([]byte(message))
}
