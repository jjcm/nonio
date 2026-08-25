package util

import "testing"

func TestMediaCategory(t *testing.T) {
	cases := map[string]string{
		"image/heic":               "image",
		"image/heif":               "image",
		"IMAGE/JPEG":               "image",
		"video/mp4":                "video",
		"image/webp; charset=utf8": "image",
		"application/octet-stream": "application",
		"nonsense":                 "",
		"":                         "",
		"image/":                   "",
	}
	for contentType, want := range cases {
		if got := MediaCategory(contentType); got != want {
			t.Errorf("MediaCategory(%q) = %q, want %q", contentType, got, want)
		}
	}
}
