package util

import "strings"

// MediaCategory returns the top level type of a content type header - "image"
// for "image/heic" - or an empty string when the header is missing or isn't a
// media type at all.
func MediaCategory(contentType string) string {
	parts := strings.SplitN(contentType, "/", 2)
	if len(parts) != 2 || parts[1] == "" {
		return ""
	}
	return strings.ToLower(strings.TrimSpace(parts[0]))
}
