package util

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"nonio-image-cdn/config"
)

func fakeAPI(t *testing.T, status int, body string) {
	t.Helper()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/protected" {
			t.Errorf("Expected a call to /protected, got %v", r.URL.Path)
		}
		w.WriteHeader(status)
		w.Write([]byte(body))
	}))
	t.Cleanup(server.Close)
	config.Settings.APIHost = server.URL
}

func TestGetUserEmailReturnsTheEmail(t *testing.T) {
	fakeAPI(t, 200, `{"email":"user@example.com","id":42}`)

	email, err := GetUserEmail("Bearer token")
	if err != nil {
		t.Fatalf("A valid token should not error. Error: %v", err)
	}
	if email != "user@example.com" {
		t.Errorf("Expected the user's email, got %q", email)
	}
}

func TestGetUserEmailPropagatesAPIErrors(t *testing.T) {
	fakeAPI(t, 401, `{"error":"token is expired"}`)

	_, err := GetUserEmail("Bearer expired")
	if err == nil || err.Error() != "token is expired" {
		t.Errorf("The API error should be propagated, got %v", err)
	}
}

func TestGetUserEmailRejectsInvalidJSON(t *testing.T) {
	fakeAPI(t, 200, `<html>gateway error</html>`)

	_, err := GetUserEmail("Bearer token")
	if err == nil {
		t.Errorf("Invalid JSON from the API should error")
	}
}
