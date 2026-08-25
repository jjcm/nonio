package models

import (
	"strconv"
	"testing"
	"time"
)

func TestWeCanCreateAPost(t *testing.T) {
	setupTestingDB()

	// create an author for post
	author, _ := UserFactory("example@example.com", "", "password")
	p, err := author.CreatePost("Post Title", "post-title", "", "lorem ipsum", "image", 0, 0)
	if err != nil {
		t.Errorf("Post creation should have worked. Error recieved: %v", err)
	}
	if p.Title != "Post Title" {
		t.Errorf("The post that is returned should be the newly created post")
	}
	if p.Author.ID != author.ID {
		t.Errorf("The author associated with this post should be hydrated automatically")
	}
}

func TestWeCantCreateAPostWithAnInvalidURL(t *testing.T) {
	setupTestingDB()

	// create an author for post
	author, _ := UserFactory("example@example.com", "", "password")
	_, err := author.CreatePost("Post Title", "post title", "", "lorem ipsum", "image", 0, 0)
	if err == nil {
		t.Errorf("Posts should not be able to be made with spaces in the url")
	}
}

func TestWeCantCreateAPostWithAnInvalidTitle(t *testing.T) {
	setupTestingDB()

	// create an author for post
	author, _ := UserFactory("example@example.com", "", "password")
	_, err := author.CreatePost("", "post", "", "lorem ipsum", "image", 0, 0)
	if err == nil {
		t.Errorf("Posts should not be able to be made with no title")
	}
}

func TestWeCanIncrementScoreForPost(t *testing.T) {
	setupTestingDB()

	// create an author for post
	author, _ := UserFactory("example@example.com", "", "password")
	author.CreatePost("Post Title", "post-title", "", "lorem ipsum", "image", 0, 0)

	p := Post{}
	if err := p.FindByURL("post-title"); err != nil {
		t.Errorf("Find post by url: %v", err)
		return
	}
	if err := p.IncrementScore(p.ID); err != nil {
		t.Errorf("Increment score: %v", err)
		return
	}
	p.FindByURL("post-title")
	if p.Score != 1 {
		t.Errorf("Expected Score of 1. Got %v instead", p.Score)
	}

}

func TestWeCanFindAPostByItsURL(t *testing.T) {
	setupTestingDB()

	// create an author for post
	author, _ := UserFactory("example@example.com", "", "password")
	author.CreatePost("Post Title", "post-title", "", "lorem ipsum", "image", 0, 0)

	p := Post{}
	p.FindByURL("post-title")

	if p.ID == 0 {
		t.Errorf("We should have been able to find this post by it's ID")
	}
}

func TestWeCanFindAPostByItsID(t *testing.T) {
	setupTestingDB()

	// create an author for post
	author, _ := UserFactory("example@example.com", "", "password")
	post, err := author.CreatePost("Post Title", "post-title", "", "lorem ipsum", "image", 0, 0)
	if err != nil {
		t.Errorf("Error when creating post: %s", err.Error())
	}

	p := Post{}
	p.FindByID(1)

	if p.ID != post.ID {
		t.Errorf("We should have been able to find this post by it's ID. Expected: 1, Actual: %d", p.ID)
	}
}

func TestWhenWeMarshalAPostToJSONItHasTheShapeThatWeExpect(t *testing.T) {
	setupTestingDB()

	// create an author for post
	author, _ := UserFactory("example@example.com", "userName", "password")
	p, err := author.CreatePost("Post Title", "post-title", "", "lorem ipsum", "image", 0, 0)
	if err != nil {
		t.Errorf("We should be able to create a post. Error: %v", err)
	}

	expectedJSON := `{"ID":1,"title":"Post Title","user":"userName","time":` + strconv.Itoa(int(p.GetCreatedAtTimestamp())) + `,"url":"post-title","link":"","content":"lorem ipsum","type":"image","score":0,"commentCount":0,"tags":[],"width":0,"height":0,"isEncoding":false}`

	if p.ToJSON() != expectedJSON {
		t.Errorf("JSON output wasn't what we expected it to be.\nExpected: %v\nActual:   %v", expectedJSON, p.ToJSON())
	}
}

func TestWeTagAPost(t *testing.T) {
	setupTestingDB()

	// create an author for post
	author, _ := UserFactory("example@example.com", "", "password")
	author.CreatePost("Post Title", "post-title", "", "lorem ipsum", "image", 0, 0)

	p := Post{}
	p.FindByURL("post-title")

	tag, err := TagFactory("Tag!", author)
	if err != nil {
		t.Errorf("Error creating tag. Error: %v ID: %v", err.Error(), tag.ID)
	}

	err = p.AddTag(tag)
	if err != nil {
		t.Errorf("We should be able to tag this freshly created post. Error: %v", err.Error())
	}
	if len(p.Tags) != 1 {
		t.Errorf("We expected that the post should now have 1 tag associated with it. Post tag count is %v", len(p.Tags))
	}
}

