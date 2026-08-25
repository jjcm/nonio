package models

import (
	"testing"
)

func TestWeCanVoteOnComments(t *testing.T) {
	setupTestingDB()

	user1, _ := UserFactory("example1@example.com", "bob", "password")
	user2, _ := UserFactory("example2@example.com", "ralph", "password")

	post, _ := user1.CreatePost("Post Title", "post-title", "", "lorem ipsum", "image", 0, 0)

	comment1, _ := user2.CreateComment(post, nil, "Test comment from user 2 on user 1's post")

	if err := user1.CreateCommentVote(comment1.ID, true); err != nil {
		t.Errorf("Error creating vote")
	}
}

func TestWeCanAdjustLineageScore(t *testing.T) {
	setupTestingDB()

	user1, _ := UserFactory("example1@example.com", "bob", "password")
	user2, _ := UserFactory("example2@example.com", "ralph", "password")

	post, _ := user1.CreatePost("Post Title", "post-title", "", "lorem ipsum", "image", 0, 0)

	comment1, _ := user2.CreateComment(post, nil, "Test comment from user 2 on user 1's post")
	comment2, _ := user2.CreateComment(post, &comment1, "Test comment replying to comment 1")
	comment3, _ := user2.CreateComment(post, &comment2, "Test comment replying to comment 2")

	if err := user1.CreateCommentVote(comment1.ID, true); err != nil {
		t.Errorf("Error creating vote")
	}
	if err := user1.CreateCommentVote(comment2.ID, true); err != nil {
		t.Errorf("Error creating vote")
	}
	if err := user1.CreateCommentVote(comment3.ID, true); err != nil {
		t.Errorf("Error creating vote")
	}

	comment1.FindByID(comment1.ID)
	if comment1.LineageScore != 3 {
		t.Errorf("Comment's lineage score should be 3. Got %v instead.\n", comment1.LineageScore)
	}

	comment2.FindByID(comment2.ID)
	if comment2.LineageScore != 2 {
		t.Errorf("Comment's lineage score should be 2. Got %v instead.\n", comment2.LineageScore)
	}

	comment3.FindByID(comment3.ID)
	if comment3.LineageScore != 1 {
		t.Errorf("Comment's lineage score should be 1. Got %v instead.\n", comment3.LineageScore)
	}

	comment4, _ := user2.CreateComment(post, nil, "Test comment from user 2 on user 1's post")
	comment5, _ := user2.CreateComment(post, &comment4, "Test comment replying to comment 4")
	comment6, _ := user2.CreateComment(post, &comment5, "Test comment replying to comment 5")

	if err := user1.CreateCommentVote(comment4.ID, false); err != nil {
		t.Errorf("Error creating vote")
	}
	if err := user1.CreateCommentVote(comment5.ID, false); err != nil {
		t.Errorf("Error creating vote")
	}
	if err := user1.CreateCommentVote(comment6.ID, false); err != nil {
		t.Errorf("Error creating vote")
	}

	comment4.FindByID(comment4.ID)
	if comment4.LineageScore != -3 {
		t.Errorf("Comment's lineage score should be -3. Got %v instead.\n", comment4.LineageScore)
	}

	comment5.FindByID(comment5.ID)
	if comment5.LineageScore != -2 {
		t.Errorf("Comment's lineage score should be -2. Got %v instead.\n", comment5.LineageScore)
	}

	comment6.FindByID(comment6.ID)
	if comment6.LineageScore != -1 {
		t.Errorf("Comment's lineage score should be -1. Got %v instead.\n", comment6.LineageScore)
	}

	comment7, _ := user2.CreateComment(post, nil, "Test comment from user 2 on user 1's post")
	comment8, _ := user2.CreateComment(post, &comment7, "Test comment replying to comment 7")

	if err := user1.CreateCommentVote(comment7.ID, true); err != nil {
		t.Errorf("Error creating vote")
	}
	if err := user1.CreateCommentVote(comment8.ID, false); err != nil {
		t.Errorf("Error creating vote")
	}

	comment7.FindByID(comment7.ID)
	if comment7.LineageScore != 0 {
		t.Errorf("Comment's lineage score should be 0. Got %v instead.\n", comment7.LineageScore)
	}
}

