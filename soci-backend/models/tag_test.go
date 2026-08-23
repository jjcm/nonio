package models

import (
	"fmt"
	"testing"

	"github.com/icrowley/fake"
)

func TestCanGetTags(t *testing.T) {
	setupTestingDB()

	tags, _ := GetTags(0, 100)
	if len(tags) != 0 {
		t.Errorf("There should not be any tags in a fresh DB")
	}

	// create an author for tags
	author, _ := UserFactory("example@example.com", "", "password")

	// Create enough distinct tags with count>0 so GetTags(limit, offset) is meaningful.
	// (Use deterministic unique names so the test is fast and stable.)
	limit := 120
	for i := 0; i < limit; i++ {
		tag, err := TagFactory(fmt.Sprintf("tag-%d", i), author)
		if err != nil {
			t.Errorf("Error creating tag: %v", err.Error())
		}
		if err := WithTransaction(func(tx Transaction) error {
			postTag := PostTag{PostID: i + 1, TagID: tag.ID}
			return postTag.CreatePostTagWithTx(tx)
		}); err != nil {
			t.Errorf("Error creating post tag: %v", err.Error())
		}
	}

	batch1, err := GetTags(0, 100)
	if err != nil {
		t.Errorf("We should be able to get a batch of tags from the DB, instead we got an error: %v", err.Error())
	}
	if len(batch1) != 100 {
		t.Errorf("We should have only retrieved 100 tags. Instead we retrieved %v", len(batch1))
	}
}

func TestWeCanCreateAndRetrieveATag(t *testing.T) {
	setupTestingDB()

	// create our author
	author, _ := UserFactory("example@example.com", "", "password")

	newTag := fake.Word()
	_, err := TagFactory(newTag, author)
	if err != nil {
		t.Errorf("You should be able to create a new tag with a given string")
	}

	tag := Tag{}
	err = tag.FindByTagName(newTag)
	if err != nil {
		t.Errorf("We should have been able to find the newly created tag in the DB")
	}
	if tag.Name != newTag {
		t.Errorf("The struct was not hydrated correctly. Expected '%v', got '%v'", newTag, tag.Name)
	}
}

func TestYouCantCreateATagWithTheNameOfAnExistingTag(t *testing.T) {
	setupTestingDB()

	// create our author
	author, _ := UserFactory("example@example.com", "", "password")

	newTag := fake.Word()
	tag1, err := TagFactory(newTag, author)
	if err != nil {
		t.Errorf("The initial creation of a tag should have worked fine")
	}

	// try it again (should resolve existing tag)
	tag2, err := TagFactory(newTag, author)
	if err != nil {
		t.Errorf("Creating an existing tag should return the existing row, not error: %v", err)
	}
	if tag1.ID == 0 || tag2.ID == 0 || tag1.ID != tag2.ID {
		t.Errorf("Expected both tag instances to resolve to the same ID. Got %d and %d", tag1.ID, tag2.ID)
	}
}

func TestSameTagNameCanExistInDifferentCommunities(t *testing.T) {
	setupTestingDB()

	author, _ := UserFactory("example@example.com", "", "password")
	c1, err := author.CreateCommunity("Community 1", "community-1", "", "public")
	if err != nil {
		t.Errorf("Community 1 creation should have worked. Error received: %v", err)
	}
	c2, err := author.CreateCommunity("Community 2", "community-2", "", "public")
	if err != nil {
		t.Errorf("Community 2 creation should have worked. Error received: %v", err)
	}

	t1, err := TagFactory("baseball", author, c1.ID)
	if err != nil {
		t.Errorf("Tag creation in community 1 should have worked. Error received: %v", err)
	}
	t2, err := TagFactory("baseball", author, c2.ID)
	if err != nil {
		t.Errorf("Tag creation in community 2 should have worked. Error received: %v", err)
	}
	if t1.ID == 0 || t2.ID == 0 || t1.ID == t2.ID {
		t.Errorf("Expected different tag IDs across communities. Got %d and %d", t1.ID, t2.ID)
	}

	check := Tag{}
	_ = check.FindByTagName("baseball", c1.ID)
	if check.ID != t1.ID {
		t.Errorf("Expected community 1 lookup to return %d, got %d", t1.ID, check.ID)
	}
	_ = check.FindByTagName("baseball", c2.ID)
	if check.ID != t2.ID {
		t.Errorf("Expected community 2 lookup to return %d, got %d", t2.ID, check.ID)
	}
}
