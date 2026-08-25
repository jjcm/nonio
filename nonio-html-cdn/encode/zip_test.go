package encode

import (
	"archive/zip"
	"bytes"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestExtractZipRejectsPathTraversal(t *testing.T) {
	archive := buildZip(t, map[string]string{
		"../escape.txt": "nope",
	})
	destDir := t.TempDir()

	err := ExtractZip(bytes.NewReader(archive), int64(len(archive)), destDir)
	if err == nil {
		t.Fatal("expected path traversal zip to be rejected")
	}
}

func TestExtractZipRejectsZipBombRatio(t *testing.T) {
	payload := strings.Repeat("A", 1<<20)
	archive := buildZip(t, map[string]string{
		"index.html": payload,
	})
	destDir := t.TempDir()

	err := ExtractZip(bytes.NewReader(archive), 32, destDir)
	if err == nil {
		t.Fatal("expected suspicious compression ratio to be rejected")
	}
}

func TestExtractZipRejectsTooManyFiles(t *testing.T) {
	files := make(map[string]string, maxZipFiles+1)
	for i := 0; i <= maxZipFiles; i++ {
		files[fmt.Sprintf("file-%d.txt", i)] = "x"
	}
	archive := buildZip(t, files)
	destDir := t.TempDir()

	err := ExtractZip(bytes.NewReader(archive), int64(len(archive)), destDir)
	if err == nil {
		t.Fatal("expected zip with too many files to be rejected")
	}
}

func TestExtractZipAllowsValidArchive(t *testing.T) {
	archive := buildZip(t, map[string]string{
		"index.html": "<!DOCTYPE html><html><body>ok</body></html>",
		"style.css":  "body { color: red; }",
	})
	destDir := t.TempDir()

	err := ExtractZip(bytes.NewReader(archive), int64(len(archive)), destDir)
	if err != nil {
		t.Fatalf("expected valid zip to extract, got: %v", err)
	}
	if !HasIndexHTML(destDir) {
		t.Fatal("expected extracted directory to contain index.html")
	}
}

func TestSaveUploadedFileRejectsDisallowedType(t *testing.T) {
	destDir := t.TempDir()
	err := SaveUploadedFile(destDir, "run.exe", strings.NewReader("bad"), 3)
	if err == nil {
		t.Fatal("expected disallowed file type to be rejected")
	}
}

func buildZip(t *testing.T, files map[string]string) []byte {
	t.Helper()

	buf := &bytes.Buffer{}
	writer := zip.NewWriter(buf)
	for name, contents := range files {
		entry, err := writer.Create(name)
		if err != nil {
			t.Fatalf("create zip entry: %v", err)
		}
		if _, err := io.WriteString(entry, contents); err != nil {
			t.Fatalf("write zip entry: %v", err)
		}
	}
	if err := writer.Close(); err != nil {
		t.Fatalf("close zip writer: %v", err)
	}
	return buf.Bytes()
}

func TestHasIndexHTML(t *testing.T) {
	destDir := t.TempDir()
	if HasIndexHTML(destDir) {
		t.Fatal("expected empty directory to lack index.html")
	}

	if err := os.WriteFile(filepath.Join(destDir, "index.html"), []byte("ok"), 0644); err != nil {
		t.Fatalf("write index.html: %v", err)
	}
	if !HasIndexHTML(destDir) {
		t.Fatal("expected directory with index.html to pass")
	}
}