func TestWeCanGetUpvotes(t *testing.T) {
	setupTestingDB()

	bob, _ := UserFactory("example1@example.com", "bob", "password")
	ralph, _ := UserFactory("example2@example.com", "ralph", "password")
	joe, _ := UserFactory("example3@example.com", "joe", "password")
	wanda, _ := UserFactory("example4@example.com", "wanda", "password")

	post, _ := bob.CreatePost("Post Title", "post-title", "", "lorem ipsum", "image", 0, 0)

	comment1, _ := ralph.CreateComment(post, nil, "Test comment from ralph on bob's post")

	if err := bob.CreateCommentVote(comment1.ID, true); err != nil {
		t.Errorf("Error creating vote")
	}
	if err := joe.CreateCommentVote(comment1.ID, true); err != nil {
		t.Errorf("Error creating vote")
	}
	if err := wanda.CreateCommentVote(comment1.ID, true); err != nil {
		t.Errorf("Error creating vote")
	}

	comment1.FindByID(comment1.ID)

	if comment1.Upvotes != 3 {
		t.Errorf("Expected comment to have 3 upvotes. Got %v instead.", comment1.Upvotes)
	}
}

func TestWeCanGetDownvotes(t *testing.T) {
	setupTestingDB()

	bob, _ := UserFactory("example1@example.com", "bob", "password")
	ralph, _ := UserFactory("example2@example.com", "ralph", "password")
	joe, _ := UserFactory("example3@example.com", "joe", "password")
	wanda, _ := UserFactory("example4@example.com", "wanda", "password")

	post, _ := bob.CreatePost("Post Title", "post-title", "", "lorem ipsum", "image", 0, 0)

	comment1, _ := ralph.CreateComment(post, nil, "Test comment from ralph on bob's post")

	if err := bob.CreateCommentVote(comment1.ID, false); err != nil {
		t.Errorf("Error creating vote")
	}
	if err := joe.CreateCommentVote(comment1.ID, false); err != nil {
		t.Errorf("Error creating vote")
	}
	if err := wanda.CreateCommentVote(comment1.ID, false); err != nil {
		t.Errorf("Error creating vote")
	}

	comment1.FindByID(comment1.ID)

	if comment1.Downvotes != 3 {
		t.Errorf("Expected comment to have 3 downvotes. Got %v instead.", comment1.Upvotes)
	}
}

func TestWeCanChangeVotes(t *testing.T) {
	setupTestingDB()

	bob, _ := UserFactory("example1@example.com", "bob", "password")
	ralph, _ := UserFactory("example2@example.com", "ralph", "password")
	joe, _ := UserFactory("example3@example.com", "joe", "password")
	wanda, _ := UserFactory("example4@example.com", "wanda", "password")

	post, _ := bob.CreatePost("Post Title", "post-title", "", "lorem ipsum", "image", 0, 0)

	comment1, _ := ralph.CreateComment(post, nil, "Test comment from ralph on bob's post")

	// downvote first
	if err := bob.CreateCommentVote(comment1.ID, false); err != nil {
		t.Errorf("Error creating vote")
	}
	if err := joe.CreateCommentVote(comment1.ID, false); err != nil {
		t.Errorf("Error creating vote")
	}
	if err := wanda.CreateCommentVote(comment1.ID, false); err != nil {
		t.Errorf("Error creating vote")
	}

	// Change the vote #electionTamperingEvidence
	if err := wanda.CreateCommentVote(comment1.ID, true); err != nil {
		t.Errorf("Error creating vote")
	}

	comment1.FindByID(comment1.ID)

	if comment1.Downvotes != 2 {
		t.Errorf("Expected comment to have 2 downvotes. Got %v instead.", comment1.Downvotes)
	}

	if comment1.Upvotes != 1 {
		t.Errorf("Expected comment to have 1 upvote. Got %v instead.", comment1.Upvotes)
	}
}

