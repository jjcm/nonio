package models

import (
	"fmt"
	"testing"
	"time"
)

func TestWeCanFindPostTagVoteByUK(t *testing.T) {
	setupTestingDB()

	// create the PostTagVote first
	item := &PostTagVote{
		PostID:  1,
		TagID:   1,
		VoterID: 1,
	}
	if err := item.CreatePostTagVote(); err != nil {
		t.Errorf("PostTagVote creation should have worked: %v", err)
		return
	}

	p := &PostTagVote{}
	p.FindByUK(item.PostID, item.TagID, item.VoterID)

	if p.ID == 0 {
		t.Errorf("We should have been able to find this PostTagVote by it's ID")
	}
}

func TestWeCanCreatePostTagVote(t *testing.T) {
	setupTestingDB()

	// create the PostTagVote first
	item := &PostTagVote{
		PostID:  1,
		TagID:   1,
		VoterID: 1,
	}
	if err := item.CreatePostTagVote(); err != nil {
		t.Errorf("PostTagVote creation should have worked: %v", err)
	}
}

func TestWeCanGetPostTagVotesByPostUser(t *testing.T) {
	setupTestingDB()

	// create the PostTagVote first
	item := &PostTagVote{
		PostID:  1,
		TagID:   1,
		VoterID: 1,
	}
	if err := item.CreatePostTagVote(); err != nil {
		t.Errorf("PostTagVote creation should have worked: %v", err)
		return
	}

	votes, err := item.GetVotesByPostUser(item.PostID, item.VoterID)
	if err != nil {
		t.Errorf("Get votes: %v", err)
	}
	if len(votes) != 1 {
		t.Errorf("We should have been able to find this PostTagVote voter ID")
	}
}

func TestWeCanGetCreatorFromPostTagVote(t *testing.T) {
	setupTestingDB()

	user1, _ := UserFactory("example1@example.com", "ralph", "password")
	user2, _ := UserFactory("example2@example.com", "joey", "password")

	post, _ := user1.CreatePost("Post Title", "post-title", "", "lorem ipsum", "image", 0, 0)
	// create the PostTagVote first

	user2.CreatePostTagVote(post.ID, 1)
	vote := &PostTagVote{}
	vote.FindByUK(post.ID, 1, user2.ID)

	if vote.CreatorID != user1.ID {
		t.Errorf("CreatorID of the vote is invalid. Expected %v but got %v instead.", user1.ID, vote.CreatorID)
		return
	}
}

func TestWeCanGetUntalliedVotesForAUser(t *testing.T) {
	setupTestingDB()

	user1, _ := UserFactory("example1@example.com", "ralph", "password")
	user2, _ := UserFactory("example2@example.com", "joey", "password")

	post1, _ := user1.CreatePost("Post Title", "post-title-1", "", "lorem ipsum", "image", 0, 0)
	post2, _ := user2.CreatePost("Post Title", "post-title-2", "", "lorem ipsum", "image", 0, 0)
	// create the PostTagVote first

	user2.CreatePostTagVote(post1.ID, 1)
	user2.CreatePostTagVote(post2.ID, 1)

	vote := &PostTagVote{}
	vote.FindByUK(post1.ID, 1, user2.ID)
	fmt.Println(vote.CreatedAt)

	time.Sleep(1 * time.Second)
	currentTime := time.Now()
	fmt.Println(currentTime)

	votes, err := user2.GetUntalliedVotes(currentTime)
	if err != nil {
		t.Errorf("Error getting untallied votes for the user.")
	}

	if len(votes) != 1 {
		t.Errorf("Got %v untallied votes for the user, expected 1. Ensure your DB is set to UTC time.", len(votes))
	}

	vote.MarkVotesAsTallied(currentTime)
	votes, err = user2.GetUntalliedVotes(currentTime)
	if err != nil {
		t.Errorf("Error getting untallied votes for the user.")
	}

	if len(votes) != 0 {
		t.Errorf("Got %v untallied votes for the user, expected 0 after marking votes as tallied.", len(votes))
	}
}
