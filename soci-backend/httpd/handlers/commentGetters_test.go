package handlers

import (
	"net/http/httptest"
	"testing"

	"soci-backend/models"
)

type commentsResponse struct {
	Comments []struct {
		ID        int    `json:"id"`
		Post      string `json:"post"`
		PostTitle string `json:"post_title"`
		Content   string `json:"content"`
		User      string `json:"user"`
		Upvotes   int    `json:"upvotes"`
	} `json:"comments"`
}

func TestGetCommentsReturnsHydratedThread(t *testing.T) {
	setupTestingDB()

	author, _ := models.UserFactory("author@example.com", "author", "password")
	commenter, _ := models.UserFactory("commenter@example.com", "commenter", "password")
	post, err := author.CreatePost("A post", "a-post", "", "content", "blog", 0, 0)
	if err != nil {
		t.Fatalf("Creating the post should work. Error: %v", err)
	}
	if _, err := commenter.CreateComment(post, nil, "first comment"); err != nil {
		t.Fatalf("Creating a comment should work. Error: %v", err)
	}
	if _, err := author.CreateComment(post, nil, "author replies"); err != nil {
		t.Fatalf("Creating a comment should work. Error: %v", err)
	}

	rec := httptest.NewRecorder()
	GetComments(rec, httptest.NewRequest("GET", "/comments?post=a-post", nil))
	if rec.Code != 200 {
		t.Fatalf("GET /comments should answer 200, got %v: %s", rec.Code, rec.Body.String())
	}

	response := commentsResponse{}
	if err := decodeBody(rec, &response); err != nil {
		t.Fatalf("The response should be valid JSON. Error: %v", err)
	}
	if len(response.Comments) != 2 {
		t.Fatalf("Expected 2 comments, got %v", len(response.Comments))
	}
	users := map[string]bool{}
	for _, c := range response.Comments {
		users[c.User] = true
		if c.Post != "a-post" {
			t.Errorf("Every comment should reference its hydrated post url, got %q", c.Post)
		}
		if c.PostTitle != "A post" {
			t.Errorf("Every comment should reference its hydrated post title, got %q", c.PostTitle)
		}
	}
	if !users["author"] || !users["commenter"] {
		t.Errorf("Both hydrated authors should appear, got %v", users)
	}
}

func TestGetCommentsForUserHistory(t *testing.T) {
	setupTestingDB()

	author, _ := models.UserFactory("author@example.com", "author", "password")
	commenter, _ := models.UserFactory("commenter@example.com", "commenter", "password")
	post1, _ := author.CreatePost("Post one", "post-one", "", "content", "blog", 0, 0)
	post2, _ := author.CreatePost("Post two", "post-two", "", "content", "blog", 0, 0)
	commenter.CreateComment(post1, nil, "on the first post")
	commenter.CreateComment(post2, nil, "on the second post")

	rec := httptest.NewRecorder()
	GetComments(rec, httptest.NewRequest("GET", "/comments?user=commenter", nil))

	response := commentsResponse{}
	if err := decodeBody(rec, &response); err != nil {
		t.Fatalf("The response should be valid JSON. Error: %v", err)
	}
	if len(response.Comments) != 2 {
		t.Fatalf("Expected the commenter's 2 comments, got %v", len(response.Comments))
	}
	posts := map[string]bool{}
	for _, c := range response.Comments {
		posts[c.Post] = true
	}
	// posts are batch-hydrated even when the comments span multiple posts
	if !posts["post-one"] || !posts["post-two"] {
		t.Errorf("Comments should reference both hydrated posts, got %v", posts)
	}
}

func TestGetCommentsForUnknownPost(t *testing.T) {
	setupTestingDB()

	rec := httptest.NewRecorder()
	GetComments(rec, httptest.NewRequest("GET", "/comments?post=missing", nil))
	if rec.Code != 500 {
		t.Errorf("An unknown post currently answers 500, got %v", rec.Code)
	}
}
