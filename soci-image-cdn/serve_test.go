package main

import (
	"io/ioutil"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
)

// imageServer stands in for the file server main() wires up, with a leftover
// heic from the old dual-encode pipeline sitting next to the webp.
func imageServer(t *testing.T) http.Handler {
	t.Helper()
	dir := t.TempDir()
	for _, name := range []string{"my-post.webp", "my-post.heic"} {
		if err := ioutil.WriteFile(filepath.Join(dir, name), []byte("bytes"), 0644); err != nil {
			t.Fatal(err)
		}
	}
	return webpOnly(cacheControl("public, max-age=86400", http.FileServer(http.Dir(dir))))
}

func TestWebpOnlyStillServesWebp(t *testing.T) {
	rec := httptest.NewRecorder()
	imageServer(t).ServeHTTP(rec, httptest.NewRequest("GET", "/my-post.webp", nil))

	if rec.Code != 200 {
		t.Fatalf("Expected 200, got %v", rec.Code)
	}
	if rec.Header().Get("Cache-Control") != "public, max-age=86400" {
		t.Errorf("Images should keep their day long TTL, got %q", rec.Header().Get("Cache-Control"))
	}
}

func TestWebpOnlyRefusesHEIC(t *testing.T) {
	server := imageServer(t)

	for _, path := range []string{"/my-post.heic", "/my-post.HEIC", "/my-post.heif", "/thumbnail/my-post.heic"} {
		rec := httptest.NewRecorder()
		server.ServeHTTP(rec, httptest.NewRequest("GET", path, nil))

		if rec.Code != http.StatusGone {
			t.Errorf("%v should answer 410, got %v", path, rec.Code)
		}
		if contentType := rec.Header().Get("Content-Type"); strings.HasPrefix(contentType, "image/") {
			t.Errorf("%v should not answer with an image content type, got %q", path, contentType)
		}
		if rec.Body.String() == "bytes" {
			t.Errorf("%v should not serve the leftover heic on disk", path)
		}
	}
}
