package main

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestWebpOnlyRefusesLeftoverHEICAvatars(t *testing.T) {
	dir := t.TempDir()
	os.WriteFile(filepath.Join(dir, "someuser.webp"), []byte("webp bytes"), 0644)
	os.WriteFile(filepath.Join(dir, "someuser.heic"), []byte("heic bytes"), 0644)
	server := webpOnly(cacheControl("public, max-age=300", http.FileServer(http.Dir(dir))))

	rec := httptest.NewRecorder()
	server.ServeHTTP(rec, httptest.NewRequest("GET", "/someuser.webp", nil))
	if rec.Code != 200 {
		t.Fatalf("Avatars should still be served as webp, got %v", rec.Code)
	}

	for _, path := range []string{"/someuser.heic", "/someuser.HEIC", "/someuser.heif"} {
		rec = httptest.NewRecorder()
		server.ServeHTTP(rec, httptest.NewRequest("GET", path, nil))
		if rec.Code != http.StatusGone {
			t.Errorf("%v should answer 410, got %v", path, rec.Code)
		}
		if contentType := rec.Header().Get("Content-Type"); strings.HasPrefix(contentType, "image/") {
			t.Errorf("%v should not answer with an image content type, got %q", path, contentType)
		}
	}
}
