package main

import "net/http"

// cacheControl serves files with an explicit Cache-Control. Without one,
// browsers fall back to heuristic caching (a fraction of the file's age),
// which re-downloads feed images far more often than needed. Image paths are
// write-once (the post URL is checked for availability before an upload can
// claim it) but not content-hashed, so the TTL is one day rather than
// immutable; after expiry clients revalidate against Last-Modified.
func cacheControl(value string, h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", value)
		h.ServeHTTP(w, r)
	})
}
