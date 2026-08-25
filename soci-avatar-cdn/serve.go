package main

import (
	"net/http"
	"path"
	"strings"
)

// webpOnly refuses HEIC/HEIF requests instead of letting the file server hand
// back an image/heic body. Avatars are encoded as webp only now, so a .heic on
// disk is a leftover from the old dual-encode pipeline and is gone for good.
func webpOnly(h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch strings.ToLower(path.Ext(r.URL.Path)) {
		case ".heic", ".heif":
			http.Error(w, "HEIC is no longer served, request the .webp instead", http.StatusGone)
			return
		}
		h.ServeHTTP(w, r)
	})
}
