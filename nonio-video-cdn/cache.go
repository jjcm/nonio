package main

import "net/http"

// cacheControl serves files with an explicit Cache-Control. Without one,
// browsers fall back to heuristic caching, which is unpredictable for large
// video segments. Video paths are write-once after the encode/move flow but
// not content-hashed, so the TTL is one day rather than immutable; after
// expiry clients revalidate against Last-Modified. Range requests are
// unaffected (the header rides along on 206 responses).
func cacheControl(value string, h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", value)
		h.ServeHTTP(w, r)
	})
}
