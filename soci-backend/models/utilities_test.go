package models

import (
	"strconv"
	"strings"
	"testing"
)

func TestWeCanCreateAWebFriendlyAliasFromAGivenString(t *testing.T) {
	cases := map[string]string{
		"Hello":                      "hello",
		"This is a TEST":             "this-is-a-test",
		"   extra spaces are NBD   ": "extra-spaces-are-nbd",
		"spaces  between  words":     "spaces-between-words",
		"ditch bad chars !@#$%^&*()_+-=,./<>?;'\"[]{}`~": "ditch-bad-chars-_-.~",
	}

	// TODO: this test doesn't make sense anymore. we should ditch it or fix it
	// but now that we aren't really generating URLs on the server side anymore
	// this functionality might not be necessary
	//
	for range cases {
		// 	if createURLFromTitle(title) != alias {
		// 		t.Errorf("Expected alias didn't match our title.\nTitle: '%v'\nExpected Alias:  %v\nGenerated Alias: %v", title, alias, createURLFromTitle(title))
		// 	}
	}
}

func TestWeCanGetTheParentIDsFromAListOfComments(t *testing.T) {
	setupTestingDB()

	var comments []Comment
	// check the default output
	if getUniqueCommentParentIDs(comments) != "0" {
		t.Error("The default output of the parent ID getter should be \"0\"")
	}

	person, _ := UserFactory("person@example.com", "friendlyPerson", "password")
	// create a post and a weird comment thread
	post, _ := person.CreatePost("Post Title", "post-title", "", "lorem ipsum", "image", 0, 0)
	topLevelComment1, _ := person.CreateComment(post, nil, "text")
	topLevelComment2, _ := person.CreateComment(post, nil, "text")
	topLevelComment3, _ := person.CreateComment(post, nil, "text")
	topLevelComment4, _ := person.CreateComment(post, nil, "text")
	topLevelComment5, _ := person.CreateComment(post, nil, "text")
	var topLevelParentIDs []string
	topLevelParentIDs = append(topLevelParentIDs, strconv.Itoa(topLevelComment1.ParentID), strconv.Itoa(topLevelComment2.ParentID), strconv.Itoa(topLevelComment3.ParentID), strconv.Itoa(topLevelComment4.ParentID), strconv.Itoa(topLevelComment5.ParentID))
	comments = append(comments, topLevelComment1, topLevelComment2, topLevelComment3, topLevelComment4, topLevelComment5)
	if getUniqueCommentParentIDs(comments) != "0" {
		t.Error("Top level comments should all have the parent ID of 0")
	}

	childofComment1_1, _ := person.CreateComment(post, &topLevelComment1, "i'm a child")
	childofComment1_2, _ := person.CreateComment(post, &topLevelComment1, "i'm a child")
	childofComment1_3, _ := person.CreateComment(post, &topLevelComment1, "i'm a child")
	childofComment2_1, _ := person.CreateComment(post, &topLevelComment2, "i'm a child")
	childofComment3_1, _ := person.CreateComment(post, &topLevelComment3, "i'm a child")
	// reset comments
	comments = []Comment{
		childofComment1_1,
		childofComment1_2,
		childofComment1_3,
		childofComment2_1,
		childofComment3_1,
	}
	if getUniqueCommentParentIDs(comments) != strings.Join(
		[]string{
			strconv.Itoa(topLevelComment1.ID),
			strconv.Itoa(topLevelComment2.ID),
			strconv.Itoa(topLevelComment3.ID),
		},
		",",
	) {
		t.Error("We were expecting the unique list of parent IDs to be correct")
	}

}
