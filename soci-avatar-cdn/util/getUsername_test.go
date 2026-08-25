package util

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"soci-avatar-cdn/config"
)

func fakeAPI(t *testing.T, status int, body string) *httptest.Server {
	t.Helper()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/protected" {
			t.Errorf("Expected a call to /protected, got %v", r.URL.Path)
		}
		if r.Header.Get("Authorization") == "" {
			t.Errorf("The bearer token should be forwarded to the API")
		}
		w.WriteHeader(status)
		w.Write([]byte(body))
	}))
	t.Cleanup(server.Close)
	config.Settings.APIHost = server.URL
	return server
}

func TestGetUsernameReturnsTheUsername(t *testing.T) {
	fakeAPI(t, 200, `{"email":"user@example.com","username":"noniouser","id":42}`)

	username, err := GetUsername("Bearer token")
	if err != nil {
		t.Fatalf("A valid token should not error. Error: %v", err)
	}
	if username != "noniouser" {
		t.Errorf("Expected username 'noniouser', got %q", username)
	}
}

func TestGetUsernamePropagatesAPIErrors(t *testing.T) {
	fakeAPI(t, 401, `{"error":"token is expired"}`)

	_, err := GetUsername("Bearer expired")
	if err == nil || err.Error() != "token is expired" {
		t.Errorf("The API error should be propagated, got %v", err)
	}
}

func TestGetUsernameRejectsInvalidJSON(t *testing.T) {
	fakeAPI(t, 200, `not json at all`)

	_, err := GetUsername("Bearer token")
	if err == nil {
		t.Errorf("Invalid JSON from the API should error")
	}
}

func TestGetUsernameHandlesUnreachableAPI(t *testing.T) {
	config.Settings.APIHost = "http://127.0.0.1:1" // nothing listens here

	_, err := GetUsername("Bearer token")
	if err == nil {
		t.Errorf("An unreachable API should error")
	}
}