func TestWeCantTagAPostWithTheSameTagMoreThanOneTime(t *testing.T) {
	setupTestingDB()

	// create an author for post
	author, _ := UserFactory("example@example.com", "", "password")
	author.CreatePost("Post Title", "post-title", "", "lorem ipsum", "image", 0, 0)

	p := Post{}
	p.FindByURL("post-title")

	tag, _ := TagFactory("Tag!", author)

	err := p.AddTag(tag)
	if err != nil {
		t.Errorf("We should be able to tag this freshly created post. Error: %v", err.Error())
	}
	if len(p.Tags) != 1 {
		t.Errorf("We expected that the post should now have 1 tag associated with it. Post tag count is %v", len(p.Tags))
	}

	err = p.AddTag(tag)
	if err == nil {
		t.Errorf("The tag has already been tagged with this tag, an error should have occured")
	}
	if len(p.Tags) != 1 {
		t.Errorf("We expected that the post should now have 1 tag associated with it. Post tag count is %v", len(p.Tags))
	}
}

func TestIfWeCreateAPostWithTheSameURLTheSystemWillGenerateAUniqueOne(t *testing.T) {
	setupTestingDB()

	// create an author for post
	author, _ := UserFactory("example@example.com", "", "password")
	p1, err := author.CreatePost("Post Title", "post-title", "", "lorem ipsum", "image", 0, 0)
	if err != nil {
		t.Errorf("Post creation should have worked. Error recieved: %v", err)
	}
	if p1.URL != "post-title" {
		t.Errorf("The post that is returned should be the newly created post")
	}

	// now let's create a second post with the same title
	p2, err := author.CreatePost("Post Title", "post-title", "", "Dolor sit amit", "image", 0, 0)
	if err != nil {
		t.Errorf("Post creation should have worked. Error recieved: %v", err)
	}
	if p2.URL != "post-title-2" {
		t.Errorf("The URL for the second post should be different from the original created post. Post2 url: %v", p2.URL)
	}

	// now let's create a third post with the same title
	p3, err := author.CreatePost("Post Title", "post-title", "", "Dolor sit amit", "image", 0, 0)
	if err != nil {
		t.Errorf("Post creation should have worked. Error recieved: %v", err)
	}
	if p3.URL != "post-title-3" {
		t.Errorf("The URL for the third post should be different from the original created post. Post3 url: %v", p2.URL)
	}
}

func TestIfAPostIsCreatedWithAnEmptyTypeItGetsSetToTheDefaultTypeImage(t *testing.T) {
	setupTestingDB()

	// create an author for post
	author, _ := UserFactory("example@example.com", "", "password")
	p, err := author.CreatePost("Title", "post-title", "", "lorem ipsum", "", 0, 0) // note the empty 3rd param
	if err != nil {
		t.Errorf("Post creation should have worked. Error recieved: %v", err)
	}
	if p.Type != "image" {
		t.Errorf("The post type should be the default `Image`. Type is: %v", p.Type)
	}
}

