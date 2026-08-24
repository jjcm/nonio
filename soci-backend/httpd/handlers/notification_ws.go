package handlers

import (
	"encoding/json"
	"net/http"
	"sync"
	"time"

	"soci-backend/httpd/utils"
	"soci-backend/models"

	"golang.org/x/net/websocket"
)

var notificationHub = newNotificationHub()

type notificationHubStore struct {
	mu      sync.RWMutex
	clients map[int]map[*notificationClient]struct{}
}

type notificationClient struct {
	conn   *websocket.Conn
	userID int
	mu     sync.Mutex
}

func newNotificationHub() *notificationHubStore {
	return &notificationHubStore{
		clients: map[int]map[*notificationClient]struct{}{},
	}
}

func (h *notificationHubStore) add(client *notificationClient) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if _, ok := h.clients[client.userID]; !ok {
		h.clients[client.userID] = map[*notificationClient]struct{}{}
	}
	h.clients[client.userID][client] = struct{}{}
}

func (h *notificationHubStore) remove(client *notificationClient) {
	h.mu.Lock()
	defer h.mu.Unlock()
	userClients, ok := h.clients[client.userID]
	if !ok {
		return
	}
	delete(userClients, client)
	if len(userClients) == 0 {
		delete(h.clients, client.userID)
	}
}

func (h *notificationHubStore) clientsFor(userID int) []*notificationClient {
	h.mu.RLock()
	defer h.mu.RUnlock()
	userClients := h.clients[userID]
	out := make([]*notificationClient, 0, len(userClients))
	for client := range userClients {
		out = append(out, client)
	}
	return out
}

func (h *notificationHubStore) hasClients(userID int) bool {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.clients[userID]) > 0
}

func (c *notificationClient) writeJSON(payload interface{}) error {
	data, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	_ = c.conn.SetWriteDeadline(time.Now().Add(5 * time.Second))
	return websocket.Message.Send(c.conn, string(data))
}

func notificationCountPayload(count int) map[string]interface{} {
	return map[string]interface{}{
		"type":  "notification.count",
		"count": count,
	}
}

// notifyNotificationCount pushes the user's current unread count to all of
// their connected notification sockets. Call it after anything that changes
// the count (new notification, mark-read). The COUNT query only runs when
// the user actually has a socket open.
func notifyNotificationCount(userID int) {
	if userID == 0 || !notificationHub.hasClients(userID) {
		return
	}
	u := models.User{ID: userID}
	count, err := u.GetUnreadNotificationCount()
	if err != nil {
		Log.WithError(err).Errorf("notification ws: unread count for user %d", userID)
		return
	}
	payload := notificationCountPayload(count)
	for _, client := range notificationHub.clientsFor(userID) {
		if err := client.writeJSON(payload); err != nil {
			notificationHub.remove(client)
			_ = client.conn.Close()
		}
	}
}

// NotificationsWS - GET /notifications/ws?token=...
// Sends {type: "notification.count", count} on connect and again whenever
// this user's unread count changes (reply received, notification marked
// read), replacing the frontend's unread-count polling.
func NotificationsWS(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		SendResponse(w, utils.MakeError("you can only GET this route"), http.StatusMethodNotAllowed)
		return
	}
	user, err := wsAuthUserFromRequest(r)
	if err != nil {
		SendResponse(w, utils.MakeError(err.Error()), http.StatusUnauthorized)
		return
	}

	websocket.Handler(func(conn *websocket.Conn) {
		client := &notificationClient{
			conn:   conn,
			userID: user.ID,
		}
		notificationHub.add(client)
		defer func() {
			notificationHub.remove(client)
			_ = conn.Close()
		}()

		count, err := user.GetUnreadNotificationCount()
		if err != nil {
			Log.WithError(err).Errorf("notification ws: initial unread count for user %d", user.ID)
			return
		}
		if err := client.writeJSON(notificationCountPayload(count)); err != nil {
			return
		}

		for {
			var ignored string
			if err := websocket.Message.Receive(conn, &ignored); err != nil {
				return
			}
		}
	}).ServeHTTP(w, r)
}
