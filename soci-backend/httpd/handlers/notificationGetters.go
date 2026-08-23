package handlers

import (
	"net/http"
	"strings"

	"soci-backend/httpd/utils"
	"soci-backend/models"
)

// GetNotifications - gets a user's notifications as a list of comments
func GetNotifications(w http.ResponseWriter, r *http.Request) {
	u := models.User{}
	u.FindByID(r.Context().Value("user_id").(int))

	params := &models.NotificationQueryParams{}

	// parse the url parameters
	r.ParseForm()

	// ?unread=true|false
	// Filters by unread
	unread := strings.TrimSpace(r.FormValue("unread"))
	params.Unread = unread == "true"

	notifications, err := u.GetNotifications(params)
	if err != nil {
		SendResponse(w, utils.MakeError(err.Error()), 500)
		return
	}

	output := map[string]interface{}{
		"notifications": notifications,
	}
	SendResponse(w, output, 200)
}

// GetUnreadNotificationCount - gets a user's count of unread notifications
func GetUnreadNotificationCount(w http.ResponseWriter, r *http.Request) {
	u := models.User{}
	u.FindByID(r.Context().Value("user_id").(int))

	notificationCount, err := u.GetUnreadNotificationCount()
	if err != nil {
		SendResponse(w, utils.MakeError(err.Error()), 500)
		return
	}

	SendResponse(w, notificationCount, 200)
}
