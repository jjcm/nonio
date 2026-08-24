package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"soci-backend/httpd/utils"
	"soci-backend/models"

	"golang.org/x/net/websocket"
)

func notificationsWSTestServer() *httptest.Server {
	return httptest.NewServer(http.HandlerFunc(NotificationsWS))
}

func dialNotificationsWS(t *testing.T, server *httptest.Server, token string) *websocket.Conn {
	t.Helper()
	wsURL := "ws" + strings.TrimPrefix(server.URL, "http") + "/notifications/ws?token=" + token
	conn, err := websocket.Dial(wsURL, "", server.URL)
	if err != nil {
		t.Fatalf("Dialing the notification websocket should work. Error: %v", err)
	}
	return conn
}

func readNotificationCount(t *testing.T, conn *websocket.Conn) int {
	t.Helper()
	conn.SetReadDeadline(time.Now().Add(3 * time.Second))
	var raw string
	if err := websocket.Message.Receive(conn, &raw); err != nil {
		t.Fatalf("Expected a websocket message. Error: %v", err)
	}
	var msg struct {
		Type  string `json:"type"`
		Count int    `json:"count"`
	}
	if err := json.Unmarshal([]byte(raw), &msg); err != nil {
		t.Fatalf("Websocket messages should be valid JSON, got %q. Error: %v", raw, err)
	}
	if msg.Type != "notification.count" {
		t.Fatalf("Expected a notification.count message, got %q", msg.Type)
	}
	return msg.Count
}

func expectNoWSMessage(t *testing.T, conn *websocket.Conn) {
	t.Helper()
	conn.SetReadDeadline(time.Now().Add(300 * time.Millisecond))
	var raw string
	if err := websocket.Message.Receive(conn, &raw); err == nil {
		t.Fatalf("Expected no websocket message, got %q", raw)
	}
}

func TestNotificationsWSPushesCountOnCommentAndMarkRead(t *testing.T) {
	setupTestingDB()
	utils.HmacSampleSecret = []byte("secret")

	author, _ := models.UserFactory("author@example.com", "author", "password")
	commenter, _ := models.UserFactory("commenter@example.com", "commenter", "password")
	if _, err := author.CreatePost("A post", "a-post", "", "content", "blog", 0, 0); err != nil {
		t.Fatalf("Creating the post should work. Error: %v", err)
	}

	server := notificationsWSTestServer()
	defer server.Close()

	authorToken, err := utils.TokenCreator(author.Email, 1, "access")
	if err != nil {
		t.Fatalf("Creating a token should work. Error: %v", err)
	}
	commenterToken, err := utils.TokenCreator(commenter.Email, 1, "access")
	if err != nil {
		t.Fatalf("Creating a token should work. Error: %v", err)
	}

	authorConn := dialNotificationsWS(t, server, authorToken)
	defer authorConn.Close()
	commenterConn := dialNotificationsWS(t, server, commenterToken)
	defer commenterConn.Close()

	// Both sockets receive their unread count as a connection snapshot
	if count := readNotificationCount(t, authorConn); count != 0 {
		t.Fatalf("Author should start with 0 unread notifications, got %d", count)
	}
	if count := readNotificationCount(t, commenterConn); count != 0 {
		t.Fatalf("Commenter should start with 0 unread notifications, got %d", count)
	}

	// A reply to the author's post pushes the author's new count
	rec := httptest.NewRecorder()
	body := strings.NewReader(`{"post": "a-post", "content": "nice post"}`)
	req := httptest.NewRequest("POST", "/comment/create", body).WithContext(withUser(commenter.ID))
	CommentOnPost(rec, req)
	if rec.Code != 201 {
		t.Fatalf("Creating the comment should answer 201, got %v: %s", rec.Code, rec.Body.String())
	}
	if count := readNotificationCount(t, authorConn); count != 1 {
		t.Fatalf("Author should be pushed 1 unread notification, got %d", count)
	}
	// The commenter caused the notification but must not receive a push
	expectNoWSMessage(t, commenterConn)

	// Marking it read pushes the updated count (keeps other tabs in sync)
	notifications, err := author.GetNotifications(nil)
	if err != nil || len(notifications) != 1 {
		t.Fatalf("The author should have exactly 1 notification. Error: %v", err)
	}
	rec = httptest.NewRecorder()
	payload, _ := json.Marshal(map[string]int{"id": notifications[0].ID})
	req = httptest.NewRequest("POST", "/notification/mark-read", strings.NewReader(string(payload))).WithContext(withUser(author.ID))
	MarkNotificationRead(rec, req)
	if rec.Code != 200 {
		t.Fatalf("Marking the notification read should answer 200, got %v: %s", rec.Code, rec.Body.String())
	}
	if count := readNotificationCount(t, authorConn); count != 0 {
		t.Fatalf("Author should be pushed 0 after mark-read, got %d", count)
	}

	// Self-replies never notify: the author commenting on their own post
	// must not push anything to their socket
	rec = httptest.NewRecorder()
	req = httptest.NewRequest("POST", "/comment/create", strings.NewReader(`{"post": "a-post", "content": "thanks me"}`)).WithContext(withUser(author.ID))
	CommentOnPost(rec, req)
	if rec.Code != 201 {
		t.Fatalf("Creating the comment should answer 201, got %v: %s", rec.Code, rec.Body.String())
	}
	expectNoWSMessage(t, authorConn)
}

func TestNotificationsWSRequiresAuth(t *testing.T) {
	setupTestingDB()
	utils.HmacSampleSecret = []byte("secret")

	server := notificationsWSTestServer()
	defer server.Close()

	wsURL := "ws" + strings.TrimPrefix(server.URL, "http") + "/notifications/ws"
	if _, err := websocket.Dial(wsURL, "", server.URL); err == nil {
		t.Fatal("Dialing without a token should fail the handshake")
	}
	if _, err := websocket.Dial(wsURL+"?token=garbage", "", server.URL); err == nil {
		t.Fatal("Dialing with a garbage token should fail the handshake")
	}
}

func TestNotificationHubTracksClientsPerUser(t *testing.T) {
	hub := newNotificationHub()
	a1 := &notificationClient{userID: 1}
	a2 := &notificationClient{userID: 1}
	b := &notificationClient{userID: 2}

	hub.add(a1)
	hub.add(a2)
	hub.add(b)

	if !hub.hasClients(1) || !hub.hasClients(2) {
		t.Fatal("Both users should have clients registered")
	}
	if len(hub.clientsFor(1)) != 2 {
		t.Fatalf("User 1 should have 2 clients, got %d", len(hub.clientsFor(1)))
	}

	hub.remove(a1)
	hub.remove(a2)
	if hub.hasClients(1) {
		t.Fatal("User 1 should have no clients after both disconnect")
	}
	if !hub.hasClients(2) {
		t.Fatal("User 2's client should be unaffected")
	}
	// Removing an already-removed client is a no-op
	hub.remove(a1)
}
