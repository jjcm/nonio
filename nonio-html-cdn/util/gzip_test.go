package util

import (
	"bytes"
	"compress/gzip"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func serve(t *testing.T, handler http.HandlerFunc, acceptEncoding string, upgrade bool) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest("GET", "/x", nil)
	if acceptEncoding != "" {
		req.Header.Set("Accept-Encoding", acceptEncoding)
	}
	if upgrade {
		req.Header.Set("Upgrade", "websocket")
		req.Header.Set("Connection", "Upgrade")
	}
	rec := httptest.NewRecorder()
	Gzip(handler)(rec, req)
	return rec
}

func jsonHandler(body []byte, status int) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(status)
		w.Write(body)
	}
}

func TestGzipCompressesLargeJSON(t *testing.T) {
	body := []byte(`{"posts":"` + strings.Repeat("abc123", 500) + `"}`)
	rec := serve(t, jsonHandler(body, 200), "gzip", false)

	if rec.Header().Get("Content-Encoding") != "gzip" {
		t.Fatalf("Large JSON should be gzipped. Headers: %v", rec.Header())
	}
	if rec.Header().Get("Vary") != "Accept-Encoding" {
		t.Errorf("Vary: Accept-Encoding should be set")
	}
	gz, err := gzip.NewReader(bytes.NewReader(rec.Body.Bytes()))
	if err != nil {
		t.Fatalf("Body should be a valid gzip stream: %v", err)
	}
	out, _ := io.ReadAll(gz)
	if !bytes.Equal(out, body) {
		t.Errorf("Decompressed body should round-trip to the original")
	}
	if rec.Body.Len() >= len(body) {
		t.Errorf("Compressed body (%v) should be smaller than the original (%v)", rec.Body.Len(), len(body))
	}
}

func TestGzipSkipsSmallResponses(t *testing.T) {
	body := []byte(`{"ok":true}`)
	rec := serve(t, jsonHandler(body, 200), "gzip", false)

	if rec.Header().Get("Content-Encoding") != "" {
		t.Errorf("Small responses shouldn't be compressed")
	}
	if !bytes.Equal(rec.Body.Bytes(), body) {
		t.Errorf("Small responses should pass through unchanged")
	}
}

func TestGzipSkipsNonCompressibleContentTypes(t *testing.T) {
	big := bytes.Repeat([]byte{0xff, 0x00, 0x42}, 1000)
	handler := func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "image/png")
		w.Write(big)
	}
	rec := serve(t, handler, "gzip", false)

	if rec.Header().Get("Content-Encoding") != "" {
		t.Errorf("Binary content types shouldn't be compressed")
	}
	if !bytes.Equal(rec.Body.Bytes(), big) {
		t.Errorf("Binary bodies should pass through unchanged")
	}
}

func TestGzipSkipsClientsWithoutSupport(t *testing.T) {
	body := []byte(strings.Repeat("compressible text ", 200))
	handler := func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/plain")
		w.Write(body)
	}
	rec := serve(t, handler, "", false)

	if rec.Header().Get("Content-Encoding") != "" {
		t.Errorf("Clients without Accept-Encoding: gzip should get identity")
	}
	if !bytes.Equal(rec.Body.Bytes(), body) {
		t.Errorf("Body should be unchanged for identity responses")
	}
}

func TestGzipPassesThroughWebSocketUpgrades(t *testing.T) {
	called := false
	handler := func(w http.ResponseWriter, r *http.Request) {
		// the raw recorder, not the gzip wrapper, must reach the handler so
		// hijacking works
		if _, wrapped := w.(*gzipResponseWriter); wrapped {
			t.Errorf("WebSocket upgrades should bypass the gzip writer")
		}
		called = true
	}
	serve(t, handler, "gzip", true)
	if !called {
		t.Fatalf("The wrapped handler should have been called")
	}
}

func TestGzipPreservesStatusCodes(t *testing.T) {
	body := []byte(`{"error":"` + strings.Repeat("nope", 300) + `"}`)
	rec := serve(t, jsonHandler(body, 404), "gzip", false)

	if rec.Code != 404 {
		t.Errorf("Status code should survive compression. Got %v", rec.Code)
	}
	if rec.Header().Get("Content-Encoding") != "gzip" {
		t.Errorf("Error responses over the size threshold should still compress")
	}
}

func TestClientAcceptsGzipParsesQValues(t *testing.T) {
	cases := map[string]bool{
		"gzip":                 true,
		"GZIP":                 true,
		"br, gzip;q=0.8":       true,
		"identity":             false,
		"":                     false,
		"br;q=1.0, deflate":    false,
		"gzip;q=0, notreally":  true, // we only check that gzip is listed
		"x-gzip-like, deflate": false,
	}
	for header, want := range cases {
		req := httptest.NewRequest("GET", "/", nil)
		req.Header.Set("Accept-Encoding", header)
		if got := clientAcceptsGzip(req); got != want {
			t.Errorf("clientAcceptsGzip(%q) = %v, want %v", header, got, want)
		}
	}
}