func TestWeCanDeleteVotes(t *testing.T) {
	setupTestingDB()

	bob, _ := UserFactory("example1@example.com", "bob", "password")
	ralph, _ := UserFactory("example2@example.com", "ralph", "password")

	post, _ := bob.CreatePost("Post Title", "post-title", "", "lorem ipsum", "image", 0, 0)

	comment1, _ := ralph.CreateComment(post, nil, "Test comment from ralph on bob's post")

	// Create an upvote
	if err := bob.CreateCommentVote(comment1.ID, true); err != nil {
		t.Errorf("Error creating vote")
	}

	comment1.FindByID(comment1.ID)

	if comment1.Upvotes != 1 {
		t.Errorf("Expected comment to have 1 upvote. Got %v instead.", comment1.Upvotes)
	}

	// Delete the vote
	if err := bob.DeleteCommentVote(comment1.ID); err != nil {
		t.Errorf("Error deleting vote")
	}

	comment1.FindByID(comment1.ID)

	if comment1.Upvotes != 0 {
		t.Errorf("Expected comment to have 0 upvotes. Got %v instead.", comment1.Upvotes)
	}
}

func TestWeCanGetCommentVotesByParams(t *testing.T) {
	setupTestingDB()

	bob, _ := UserFactory("bob@example.com", "bob", "password")
	ralph, _ := UserFactory("ralph@example.com", "ralph", "password")
	joe, _ := UserFactory("joe@example.com", "joe", "password")

	bobsPost, _ := bob.CreatePost("Post Title", "post-title", "", "lorem ipsum", "image", 0, 0)
	ralphsPost, _ := ralph.CreatePost("Post Title", "post-title-2", "", "lorem ipsum", "image", 0, 0)

	comment1, _ := ralph.CreateComment(bobsPost, nil, "Test comment from user 2 on user 1's post")
	comment2, _ := ralph.CreateComment(bobsPost, &comment1, "Test comment replying to comment 1")
	comment3, _ := joe.CreateComment(bobsPost, &comment2, "Test comment replying to comment 2")
	comment4, _ := joe.CreateComment(ralphsPost, nil, "Test comment")

	if err := bob.CreateCommentVote(comment1.ID, true); err != nil {
		t.Errorf("Error creating vote")
	}
	if err := bob.CreateCommentVote(comment2.ID, false); err != nil {
		t.Errorf("Error creating vote")
	}
	if err := bob.CreateCommentVote(comment3.ID, true); err != nil {
		t.Errorf("Error creating vote")
	}
	if err := bob.CreateCommentVote(comment4.ID, false); err != nil {
		t.Errorf("Error creating vote")
	}

	commentVoteQueryParams := CommentVoteQueryParams{}
	var params *CommentVoteQueryParams = &commentVoteQueryParams

	commentVotes, err := GetCommentVotesByParams(&bob, params)
	if err != nil {
		t.Errorf("We should have been able to get comment votes. Error recieved: %s", err)
	}
	if len(commentVotes) != 4 {
		t.Errorf("Should have found four votes from Bob. Instead recieved: %v", len(commentVotes))
	}

	params.UserID = joe.ID
	commentVotes, err = GetCommentVotesByParams(&bob, params)
	if err != nil {
		t.Errorf("We should have been able to get comment votes. Error recieved: %s", err)
	}
	if len(commentVotes) != 2 {
		t.Errorf("Should have found two votes from Bob on Joe's comments. Instead recieved: %v", len(commentVotes))
	}

	params.PostID = bobsPost.ID
	commentVotes, err = GetCommentVotesByParams(&bob, params)
	if err != nil {
		t.Errorf("We should have been able to get comment votes. Error recieved: %s", err)
	}
	if len(commentVotes) != 1 {
		t.Errorf("Should have found one vote from Bob on Joe's comments on Bob's post. Instead recieved: %v", len(commentVotes))
	}

	params.UserID = 0
	commentVotes, err = GetCommentVotesByParams(&bob, params)
	if err != nil {
		t.Errorf("We should have been able to get comment votes. Error recieved: %s", err)
	}
	if len(commentVotes) != 3 {
		t.Errorf("Should have found three votes from Bob on Bob's post. Instead recieved: %v", len(commentVotes))
	}
}
