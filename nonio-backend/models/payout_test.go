package models

import (
	"testing"
	"time"
)

func TestWeCanProcessPayouts(t *testing.T) {
	setupTestingDB()

	user1, _ := UserFactory("example1@example.com", "ralph", "password")
	user2, _ := UserFactory("example2@example.com", "joey", "password")
	user3, _ := UserFactory("example3@example.com", "bobby", "password")

	post1, _ := user1.CreatePost("Post Title", "test-post-1", "", "lorem ipsum", "image", 0, 0)
	post2, _ := user2.CreatePost("Post Title", "test-post-2", "", "lorem ipsum", "image", 0, 0)
	post3, _ := user3.CreatePost("Post Title", "test-post-3", "", "lorem ipsum", "image", 0, 0)

	// User 1 votes on all 3 posts (including their own). Expected payout is $5 each
	user1.CreatePostTagVote(post1.ID, 1)
	user1.CreatePostTagVote(post2.ID, 1)
	user1.CreatePostTagVote(post3.ID, 1)

	// User 2 votes on only user 3's post. Expected payout is $20
	user2.CreatePostTagVote(post3.ID, 1)

	// User 3 votes on user 1 and user 2's posts. They vote for two tags on user 2's posts. Expected payout is $2 each
	user3.CreatePostTagVote(post1.ID, 1)
	user3.CreatePostTagVote(post2.ID, 1)
	user3.CreatePostTagVote(post2.ID, 2)

	time.Sleep(1 * time.Second)

	user1.CreateFuturePayout(10, time.Now())
	user2.CreateFuturePayout(20, time.Now())
	user3.CreateFuturePayout(4, time.Now())

	ProcessPayouts()

	if cash, _ := user1.GetCash(); cash != 2 {
		t.Errorf("Cash of user 1 expected to be $2, instead got: %v", cash)
	}

	if cash, _ := user2.GetCash(); cash != 7 {
		t.Errorf("Cash of user 2 expected to be $7, instead got: %v", cash)
	}

	if cash, _ := user3.GetCash(); cash != 25 {
		t.Errorf("Cash of user 3 expected to be $25, instead got: %v", cash)
	}

	// Check the ledger entries for each user

	ledger1, err := user1.GetLedgerEntries()
	if err != nil {
		t.Errorf("Error getting ledger entries for user 1: %v", err)
	}

	if len(ledger1) != 1 {
		for _, ledger := range ledger1 {
			t.Errorf("Ledger entry: %v", ledger.Description)
		}
		t.Errorf("User 1 should have 1 ledger entry, instead has %v", len(ledger1))
	}

	ledger2, err := user2.GetLedgerEntries()
	if err != nil {
		t.Errorf("Error getting ledger entries for user 2: %v", err)
	}

	if len(ledger2) != 2 {
		for _, ledger := range ledger2 {
			t.Errorf("Ledger entry: %v", ledger.Description)
		}
		t.Errorf("User 2 should have 1 ledger entry, instead has %v", len(ledger2))
	}

	ledger3, err := user3.GetLedgerEntries()
	if err != nil {
		t.Errorf("Error getting ledger entries for user 3: %v", err)
	}

	if len(ledger3) != 2 {
		for _, ledger := range ledger3 {
			t.Errorf("Ledger entry: %v", ledger.Description)
		}

		t.Errorf("User 3 should have 1 ledger entry, instead has %v", len(ledger3))
	}
}
