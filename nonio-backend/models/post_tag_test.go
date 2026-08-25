package models

import "testing"

func TestPostTagFactory(t *testing.T) {
	setupTestingDB()

	_, err := PostTagFactory(1, 1)

	if err != nil {
		t.Errorf("PostTag creation via Factory should have worked: %v", err)
	}
}

func TestWeCanFindPostTagByID(t *testing.T) {
	setupTestingDB()

	// create the PostTag first
	_, err := PostTagFactory(1, 1)

	if err != nil {
		t.Errorf("PostTag creation should have worked: %v", err)
	}

	p := &PostTag{}
	p.FindByID(1)

	if p.ID == 0 {
		t.Errorf("We should have been able to find this PostTag by it's ID. Post ID: %v", p.ID)
	}
}

func TestWeCanFindPostTagByUK(t *testing.T) {
	setupTestingDB()

	// create the PostTag first
	_, err := PostTagFactory(1, 1)

	if err != nil {
		t.Errorf("PostTag creation should have worked: %v", err)
	}

	p := &PostTag{}
	p.FindByUK(1, 1)
	if p.ID == 0 {
		t.Errorf("We should have been able to find this PostTag by PostID and TagID")
	}
}

func TestWeCanCreatePostTag(t *testing.T) {
	setupTestingDB()

	p := &PostTag{
		PostID: 1,
		TagID:  1,
	}
	if err := p.createPostTag(); err != nil {
		t.Errorf("PostTag creation should have worked: %v", err)
	}
}

func TestWeCanIncrementScoreForPostTag(t *testing.T) {
	setupTestingDB()

	// create the PostTag first
	item, err := PostTagFactory(1, 1)

	if err != nil {
		t.Errorf("PostTag creation should have worked: %v", err)
	}

	if err := item.IncrementScore(item.PostID, item.TagID); err != nil {
		t.Errorf("Increment score: %v", err)
	}
}
