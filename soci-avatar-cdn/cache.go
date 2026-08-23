package main

import "net/http"

// cacheControl serves files with an explicit Cache-Control. Without one,
// browsers fall back to heuristic caching (a fraction of the file's age),
// which is both unpredictable and can hold mutable files far too long.
// Avatar, banner, and emoji paths are keyed by username/name and overwritten
// in place on change, so the TTL stays short; clients revalidate against the
// Last-Modified header http.FileServer already sends.
func cacheControl(value string, h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", value)
		h.ServeHTTP(w, r)
	})
}
