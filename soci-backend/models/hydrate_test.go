package models

import (
	"encoding/json"
	"strconv"
	"strings"
	"testing"
)

func TestGetUsersByIDs(t *testing.T) {
	setupTestingDB()

	a, _ := UserFactory("a@example.com", "usera", "password")
	b, _ := UserFactory("b@example.com", "userb", "password")

	users, err := GetUsersByIDs([]int{a.ID, b.ID, 99999})
	if err != nil {
		t.Fatalf("Batch fetching users should work. Error: %v", err)
	}
	if len(users) != 2 {
		t.Errorf("Expected 2 users, got %v", len(users))
	}
	if users[a.ID].Username != "usera" || users[b.ID].Username != "userb" {
		t.Errorf("Users should be keyed by their IDs: %v", users)
	}

	// an empty id list shouldn't hit the DB or error
	users, err = GetUsersByIDs(nil)
	if err != nil || len(users) != 0 {
		t.Errorf("Empty input should return an empty map. Got %v, %v", users, err)
	}
}

func TestGetPostsByIDs(t *testing.T) {
	setupTestingDB()

	author, _ := UserFactory("example@example.com", "author", "password")
	p1, _ := author.CreatePost("First", "first", "", "content", "image", 0, 0)
	p2, _ := author.CreatePost("Second", "second", "", "content", "image", 0, 0)

	posts, err := GetPostsByIDs([]int{p1.ID, p2.ID})
	if err != nil {
		t.Fatalf("Batch fetching posts should work. Error: %v", err)
	}
	if len(posts) != 2 || posts[p1.ID].Title != "First" || posts[p2.ID].Title != "Second" {
		t.Errorf("Posts should be keyed by their IDs: %v", posts)
	}
}

func TestGetPostTagsForPosts(t *testing.T) {
	setupTestingDB()

	author, _ := UserFactory("example@example.com", "author", "password")
	p1, _ := author.CreatePost("First", "first", "", "content", "image", 0, 0)
	p2, _ := author.CreatePost("Second", "second", "", "content", "image", 0, 0)
	funny, _ := TagFactory("funny", author)
	sad, _ := TagFactory("sad", author)
	PostTagFactory(p1.ID, funny.ID)
	PostTagFactory(p1.ID, sad.ID)
	PostTagFactory(p2.ID, funny.ID)

	tags, err := GetPostTagsForPosts([]int{p1.ID, p2.ID})
	if err != nil {
		t.Fatalf("Batch fetching post tags should work. Error: %v", err)
	}
	if len(tags[p1.ID]) != 2 {
		t.Errorf("Expected 2 tags on the first post, got %v", len(tags[p1.ID]))
	}
	if len(tags[p2.ID]) != 1 || tags[p2.ID][0].TagName != "funny" {
		t.Errorf("Expected the second post to have the 'funny' tag, got %v", tags[p2.ID])
	}
}

func TestHydratePostsFillsTagsAndAuthors(t *testing.T) {
	setupTestingDB()

	alice, _ := UserFactory("alice@example.com", "alice", "password")
	bob, _ := UserFactory("bob@example.com", "bob", "password")
	p1, _ := alice.CreatePost("Alices post", "alices-post", "", "content", "image", 0, 0)
	bob.CreatePost("Bobs post", "bobs-post", "", "content", "image", 0, 0)
	tag, _ := TagFactory("funny", alice)
	PostTagFactory(p1.ID, tag.ID)

	posts, err := GetPostsByParams(&PostQueryParams{Since: "2000-01-01 00:00:00", Sort: "new"})
	if err != nil {
		t.Fatalf("Querying posts should work. Error: %v", err)
	}
	if len(posts) != 2 {
		t.Fatalf("Expected 2 posts, got %v", len(posts))
	}

	if err := HydratePosts(posts); err != nil {
		t.Fatalf("Hydrating posts should work. Error: %v", err)
	}

	for _, p := range posts {
		if p.Author.ID == 0 {
			t.Errorf("The author of post %v should be hydrated", p.ID)
		}
		if p.Tags == nil {
			t.Errorf("Tags of post %v should be non-nil after hydration (empty is fine)", p.ID)
		}
	}

	// the JSON output must carry the hydrated usernames and tags
	data, err := json.Marshal(posts)
	if err != nil {
		t.Fatalf("Marshaling hydrated posts should work. Error: %v", err)
	}
	out := string(data)
	if !strings.Contains(out, `"user":"alice"`) || !strings.Contains(out, `"user":"bob"`) {
		t.Errorf("Marshaled posts should contain hydrated author names: %v", out)
	}
	if !strings.Contains(out, `"tag":"funny"`) {
		t.Errorf("Marshaled posts should contain the hydrated tag: %v", out)
	}

	// hydrated output must be identical to what lazy per-post loading produces
	lazyPosts, _ := GetPostsByParams(&PostQueryParams{Since: "2000-01-01 00:00:00", Sort: "new"})
	lazyData, err := json.Marshal(lazyPosts)
	if err != nil {
		t.Fatalf("Marshaling lazy posts should work. Error: %v", err)
	}
	if out != string(lazyData) {
		t.Errorf("Hydrated and lazy responses should be byte-identical.\nHydrated: %s\n    Lazy: %s", out, lazyData)
	}
}

