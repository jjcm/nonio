package models

import (
	"testing"
)

func TestWeCanCreateASubscription(t *testing.T) {
	setupTestingDB()

	// create a user and a tag
	user, _ := UserFactory("example@example.com", "", "password")
	tag, _ := TagFactory("funny", user)

	// use our subscription factory to make a new subscription
	subscription, err := user.CreateSubscription(tag)
	if err != nil {
		t.Errorf("Subscription creation should have worked. Error recieved: %v", err)
	}
	if subscription.TagID != tag.ID {
		t.Errorf("The tag should have been hydrated.")
	}
	if subscription.UserID != user.ID {
		t.Errorf("The user associated with this subscription should be hydrated automatically")
	}
}

func TestWeCanDeleteASubscription(t *testing.T) {
	setupTestingDB()

	// create a user and a tag
	user, _ := UserFactory("example@example.com", "", "password")
	tag, _ := TagFactory("funny", user)

	// use our subscription factory to make a new subscription
	if _, err := user.CreateSubscription(tag); err != nil {
		t.Errorf("Subscription creation should have worked. Error recieved: %v", err)
	}
	if err := user.DeleteSubscription(tag); err != nil {
		t.Errorf("Subscription deletion should have worked. Error recieved: %v", err)
	}

	subscription := Subscription{}
	if err := subscription.FindSubscription(tag.ID, user.ID); err == nil {
		t.Errorf("The lookup should have thrown a no rows in result error. Error received: %v", err)
	}
}

func TestSubscriptionsAreCommunityScoped(t *testing.T) {
	setupTestingDB()

	user, _ := UserFactory("example@example.com", "", "password")
	c1, _ := user.CreateCommunity("Community 1", "community-1", "", "public")
	c2, _ := user.CreateCommunity("Community 2", "community-2", "", "public")

	t1, _ := TagFactory("baseball", user, c1.ID)
	t2, _ := TagFactory("baseball", user, c2.ID)

	if _, err := user.CreateSubscription(t1); err != nil {
		t.Errorf("Subscription creation in c1 should have worked. Error received: %v", err)
	}
	if _, err := user.CreateSubscription(t2); err != nil {
		t.Errorf("Subscription creation in c2 should have worked. Error received: %v", err)
	}

	s1, err := user.GetSubscriptions(c1.ID)
	if err != nil {
		t.Errorf("GetSubscriptions(c1) failed: %v", err)
	}
	if len(s1) != 1 || s1[0].TagID != t1.ID {
		t.Errorf("Expected only the c1 tag subscription. Got %v", len(s1))
	}

	s2, err := user.GetSubscriptions(c2.ID)
	if err != nil {
		t.Errorf("GetSubscriptions(c2) failed: %v", err)
	}
	if len(s2) != 1 || s2[0].TagID != t2.ID {
		t.Errorf("Expected only the c2 tag subscription. Got %v", len(s2))
	}
}
