package main

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

func TestCacheControlServesFilesWithExplicitCaching(t *testing.T) {
	dir := t.TempDir()
	os.WriteFile(filepath.Join(dir, "someuser.webp"), []byte("webp bytes"), 0644)

	handler := cacheControl("public, max-age=300", http.FileServer(http.Dir(dir)))
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, httptest.NewRequest("GET", "/someuser.webp", nil))

	if rec.Code != 200 {
		t.Fatalf("Expected 200, got %v", rec.Code)
	}
	if rec.Header().Get("Cache-Control") != "public, max-age=300" {
		t.Errorf("Avatars should carry an explicit short TTL, got %q", rec.Header().Get("Cache-Control"))
	}
	if rec.Header().Get("Last-Modified") == "" {
		t.Errorf("FileServer's Last-Modified should still be present for revalidation")
	}
}

func TestCacheControlKeepsConditionalRequestsWorking(t *testing.T) {
	dir := t.TempDir()
	os.WriteFile(filepath.Join(dir, "someuser.webp"), []byte("webp bytes"), 0644)
	handler := cacheControl("public, max-age=300", http.FileServer(http.Dir(dir)))

	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, httptest.NewRequest("GET", "/someuser.webp", nil))
	lastModified := rec.Header().Get("Last-Modified")

	rec = httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/someuser.webp", nil)
	req.Header.Set("If-Modified-Since", lastModified)
	handler.ServeHTTP(rec, req)
	if rec.Code != 304 {
		t.Errorf("An If-Modified-Since revalidation should answer 304, got %v", rec.Code)
	}
}
