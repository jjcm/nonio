package util

import "testing"

func TestFilenameURLMappingIsBidirectional(t *testing.T) {
	SetFilenameToURL("temp123", "my-video-post")

	url, ok := GetURLFromFilename("temp123")
	if !ok || url != "my-video-post" {
		t.Errorf("Expected the post url for the filename, got %q (%v)", url, ok)
	}

	filename, ok := GetFilenameFromURL("my-video-post")
	if !ok || filename != "temp123" {
		t.Errorf("Expected the filename for the post url, got %q (%v)", filename, ok)
	}
}

func TestDeleteFilenameMappingRemovesBothDirections(t *testing.T) {
	SetFilenameToURL("temp456", "another-post")
	DeleteFilenameMapping("temp456")

	if _, ok := GetURLFromFilename("temp456"); ok {
		t.Errorf("The filename mapping should be gone")
	}
	if _, ok := GetFilenameFromURL("another-post"); ok {
		t.Errorf("The reverse mapping should be gone too")
	}
}

func TestUnknownMappingsReportMissing(t *testing.T) {
	if _, ok := GetURLFromFilename("never-set"); ok {
		t.Errorf("An unknown filename should report missing")
	}
	if _, ok := GetFilenameFromURL("never-set"); ok {
		t.Errorf("An unknown url should report missing")
	}
}
