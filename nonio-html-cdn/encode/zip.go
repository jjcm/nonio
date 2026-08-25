package encode

import (
	"archive/zip"
	"fmt"
	"io"
	"os"
	"path"
	"path/filepath"
	"strings"
)

const (
	maxZipCompressedBytes   = 50 << 20  // 50MB
	maxZipUncompressedBytes = 200 << 20 // 200MB
	maxZipFiles             = 500
	maxCompressionRatio     = 100
	maxPathDepth            = 20
	maxSingleFileBytes      = 25 << 20 // 25MB per file
)

// MaxZipCompressedBytes is the maximum allowed compressed zip upload size.
func MaxZipCompressedBytes() int64 {
	return maxZipCompressedBytes
}

var allowedExtensions = map[string]bool{
	".html": true, ".htm": true, ".css": true, ".js": true, ".mjs": true,
	".json": true, ".map": true, ".txt": true, ".xml": true, ".svg": true,
	".png": true, ".jpg": true, ".jpeg": true, ".gif": true, ".webp": true,
	".ico": true, ".woff": true, ".woff2": true, ".ttf": true, ".otf": true,
	".mp3": true, ".ogg": true, ".wav": true, ".mp4": true, ".webm": true,
	".wasm": true,
}

// ExtractZip safely extracts a zip archive into destDir.
func ExtractZip(reader io.ReaderAt, size int64, destDir string) error {
	archive, err := zip.NewReader(reader, size)
	if err != nil {
		return fmt.Errorf("invalid zip archive: %w", err)
	}

	if size > maxZipCompressedBytes {
		return fmt.Errorf("zip archive exceeds maximum compressed size")
	}

	var fileCount int
	var totalUncompressed int64
	entries := make([]*zip.File, 0, len(archive.File))

	for _, file := range archive.File {
		if err := validateZipEntry(file, destDir); err != nil {
			return err
		}
		if file.FileInfo().IsDir() {
			continue
		}

		fileCount++
		if fileCount > maxZipFiles {
			return fmt.Errorf("zip archive contains too many files")
		}

		totalUncompressed += int64(file.UncompressedSize64)
		if totalUncompressed > maxZipUncompressedBytes {
			return fmt.Errorf("zip archive exceeds maximum uncompressed size")
		}
		if int64(file.UncompressedSize64) > maxSingleFileBytes {
			return fmt.Errorf("zip entry exceeds maximum file size: %s", file.Name)
		}

		entries = append(entries, file)
	}

	if fileCount == 0 {
		return fmt.Errorf("zip archive contains no files")
	}

	if err := checkCompressionRatio(size, totalUncompressed); err != nil {
		return err
	}

	var extractedBytes int64
	for _, file := range entries {
		written, err := extractZipFile(file, destDir)
		if err != nil {
			return err
		}
		extractedBytes += written
		if extractedBytes > maxZipUncompressedBytes {
			return fmt.Errorf("zip archive exceeds maximum uncompressed size while extracting")
		}
	}

	return nil
}

func validateZipEntry(file *zip.File, destDir string) error {
	name := filepath.ToSlash(filepath.Clean(file.Name))
	if name == "." || strings.HasPrefix(name, "/") || strings.HasPrefix(name, "../") || strings.Contains(name, "/../") {
		return fmt.Errorf("zip entry has an invalid path: %s", file.Name)
	}

	depth := strings.Count(name, "/")
	if depth > maxPathDepth {
		return fmt.Errorf("zip entry path is too deep: %s", file.Name)
	}

	if file.FileInfo().IsDir() {
		return nil
	}

	ext := strings.ToLower(path.Ext(name))
	if !allowedExtensions[ext] {
		return fmt.Errorf("zip entry has a disallowed file type: %s", file.Name)
	}

	destPath := filepath.Join(destDir, filepath.FromSlash(name))
	cleanDest := filepath.Clean(destPath)
	cleanRoot := filepath.Clean(destDir)
	if cleanDest != cleanRoot && !strings.HasPrefix(cleanDest, cleanRoot+string(os.PathSeparator)) {
		return fmt.Errorf("zip entry escapes destination directory: %s", file.Name)
	}

	return nil
}

