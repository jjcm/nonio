package util

import (
	"fmt"
	"net/http"
)

// SendResponse returns our status along with our proper non-corsy headers
func SendResponse(w http.ResponseWriter, url string, statusCode int) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Content-Type", "text/plain")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Accept, Content-Type, Content-Length, Accept-Encoding, Authorization")

	w.WriteHeader(statusCode)
	w.Write([]byte(url))
}

// SendError sends an error message back to the client
func SendError(w http.ResponseWriter, message string, statusCode int) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Content-Type", "text/plain")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Accept, Content-Type, Content-Length, Accept-Encoding, Authorization")

	fmt.Println(message)

	w.WriteHeader(statusCode)
	w.Write([]byte(message))
}
