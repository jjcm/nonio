package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"

	"soci-backend/httpd/utils"
	"soci-backend/models"
)

// MarkNotificationRead - marks a specific notification as read
func MarkNotificationRead(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		SendResponse(w, utils.MakeError("you can only POST to the MarkNotificationRead route"), 405)
		return
	}

	type requestPayload struct {
		ID int `json:"id"`
	}

	var payload requestPayload
	decoder := json.NewDecoder(r.Body)
	decoder.Decode(&payload)

	Log.Infof("Marking notification %d as read", payload.ID)

	// get the user id from context
	userID := r.Context().Value("user_id").(int)

	notification := &models.Notification{}
	err := notification.FindByID(payload.ID)
	if err != nil {
		sendSystemError(w, err)
		return
	}

	if notification.UserID != userID {
		sendSystemError(w, fmt.Errorf("user %d does not own notification %d", userID, notification.ID))
		return
	}

	err = notification.MarkRead()
	if err != nil {
		sendSystemError(w, err)
		return
	}

	SendResponse(w, true, 200)
}
