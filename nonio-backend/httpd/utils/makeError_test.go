package utils

import "testing"

// TestErrorWrapper - make sure our error message wrapper works
func TestErrorWrapper(t *testing.T) {
	message := "howdy"
	expected := map[string]string{
		"error": message,
	}
	output := MakeError(message)
	if output["error"] != expected["error"] {
		t.Errorf("Error wrapper didn't work as expected")
	}
}
