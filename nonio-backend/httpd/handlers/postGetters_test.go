package handlers

import (
	"net/http/httptest"
	"strings"
	"testing"

	"nonio-backend/models"
)

type feedResponse struct {
	Posts []struct {
		ID    int    `json:"ID"`
		Title string `json:"title"`
		User  string `json:"user"`
		URL   string `json:"url"`
		Tags  []struct {
			Tag   string `json:"tag"`
			Score int    `json:"score"`
		} `json:"tags"`
		Content string `json:"content"`
	} `json:"posts"`
}

func seedFeed(t *testing.T) models.User {
	t.Helper()
	author, err := models.UserFactory("author@example.com", "author", "password")
	if err != nil {
		t.Fatalf("Creating the author should work. Error: %v", err)
	}
	if _, err := author.CreatePost("First post", "first-post", "", "hello", "blog", 0, 0); err != nil {
		t.Fatalf("Creating a post should work. Error: %v", err)
	}
	if _, err := author.CreatePost("Second post", "second-post", "", "world", "blog", 0, 0); err != nil {
		t.Fatalf("Creating a post should work. Error: %v", err)
	}
	tag, err := models.TagFactory("funny", author)
	if err != nil {
		t.Fatalf("Creating a tag should work. Error: %v", err)
	}
	p := models.Post{}
	if err := p.FindByURL("first-post"); err != nil {
		t.Fatalf("Finding the post should work. Error: %v", err)
	}
	if _, err := models.PostTagFactory(p.ID, tag.ID); err != nil {
		t.Fatalf("Tagging the post should work. Error: %v", err)
	}
	return author
}

func TestGetPostsReturnsHydratedFeed(t *testing.T) {
	setupTestingDB()
	seedFeed(t)

	rec := httptest.NewRecorder()
	GetPosts(rec, httptest.NewRequest("GET", "/posts", nil))

	if rec.Code != 200 {
		t.Fatalf("GET /posts should answer 200, got %v: %s", rec.Code, rec.Body.String())
	}
	feed := feedResponse{}
	if err := decodeBody(rec, &feed); err != nil {
		t.Fatalf("The feed should be valid JSON. Error: %v", err)
	}
	if len(feed.Posts) != 2 {
		t.Fatalf("Expected 2 posts in the feed, got %v", len(feed.Posts))
	}
	for _, p := range feed.Posts {
		if p.User != "author" {
			t.Errorf("Every post should carry its hydrated author, got %q", p.User)
		}
	}
	var tagged, untagged bool
	for _, p := range feed.Posts {
		if p.URL == "first-post" && len(p.Tags) == 1 && p.Tags[0].Tag == "funny" {
			tagged = true
		}
		if p.URL == "second-post" && len(p.Tags) == 0 {
			untagged = true
		}
	}
	if !tagged {
		t.Errorf("The tagged post should include its tag: %s", rec.Body.String())
	}
	if !untagged {
		t.Errorf("The untagged post should have an empty tag list: %s", rec.Body.String())
	}
}

func TestGetPostsFiltersByTagAndUser(t *testing.T) {
	setupTestingDB()
	seedFeed(t)

	rec := httptest.NewRecorder()
	GetPosts(rec, httptest.NewRequest("GET", "/posts?tag=funny", nil))
	feed := feedResponse{}
	decodeBody(rec, &feed)
	if len(feed.Posts) != 1 || feed.Posts[0].URL != "first-post" {
		t.Errorf("Filtering by tag should return only the tagged post: %s", rec.Body.String())
	}

	rec = httptest.NewRecorder()
	GetPosts(rec, httptest.NewRequest("GET", "/posts?tag=nosuchtag", nil))
	feed = feedResponse{}
	decodeBody(rec, &feed)
	if len(feed.Posts) != 0 {
		t.Errorf("An unknown tag should return an empty feed: %s", rec.Body.String())
	}

	rec = httptest.NewRecorder()
	GetPosts(rec, httptest.NewRequest("GET", "/posts?user=author", nil))
	feed = feedResponse{}
	decodeBody(rec, &feed)
	if len(feed.Posts) != 2 {
		t.Errorf("Filtering by author should return both posts: %s", rec.Body.String())
	}
}

func TestGetPostsCachesAndInvalidates(t *testing.T) {
	setupTestingDB()
	author := seedFeed(t)

	rec := httptest.NewRecorder()
	GetPosts(rec, httptest.NewRequest("GET", "/posts", nil))
	first := rec.Body.String()

	// the response is now cached; a direct DB write alone won't show up...
	if _, err := author.CreatePost("Third post", "third-post", "", "sneaky", "blog", 0, 0); err != nil {
		t.Fatalf("Creating a post should work. Error: %v", err)
	}
	rec = httptest.NewRecorder()
	GetPosts(rec, httptest.NewRequest("GET", "/posts", nil))
	if rec.Body.String() != first {
		t.Errorf("The feed cache should serve the cached response for the same URL")
	}

	// ...until a write handler nukes the cache, like CreatePost does
	postCacheMu.Lock()
	PostCache = make(map[string]PostQueryResponse)
	postCacheMu.Unlock()

	rec = httptest.NewRecorder()
	GetPosts(rec, httptest.NewRequest("GET", "/posts", nil))
	if !strings.Contains(rec.Body.String(), "third-post") {
		t.Errorf("After invalidation the new post should appear: %s", rec.Body.String())
	}
}

func TestGetPostByURLReturnsFullPost(t *testing.T) {
	setupTestingDB()
	seedFeed(t)

	rec := httptest.NewRecorder()
	GetPostByURL(rec, httptest.NewRequest("GET", "/posts/first-post", nil))
	if rec.Code != 200 {
		t.Fatalf("GET /posts/first-post should answer 200, got %v", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), `"title":"First post"`) {
		t.Errorf("The post payload should include the title: %s", rec.Body.String())
	}

	rec = httptest.NewRecorder()
	GetPostByURL(rec, httptest.NewRequest("GET", "/posts/no-such-post", nil))
	if rec.Code != 404 {
		t.Errorf("A missing post should answer 404, got %v", rec.Code)
	}
}

func TestTruncateLines(t *testing.T) {
	if got := truncateLines("", 10, 2000); got != "" {
		t.Errorf("Empty content should stay empty, got %q", got)
	}
	if got := truncateLines("one\ntwo", 10, 2000); got != "one\ntwo" {
		t.Errorf("Short content should be untouched, got %q", got)
	}
	long := strings.Repeat("line\n", 20)
	got := truncateLines(long, 10, 2000)
	if strings.Count(got, "\n") > 11 || !strings.HasSuffix(got, "…") {
		t.Errorf("Long content should be truncated with an ellipsis, got %q", got)
	}
	big := strings.Repeat("x", 5000)
	got = truncateLines(big, 10, 2000)
	if len(got) > 2010 || !strings.HasSuffix(got, "…") {
		t.Errorf("Oversized content should be capped near maxChars, got %v bytes", len(got))
	}
}
