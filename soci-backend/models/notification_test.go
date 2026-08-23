package models

import (
	"testing"
)

func TestWeCanGetNotifications(t *testing.T) {
	setupTestingDB()

	user1, _ := UserFactory("example1@example.com", "ralph", "password")
	user2, _ := UserFactory("example2@example.com", "joey", "password")

	post, _ := user1.CreatePost("Post Title", "post-title", "", "lorem ipsum", "image", 0, 0)
	user2.CreateComment(post, nil, "This is a lovely post")

	notifications, err := user1.GetNotifications(nil)
	if err != nil {
		t.Errorf("Error getting notifications for the user.")
	}

	if len(notifications) != 1 {
		t.Errorf("Got %v notifications for the user, expected 1.", len(notifications))
	}
}

func TestWeCanMarkNotificationAsRead(t *testing.T) {
	setupTestingDB()

	user1, _ := UserFactory("example1@example.com", "ralph", "password")
	user2, _ := UserFactory("example2@example.com", "joey", "password")

	post, _ := user1.CreatePost("Post Title", "post-title", "", "lorem ipsum", "image", 0, 0)
	user2.CreateComment(post, nil, "This is a lovely post")

	notifications, err := user1.GetNotifications(nil)
	if err != nil {
		t.Errorf("Error getting notifications for the user.")
	}

	if notifications[0].Read != false {
		t.Errorf("Notification should have not been marked as read. Got %v instead.", notifications[0].Read)
	}

	err = notifications[0].MarkRead()
	if err != nil {
		t.Errorf("Error marking notification as read. %v", err)
	}

	notifications[0].FindByID(notifications[0].ID)
	if notifications[0].Read != true {
		t.Errorf("Notification should have been marked as read. Got %v instead.", notifications[0].Read)
	}
}
