package util

import "testing"

func TestGetOrCreateSessionReturnsTheSameSession(t *testing.T) {
	first := GetOrCreateSession("video-abc")
	second := GetOrCreateSession("video-abc")
	if first != second {
		t.Errorf("The same filename should map to one session")
	}
	if first.Filename != "video-abc" {
		t.Errorf("The session should carry its filename, got %q", first.Filename)
	}
	CloseSession("video-abc")
}

func TestGetSessionOnlyFindsExistingSessions(t *testing.T) {
	if _, ok := GetSession("not-encoding"); ok {
		t.Errorf("A session that was never created should not be found")
	}

	GetOrCreateSession("video-def")
	if _, ok := GetSession("video-def"); !ok {
		t.Errorf("An active session should be found")
	}
	CloseSession("video-def")
}

func TestCloseSessionRemovesTheSession(t *testing.T) {
	GetOrCreateSession("video-ghi")
	CloseSession("video-ghi")
	if _, ok := GetSession("video-ghi"); ok {
		t.Errorf("A closed session should be gone")
	}
}
