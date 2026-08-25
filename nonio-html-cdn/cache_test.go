package main

import (
	"compress/gzip"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"nonio-html-cdn/util"
)

func TestPublishedPagesAreCachedAndGzipped(t *testing.T) {
	dir := t.TempDir()
	page := "<html><body>" + strings.Repeat("<p>hello world</p>", 100) + "</body></html>"
	os.WriteFile(filepath.Join(dir, "page.html"), []byte(page), 0644)

	handler := cacheControl("public, max-age=3600", util.Gzip(http.FileServer(http.Dir(dir)).ServeHTTP))
	rec := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/page.html", nil)
	req.Header.Set("Accept-Encoding", "gzip")
	handler.ServeHTTP(rec, req)

	if rec.Header().Get("Cache-Control") != "public, max-age=3600" {
		t.Errorf("Published pages should carry a TTL, got %q", rec.Header().Get("Cache-Control"))
	}
	if rec.Header().Get("Content-Encoding") != "gzip" {
		t.Fatalf("HTML should be gzipped, headers: %v", rec.Header())
	}
	gz, err := gzip.NewReader(rec.Body)
	if err != nil {
		t.Fatalf("Body should be valid gzip: %v", err)
	}
	out, _ := io.ReadAll(gz)
	if string(out) != page {
		t.Errorf("The page should round-trip through compression")
	}
	if rec.Body.Len() >= len(page)/3 {
		t.Errorf("Repetitive HTML should compress well, got %v of %v bytes", rec.Body.Len(), len(page))
	}
}

func TestTempPreviewsAreNeverCached(t *testing.T) {
	dir := t.TempDir()
	os.WriteFile(filepath.Join(dir, "preview.html"), []byte("<html>draft</html>"), 0644)

	handler := cacheControl("no-store", util.Gzip(http.FileServer(http.Dir(dir)).ServeHTTP))
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, httptest.NewRequest("GET", "/preview.html", nil))

	if rec.Header().Get("Cache-Control") != "no-store" {
		t.Errorf("Temp previews must not be cached, got %q", rec.Header().Get("Cache-Control"))
	}
}