func TestWeCanQueryPost(t *testing.T) {
	setupTestingDB()

	/*
		This is going to test a myriad of the /posts calls. We're also going to set up the database with two posts, and two tags.
		Each post will have two PostTags, with one primary tag that relates to it the most. Here's what we're aiming for:

		[
			{
				title: "Post thats arty",
				score: 7,
				tags: [
					{ name: "arty", score: 7 },
				]
			},
			{
				title: "Post thats funny",
				score: 6,
				tags: [
					{ name: "funny" score: 6 }
				]
			},
			{
				title: "Post thats both",
				score: 10,
				tags: [
					{ name: "arty" score: 5 }
					{ name: "funny" score: 5 }
				]
			}
		]
	*/

	p := Post{}

	// create two authors for posts
	author1, _ := UserFactory("example@example.com", "user1", "password")
	author2, _ := UserFactory("example2@example.com", "user2", "password")

	// create some posts
	author1.CreatePost("Post thats arty", "url1", "", "lorem ipsum", "image", 0, 0)

	// add a light delay. We'll use this in the "since" test later.
	time.Sleep(1 * time.Second)
	inBetweenTime := time.Now().Format("2006-01-02 15:04:05")
	time.Sleep(1 * time.Second)

	author2.CreatePost("Post thats both", "url2", "", "lorem ipsum", "image", 0, 0)
	time.Sleep(1 * time.Second)
	author1.CreatePost("Post thats funny", "url3", "", "lorem ipsum", "image", 0, 0)

	// create a set of tags
	artTag, _ := TagFactory("art", author1)
	funnyTag, _ := TagFactory("funny", author2)

	// Create PostTag for the arty post
	artyPostTag, _ := PostTagFactory(1, artTag.ID)

	testPostTag := PostTag{}
	testPostTag.FindByID(1)

	testTag := Tag{}
	testTag.FindByID(1)

	p.IncrementScore(1)
	for i := 1; i < 7; i++ {
		artyPostTag.IncrementScore(1, artTag.ID)
		p.IncrementScore(1)
	}

	// Create PostTag for the funny post
	funnyPostTag, _ := PostTagFactory(3, funnyTag.ID)
	p.IncrementScore(3)
	for i := 1; i < 6; i++ {
		funnyPostTag.IncrementScore(3, funnyTag.ID)
		p.IncrementScore(3)
	}

	// Create PostTags for the both post
	artyPostTag2, _ := PostTagFactory(2, artTag.ID)
	funnyPostTag2, _ := PostTagFactory(2, funnyTag.ID)
	p.IncrementScore(2)
	for i := 1; i < 5; i++ {
		artyPostTag2.IncrementScore(2, artTag.ID)
		p.IncrementScore(2)
		funnyPostTag2.IncrementScore(2, funnyTag.ID)
		p.IncrementScore(2)
	}

	// Test querying for posts
	postQueryParams := PostQueryParams{}
	var params *PostQueryParams = &postQueryParams
	posts, err := GetPostsByParams(params)

	if err != nil {
		t.Errorf("Default query failed. Error querying posts via params: %v", err)
	}

	if len(posts) != 3 {
		t.Errorf("Default query failed. Expected 3 posts, got %v instead", len(posts))
		for i := 0; i < len(posts); i++ {
			t.Logf("ID: %v - %v", posts[i].ID, posts[i].ToJSON())
		}
	}

	// Test querying with a tag
	postQueryParams.TagID = funnyTag.ID
	posts, err = GetPostsByParams(params)

	if err != nil {
		t.Errorf("Querying with a tag failed. Error querying posts via params: %v", err)
	}

	if len(posts) != 2 {
		for i := 0; i < len(posts); i++ {
			t.Logf("ID: %v - %v", posts[i].ID, posts[i].ToJSON())
		}
		t.Errorf("Querying with a tag failed. Expected 2 posts, got %v instead", len(posts))
	}

	postQueryParams.TagID = 0

	// Test querying with a user
	postQueryParams.UserID = author2.ID
	posts, err = GetPostsByParams(params)

	if err != nil {
		t.Errorf("Querying with a user failed. Error querying posts via params: %v", err)
	}

	if len(posts) != 1 {
		t.Errorf("Querying with a user failed. Expected 1 post, got %v instead", len(posts))
		for i := 0; i < len(posts); i++ {
			t.Logf("ID: %v - %v", posts[i].ID, posts[i].ToJSON())
		}
	}
	postQueryParams.UserID = 0

	// Test querying with a new sort
	postQueryParams.Sort = "new"
	posts, err = GetPostsByParams(params)

	if err != nil {
		t.Errorf("Querying with a new sort failed. Error querying posts via params: %v", err)
	}

	if len(posts) > 0 && posts[0].ID != 3 {
		t.Errorf("Querying with a new sort failed. Expected the first post to have an ID of 3. Got %v instead", posts[0].ID)
		for i := 0; i < len(posts); i++ {
			t.Logf("ID: %v - %v", posts[i].ID, posts[i].ToJSON())
		}
	}

	// Test querying with a popular sort
	postQueryParams.Sort = "popular"
	posts, err = GetPostsByParams(params)

	if err != nil {
		t.Errorf("Querying with a popular sort failed. Error querying posts via params: %v", err)
	}

	if len(posts) > 0 && posts[0].ID != 2 {
		t.Errorf("Querying with a popular sort failed. Expected the first post to have an ID of 2. Got %v instead", posts[0].ID)
		for i := 0; i < len(posts); i++ {
			t.Logf("ID: %v - %v", posts[i].ID, posts[i].ToJSON())
		}
	}

	// Test querying with a top sort
	postQueryParams.Sort = "top"
	posts, err = GetPostsByParams(params)

	if err != nil {
		t.Errorf("Querying with a top sort failed. Error querying posts via params: %v", err)
	}

	if len(posts) > 0 && posts[0].ID != 2 {
		t.Errorf("Querying with a top sort failed. Expected the first post to have an ID of 2. Got %v instead", posts[0].ID)
		for i := 0; i < len(posts); i++ {
			t.Logf("ID: %v - %v", posts[i].ID, posts[i].ToJSON())
		}
	}
	postQueryParams.Sort = ""

	// Test querying with an offset
	postQueryParams.Offset = 1
	posts, err = GetPostsByParams(params)

	if err != nil {
		t.Errorf("Querying with an offset failed. Error querying posts via params: %v", err)
	}

	if len(posts) != 2 {
		t.Errorf("Querying with an offset failed. Expected 2 posts. Got %v instead", len(posts))
		for i := 0; i < len(posts); i++ {
			t.Logf("ID: %v - %v", posts[i].ID, posts[i].ToJSON())
		}
	}
	postQueryParams.Offset = 0

	// Test querying with an offset
	postQueryParams.Since = inBetweenTime
	time.Sleep(1 * time.Second)
	posts, err = GetPostsByParams(params)

	if err != nil {
		t.Errorf("Querying posts since 1 second ago failed. Error querying posts via params: %v", err)
	}

	if len(posts) != 2 {
		t.Errorf("Querying posts since 1 second ago failed. Expected 2 posts. Got %v instead", len(posts))
		for i := 0; i < len(posts); i++ {
			t.Logf("ID: %v - %v", posts[i].ID, posts[i].ToJSON())
		}
	}

}
