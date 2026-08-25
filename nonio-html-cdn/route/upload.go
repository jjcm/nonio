package route

import (
	"bytes"
	"fmt"
	"io"
	"io/ioutil"
	"net/http"
	"os"
	"path/filepath"
	"nonio-html-cdn/encode"
	"nonio-html-cdn/util"
	"strings"
)

// UploadFile accepts html assets or a zip archive and stores them in a temp directory.
func UploadFile(w http.ResponseWriter, r *http.Request) {
	if r.Method == "OPTIONS" {
		util.SendResponse(w, r, "", http.StatusOK)
		return
	}

	if err := r.ParseMultipartForm(1 << 30); err != nil {
		util.SendError(w, r, "Error parsing upload form.", http.StatusBadRequest)
		return
	}

	bearerToken := r.Header.Get("Authorization")
	user, err := util.GetUserEmail(bearerToken)
	if err != nil {
		util.SendError(w, r, "User is not authorized.", http.StatusBadRequest)
		return
	}

	files := r.MultipartForm.File["files"]
	if len(files) == 0 {
		util.SendError(w, r, "Error: no files were found in the \"files\" field.", http.StatusBadRequest)
		return
	}

	tempID, err := newTempID()
	if err != nil {
		util.SendError(w, r, "Error creating temp upload directory.", http.StatusInternalServerError)
		return
	}
	destDir := filepath.Join("files", "temp", tempID)
	if err := os.MkdirAll(destDir, 0755); err != nil {
		util.SendError(w, r, "Error creating temp upload directory.", http.StatusInternalServerError)
		return
	}

	cleanupOnError := true
	defer func() {
		if cleanupOnError {
			os.RemoveAll(destDir)
		}
	}()

	if len(files) == 1 && encode.IsZipUpload(files[0].Filename, files[0].Header.Get("Content-Type")) {
		file, err := files[0].Open()
		if err != nil {
			util.SendError(w, r, "Error opening uploaded zip file.", http.StatusBadRequest)
			return
		}
		defer file.Close()

		contents, err := ioutil.ReadAll(io.LimitReader(file, encode.MaxZipCompressedBytes()+1))
		if err != nil {
			util.SendError(w, r, "Error reading uploaded zip file.", http.StatusBadRequest)
			return
		}
		if int64(len(contents)) > encode.MaxZipCompressedBytes() {
			util.SendError(w, r, "Zip archive exceeds maximum compressed size.", http.StatusBadRequest)
			return
		}

		reader := bytes.NewReader(contents)
		if err := encode.ExtractZip(reader, int64(len(contents)), destDir); err != nil {
			util.SendError(w, r, fmt.Sprintf("Error extracting zip archive: %v", err), http.StatusBadRequest)
			return
		}

		fmt.Printf("%v uploaded zip archive of size %v to temp/%v\n", user, len(contents), tempID)
	} else {
		for _, header := range files {
			file, err := header.Open()
			if err != nil {
				util.SendError(w, r, "Error opening uploaded file.", http.StatusBadRequest)
				return
			}

			relativePath := sanitizeFilename(header.Filename)
			err = encode.SaveUploadedFile(destDir, relativePath, file, header.Size)
			file.Close()
			if err != nil {
				util.SendError(w, r, fmt.Sprintf("Error saving uploaded file: %v", err), http.StatusBadRequest)
				return
			}
		}

		fmt.Printf("%v uploaded %v files to temp/%v\n", user, len(files), tempID)
	}

	if !encode.HasIndexHTML(destDir) {
		util.SendError(w, r, "Upload must include index.html or index.htm at the root.", http.StatusBadRequest)
		return
	}

	cleanupOnError = false
	util.SendResponse(w, r, tempID, http.StatusOK)
}

// MoveFile moves a temp html directory to its final url.
func MoveFile(w http.ResponseWriter, r *http.Request) {
	if r.Method == "OPTIONS" {
		util.SendResponse(w, r, "", http.StatusOK)
		return
	}

	if err := r.ParseMultipartForm(1 << 30); err != nil {
		util.SendError(w, r, "Error parsing move form.", http.StatusBadRequest)
		return
	}

	bearerToken := r.Header.Get("Authorization")
	user, err := util.GetUserEmail(bearerToken)
	if err != nil {
		util.SendError(w, r, "User is not authorized.", http.StatusBadRequest)
		return
	}

	url := r.FormValue("url")
	urlIsAvailable, err := util.CheckIfURLIsAvailable(url)
	if err != nil {
		util.SendError(w, r, fmt.Sprintf("Error checking requested url: %v", url), http.StatusInternalServerError)
		return
	}
	if !urlIsAvailable {
		util.SendError(w, r, fmt.Sprintf("Url \"%v\" is taken.", url), http.StatusBadRequest)
		return
	}

	tempID := r.FormValue("oldUrl")
	tempDir := filepath.Join("files", "temp", tempID)
	finalDir := filepath.Join("files", url)

	if _, err := os.Stat(tempDir); os.IsNotExist(err) {
		util.SendError(w, r, "No temp html upload exists with that name.", http.StatusBadRequest)
		return
	}
	if _, err := os.Stat(finalDir); err == nil {
		util.SendError(w, r, fmt.Sprintf("Url \"%v\" is taken.", url), http.StatusBadRequest)
		return
	}

	if err := os.Rename(tempDir, finalDir); err != nil {
		util.SendError(w, r, "Error moving html upload to final url.", http.StatusInternalServerError)
		return
	}

	fmt.Printf("%v moved temp/%v to %v\n", user, tempID, url)
	util.SendResponse(w, r, url, http.StatusOK)
}

func newTempID() (string, error) {
	for i := 0; i < 5; i++ {
		id, err := randomID()
		if err != nil {
			return "", err
		}
		if _, err := os.Stat(filepath.Join("files", "temp", id)); os.IsNotExist(err) {
			return id, nil
		}
	}
	return "", fmt.Errorf("could not allocate temp id")
}

func sanitizeFilename(filename string) string {
	filename = strings.ReplaceAll(filename, "\\", "/")
	filename = filepath.Base(filename)
	return filename
}
