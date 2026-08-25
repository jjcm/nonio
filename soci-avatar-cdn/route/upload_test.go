package route

import (
	"bytes"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"net/textproto"
	"strings"
	"testing"

	"soci-avatar-cdn/config"
)

func TestSanitizeEmojiName(t *testing.T) {
	cases := map[string]string{
		"party_blob":      "party_blob",
		"  Party Blob  ":  "party_blob",
		"FIRE!!!":         "fire",
		"🔥fire🔥":          "fire",
		"a":               "", // too short
		"__":              "", // nothing left after trimming
		"":                "",
		"tag--with--dash": "tag_with_dash",
		strings.Repeat("x", 50): strings.Repeat("x", 32),
	}
	for input, want := range cases {
		if got := sanitizeEmojiName(input); got != want {
			t.Errorf("sanitizeEmojiName(%q) = %q, want %q", input, got, want)
		}
	}
}

func TestUploadFileAnswersOptionsPreflight(t *testing.T) {
	rec := httptest.NewRecorder()
	UploadFile(rec, httptest.NewRequest("OPTIONS", "/upload", nil))
	if rec.Code != 200 {
		t.Errorf("OPTIONS should answer 200, got %v", rec.Code)
	}
}

func TestUploadFileRejectsGET(t *testing.T) {
	rec := httptest.NewRecorder()
	UploadFile(rec, httptest.NewRequest("GET", "/upload", nil))
	if rec.Code != 500 {
		t.Errorf("GET should be rejected, got %v", rec.Code)
	}
}

func TestUploadFileRejectsUnauthorizedUsers(t *testing.T) {
	api := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(401)
		w.Write([]byte(`{"error":"token is invalid"}`))
	}))
	defer api.Close()
	config.Settings.APIHost = api.URL

	rec := httptest.NewRecorder()
	req := httptest.NewRequest("POST", "/upload", strings.NewReader(""))
	req.Header.Set("Authorization", "Bearer bad")
	UploadFile(rec, req)
	if rec.Code != 400 {
		t.Errorf("An invalid token should answer 400, got %v", rec.Code)
	}
}

func TestUploadFileRejectsInvalidEmojiNames(t *testing.T) {
	api := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(`{"email":"user@example.com","username":"noniouser","id":1}`))
	}))
	defer api.Close()
	config.Settings.APIHost = api.URL

	// multipart body with an image part and an unusable emoji name
	body := &bytes.Buffer{}
	form := multipart.NewWriter(body)
	form.WriteField("type", "emoji")
	form.WriteField("name", "!")
	header := textproto.MIMEHeader{}
	header.Set("Content-Disposition", `form-data; name="files"; filename="emoji.png"`)
	header.Set("Content-Type", "image/png")
	part, _ := form.CreatePart(header)
	part.Write([]byte("not really a png"))
	form.Close()

	rec := httptest.NewRecorder()
	req := httptest.NewRequest("POST", "/upload", body)
	req.Header.Set("Authorization", "Bearer good")
	req.Header.Set("Content-Type", form.FormDataContentType())
	UploadFile(rec, req)
	if rec.Code != 400 || !strings.Contains(rec.Body.String(), "invalid emoji name") {
		t.Errorf("An unusable emoji name should answer 400, got %v: %s", rec.Code, rec.Body.String())
	}
}