func checkCompressionRatio(compressedSize int64, uncompressedSize int64) error {
	if compressedSize <= 0 {
		return nil
	}
	ratio := uncompressedSize / compressedSize
	if ratio > maxCompressionRatio {
		return fmt.Errorf("zip archive compression ratio is suspiciously high")
	}
	return nil
}

func extractZipFile(file *zip.File, destDir string) (int64, error) {
	reader, err := file.Open()
	if err != nil {
		return 0, err
	}
	defer reader.Close()

	destPath := filepath.Join(destDir, filepath.FromSlash(filepath.ToSlash(file.Name)))
	if err := os.MkdirAll(filepath.Dir(destPath), 0755); err != nil {
		return 0, err
	}

	out, err := os.OpenFile(destPath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, file.Mode().Perm())
	if err != nil {
		return 0, err
	}
	defer out.Close()

	limited := io.LimitReader(reader, maxSingleFileBytes+1)
	written, err := io.Copy(out, limited)
	if err != nil {
		return 0, err
	}
	if written > maxSingleFileBytes {
		return written, fmt.Errorf("zip entry exceeds maximum file size while extracting: %s", file.Name)
	}

	return written, nil
}

// SaveUploadedFile writes a single uploaded file into destDir using its relative path.
func SaveUploadedFile(destDir string, relativePath string, reader io.Reader, size int64) error {
	if size > maxSingleFileBytes {
		return fmt.Errorf("uploaded file exceeds maximum size")
	}

	name := filepath.ToSlash(filepath.Clean(relativePath))
	if name == "." || strings.HasPrefix(name, "/") || strings.HasPrefix(name, "../") || strings.Contains(name, "/../") {
		return fmt.Errorf("uploaded file has an invalid path: %s", relativePath)
	}

	ext := strings.ToLower(path.Ext(name))
	if !allowedExtensions[ext] {
		return fmt.Errorf("uploaded file has a disallowed file type: %s", relativePath)
	}

	destPath := filepath.Join(destDir, filepath.FromSlash(name))
	cleanDest := filepath.Clean(destPath)
	cleanRoot := filepath.Clean(destDir)
	if cleanDest != cleanRoot && !strings.HasPrefix(cleanDest, cleanRoot+string(os.PathSeparator)) {
		return fmt.Errorf("uploaded file escapes destination directory: %s", relativePath)
	}

	if err := os.MkdirAll(filepath.Dir(destPath), 0755); err != nil {
		return err
	}

	out, err := os.Create(destPath)
	if err != nil {
		return err
	}
	defer out.Close()

	limited := io.LimitReader(reader, maxSingleFileBytes+1)
	written, err := io.Copy(out, limited)
	if err != nil {
		return err
	}
	if written > maxSingleFileBytes {
		return fmt.Errorf("uploaded file exceeds maximum size while writing: %s", relativePath)
	}

	return nil
}

// HasIndexHTML reports whether destDir contains index.html or index.htm at its root.
func HasIndexHTML(destDir string) bool {
	for _, name := range []string{"index.html", "index.htm"} {
		if _, err := os.Stat(filepath.Join(destDir, name)); err == nil {
			return true
		}
	}
	return false
}

// IsZipUpload detects zip uploads by mime type or file extension.
func IsZipUpload(filename string, mimeType string) bool {
	lowerName := strings.ToLower(filename)
	if strings.HasSuffix(lowerName, ".zip") {
		return true
	}

	lowerMime := strings.ToLower(mimeType)
	switch lowerMime {
	case "application/zip", "application/x-zip-compressed", "application/x-zip", "multipart/x-zip":
		return true
	default:
		return false
	}
}