func TestHydrateCommentsFillsAuthorsAndPosts(t *testing.T) {
	setupTestingDB()

	alice, _ := UserFactory("alice@example.com", "alice", "password")
	bob, _ := UserFactory("bob@example.com", "bob", "password")
	post, _ := alice.CreatePost("A post", "a-post", "", "content", "image", 0, 0)

	for i := 0; i < 3; i++ {
		if _, err := bob.CreateComment(post, nil, "comment "+strconv.Itoa(i)); err != nil {
			t.Fatalf("Creating a comment should work. Error: %v", err)
		}
	}

	comments, err := GetCommentsByParams(&CommentQueryParams{PostID: post.ID, Sort: "top"})
	if err != nil {
		t.Fatalf("Querying comments should work. Error: %v", err)
	}
	if len(comments) != 3 {
		t.Fatalf("Expected 3 comments, got %v", len(comments))
	}

	// pass the already-loaded post so no per-comment post queries are needed
	if err := HydrateComments(comments, &post); err != nil {
		t.Fatalf("Hydrating comments should work. Error: %v", err)
	}
	for _, c := range comments {
		if c.Author.Username != "bob" {
			t.Errorf("Comment author should be hydrated to bob, got %v", c.Author.Username)
		}
		if c.Post.ID != post.ID {
			t.Errorf("Comment post should be the passed-in post")
		}
	}

	data, err := json.Marshal(comments)
	if err != nil {
		t.Fatalf("Marshaling hydrated comments should work. Error: %v", err)
	}
	if !strings.Contains(string(data), `"post":"a-post"`) {
		t.Errorf("Marshaled comments should reference the hydrated post url: %s", data)
	}

	// without a post filter (user comment history), posts are batch-loaded
	comments, _ = GetCommentsByParams(&CommentQueryParams{UserID: bob.ID, Sort: "new"})
	if err := HydrateComments(comments, nil); err != nil {
		t.Fatalf("Hydrating comments without a post should work. Error: %v", err)
	}
	for _, c := range comments {
		if c.Post.URL != "a-post" {
			t.Errorf("Comment posts should be batch-hydrated, got %v", c.Post.URL)
		}
	}
}

func TestHydrateCommentsHandlesAbandonedAuthors(t *testing.T) {
	setupTestingDB()

	alice, _ := UserFactory("alice@example.com", "alice", "password")
	post, _ := alice.CreatePost("A post", "a-post", "", "content", "image", 0, 0)
	comment, _ := alice.CreateComment(post, nil, "soon to be abandoned")
	if err := alice.AbandonComment(&comment); err != nil {
		t.Fatalf("Abandoning the comment should work. Error: %v", err)
	}

	comments, _ := GetCommentsByParams(&CommentQueryParams{PostID: post.ID, Sort: "top"})
	if err := HydrateComments(comments, &post); err != nil {
		t.Fatalf("Hydrating abandoned comments should work. Error: %v", err)
	}

	data, err := json.Marshal(comments)
	if err != nil {
		t.Fatalf("Marshaling should work. Error: %v", err)
	}
	if !strings.Contains(string(data), "Anonymous coward") {
		t.Errorf("Abandoned comments should marshal with the anonymous author: %s", data)
	}
}
