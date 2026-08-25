package util

import (
	"sync"
)

var (
	// filenameToURL maps temp filenames (without extension) to post URLs
	filenameToURL = make(map[string]string)
	// urlToFilename maps post URLs to temp filenames (reverse mapping)
	urlToFilename = make(map[string]string)
	urlMutex      sync.RWMutex
)

// SetFilenameToURL stores a mapping from temp filename to post URL (bidirectional)
func SetFilenameToURL(filename, url string) {
	urlMutex.Lock()
	defer urlMutex.Unlock()
	filenameToURL[filename] = url
	urlToFilename[url] = filename
}

// GetURLFromFilename retrieves the post URL for a temp filename
func GetURLFromFilename(filename string) (string, bool) {
	urlMutex.RLock()
	defer urlMutex.RUnlock()
	url, ok := filenameToURL[filename]
	return url, ok
}

// GetFilenameFromURL retrieves the temp filename for a post URL
func GetFilenameFromURL(url string) (string, bool) {
	urlMutex.RLock()
	defer urlMutex.RUnlock()
	filename, ok := urlToFilename[url]
	return filename, ok
}

// DeleteFilenameMapping removes a mapping (cleanup after use)
func DeleteFilenameMapping(filename string) {
	urlMutex.Lock()
	defer urlMutex.Unlock()
	if url, ok := filenameToURL[filename]; ok {
		delete(urlToFilename, url)
	}
	delete(filenameToURL, filename)
}

