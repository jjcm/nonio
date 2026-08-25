package models

import (
	"testing"
)

func TestWeCanCreateComments(t *testing.T) {
	setupTestingDB()

	author, _ := UserFactory("example@example.com", "", "password")

	post, _ := author.CreatePost("Post Title", "post-title", "", "lorem ipsum", "image", 0, 0)

	// create comment
	comment, err := author.CreateComment(post, nil, "This is a dumb post")

	if err != nil {
		t.Errorf("We should have been able to create a comment. Error recieved: %s", err)
	}
	if comment.ID == 0 {
		t.Error("The created comment should have been instantiated correctly.")
	}
}

func TestWeCanDeleteComments(t *testing.T) {
	setupTestingDB()

	author, _ := UserFactory("example@example.com", "", "password")

	post, _ := author.CreatePost("Post Title", "post-title", "", "lorem ipsum", "image", 0, 0)

	// create comment
	comment, _ := author.CreateComment(post, nil, "This is a dumb post")
	err := author.DeleteComment(&comment)

	if err != nil {
		t.Errorf("We should have been able to delete a comment. Error recieved: %s", err)
	}
}

func TestWeCanEditComments(t *testing.T) {
	setupTestingDB()

	author, _ := UserFactory("example@example.com", "", "password")

	post, _ := author.CreatePost("Post Title", "post-title", "", "lorem ipsum", "image", 0, 0)

	// create comment
	comment, _ := author.CreateComment(post, nil, "This is a dumb post")
	comment.Content = "This is an excellent post!"
	err := author.EditComment(&comment)
	if err != nil {
		t.Errorf("We should have been able to edit a comment. Error recieved: %s", err)
	}

	// update the comment and see if it has been updated in the DB
	comment.FindByID(comment.ID)
	if comment.Content != "This is an excellent post!" {
		t.Errorf("Expected 'This is an excellent post!' for comment content, got %v instead", comment.Content)
	}

	/* This fails if the test is run on a different timezone than UTC
	if comment.Edited {
		t.Errorf("Comment should not have an edit flag, as the edit happened within the 5 minute grace period")
	}
	*/

	// Add a reply to the comment, then see if the edited flag gets triggered.
	author.CreateComment(post, &comment, "This is a dumb comment")

	comment.Content = "This is an edit to a parent comment."
	err = author.EditComment(&comment)
	if err != nil {
		t.Errorf("We should have been able to edit a comment. Error recieved: %s", err)
	}

	// update the comment and see if it has an edited flag
	comment.FindByID(comment.ID)
	if !comment.Edited {
		t.Errorf("Comment should have an edit flag as it has a reply. Edited however was set to false.")
	}

	/* This is disabled by default as it takes 6 minutes to run
	// Check if the comment has an edit flag if it has been edited after the 5 minute grace period
	time.Sleep(6 * time.Minute)
	var comment2 Comment
	comment2.FindByID(2)
	comment2.Content = "Slow comment update"
	author.EditComment(&comment2)
	comment2.FindByID(2)
	if !comment.Edited {
		t.Errorf("Comment should have an edit flag as it has been longer than 5 minutes. Edited however was set to false.")
	}
	*/

}

func TestWeCanAbandonComments(t *testing.T) {
	setupTestingDB()

	author, _ := UserFactory("example@example.com", "", "password")

	post, _ := author.CreatePost("Post Title", "post-title", "", "lorem ipsum", "image", 0, 0)

	// create comment
	comment, _ := author.CreateComment(post, nil, "This is a dumb post")
	err := author.AbandonComment(&comment)

	if err != nil {
		t.Errorf("We should have been able to abandon a comment. Error recieved: %s", err)
	}

	// make sure we can get comments for our post still
	commentQueryParams := CommentQueryParams{}
	var params *CommentQueryParams = &commentQueryParams
	params.PostID = post.ID
	_, err2 := GetCommentsByParams(params)
	if err2 != nil {
		t.Errorf("We should have been able to get comments for a post. Error recieved: %s", err)
	}

}

func TestWeCanGetCommentsByParams(t *testing.T) {
	setupTestingDB()

	bill, _ := UserFactory("bill@example.com", "bill", "password")
	joe, _ := UserFactory("joe@example.com", "joe", "password")

	post1, _ := bill.CreatePost("Post Title", "post-title", "", "lorem ipsum", "image", 0, 0)
	post2, _ := bill.CreatePost("Post Title", "post-title-2", "", "lorem ipsum", "image", 0, 0)

	// create comments on the first post
	comment1, _ := joe.CreateComment(post1, nil, "This is a dumb post")
	bill.CreateComment(post1, &comment1, "This is a reply")

	// create comment on the second post
	joe.CreateComment(post2, nil, "This is even worse")

	commentQueryParams := CommentQueryParams{}
	var params *CommentQueryParams = &commentQueryParams

	// try getting all comments
	comments, err := GetCommentsByParams(params)
	if err != nil {
		t.Errorf("We should have been able to get comments. Error recieved: %s", err)
	}
	if len(comments) != 3 {
		t.Errorf("Should have found three comments. Instead recieved: %v", len(comments))
	}

	// try getting all of Joe's comments
	params.UserID = joe.ID
	comments, err = GetCommentsByParams(params)
	if err != nil {
		t.Errorf("We should have been able to get comments. Error recieved: %s", err)
	}
	if len(comments) != 2 {
		t.Errorf("Should have found two comments from Joe. Instead recieved: %v", len(comments))
	}

	// try getting all of Joe's comments, but only for the first post
	params.PostID = post1.ID
	comments, err = GetCommentsByParams(params)
	if err != nil {
		t.Errorf("We should have been able to get comments. Error recieved: %s", err)
	}
	if len(comments) != 1 {
		t.Errorf("Should have found one comment from Joe. Instead recieved: %v", len(comments))
	}

	// try getting all of post 1's comments
	params.UserID = 0
	comments, err = GetCommentsByParams(params)
	if err != nil {
		t.Errorf("We should have been able to get comments. Error recieved: %s", err)
	}
	if len(comments) != 2 {
		t.Errorf("Should have found two comments. Instead recieved: %v", len(comments))
	}
}
