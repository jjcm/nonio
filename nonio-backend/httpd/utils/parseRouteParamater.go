package utils

import "strings"

// ParseRouteParameter just trims the prefix off something, but it's labelled better and we can extend it later.
func ParseRouteParameter(fullpath, pattern string) string {
	return strings.TrimPrefix(fullpath, pattern)
}
