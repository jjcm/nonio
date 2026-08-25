package main

import "net/http"

// cacheControl serves files with an explicit Cache-Control. Published HTML
// posts are claimed once per post URL but can in principle be replaced, so
// they get a modest TTL; temp previews change during editing and must never
// be cached; the embed helper script follows the frontend's short static TTL.
func cacheControl(value string, h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", value)
		h.ServeHTTP(w, r)
	})
}
