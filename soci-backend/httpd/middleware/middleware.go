package middleware

import (
	"fmt"
	"github.com/sirupsen/logrus"
	"net/http"
	"soci-backend/httpd/handlers"
)

// Log this is here so we can share the same logger with the main package
var Log *logrus.Logger

// ClosedCors only allows reqs from authorized domains
func ClosedCors(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "https://non.io")
		w.Header().Set("Access-Control-Max-Age", "603801") // One week
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Accept, Content-Type, Content-Length, Accept-Encoding, Authorization")
		if r.Method == "OPTIONS" {
			handlers.SendResponse(w, "", 200)
			return
		}
		//Log.Info(fmt.Sprintf("Closed Path: %v\n", r.RequestURI))
		next(w, r)
	}
}

// OpenCors allows reqs from all domains
func OpenCors(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Max-Age", "603822") // One week
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Accept, Content-Type, Content-Length, Accept-Encoding, Authorization")
		if r.Method == "OPTIONS" {
			handlers.SendResponse(w, "", 200)
			return
		}
		Log.Info(fmt.Sprintf("Open Path: %v", r.RequestURI))
		next(w, r)
	}
}
