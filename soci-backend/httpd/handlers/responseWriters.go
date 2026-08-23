package handlers

import (
	"encoding/json"
	"net/http"
)

// SendResponse this func is sort of a catch all to write to the ResponseWriter
// and set the headers and stuff
func SendResponse(w http.ResponseWriter, data interface{}, statusCode int) {
	w.Header().Set("Access-Control-Allow-Origin", "*") // this should be locked down before launch
	w.Header().Set("Content-Type", "application/json")

	jsonData, err := json.Marshal(data)
	if err != nil {
		SendResponse(w, err.Error(), 500)
		return
	}

	w.WriteHeader(statusCode)
	w.Write(jsonData)
}

func SendJSONResponse(w http.ResponseWriter, data []byte, statusCode int) {
	w.Header().Set("Access-Control-Allow-Origin", "*") // this should be locked down before launch
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	w.Write(data)
}

func sendNotFound(w http.ResponseWriter, err error) {
	output := map[string]string{
		"error": err.Error(),
	}
	SendResponse(w, output, 404)
}

func sendSystemError(w http.ResponseWriter, err error) {
	output := map[string]string{
		"error": err.Error(),
	}
	SendResponse(w, output, 500)
}
