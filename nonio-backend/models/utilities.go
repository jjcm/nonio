package models

import (
	"strconv"
	"strings"
)

// getUniqueCommentParentIDs
// this will take in a slice of comments and return a unique list of parent IDs
// as a comma separated string. it's used to make SQL queries faster
func getUniqueCommentParentIDs(comments []Comment) string {
	var parentIDs []string

	if len(comments) == 0 {
		return "0"
	}

	for _, c := range comments {
		currentParentID := strconv.Itoa(c.ParentID)
		if !stringInSlice(currentParentID, parentIDs) {
			parentIDs = append(parentIDs, strconv.Itoa(c.ParentID))
		}
	}
	return strings.Join(parentIDs, ",")
}

func stringInSlice(a string, list []string) bool {
	for _, b := range list {
		if b == a {
			return true
		}
	}
	return false
}
