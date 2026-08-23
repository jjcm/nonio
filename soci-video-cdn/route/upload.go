package route

import (
	"fmt"
	"io/ioutil"
	"net/http"
	"path/filepath"
	"regexp"
	"soci-video-cdn/util"

	"github.com/google/uuid"
)

// UploadFile takes the form upload and delegates to the encoders
func UploadFile(w http.ResponseWriter, r *http.Request) {
	if r.Method == "OPTIONS" {
		util.SendResponse(w, "", 200)
		return
	}
	// Parse our multipart form, set a 1GB max upload size
	r.ParseMultipartForm(1 << 30)

	// Get the user's email if we're authorized
	bearerToken := r.Header.Get("Authorization")
	user, err := util.GetUserEmail(bearerToken)
	if err != nil {
		util.SendError(w, fmt.Sprintf("User is not authorized. Token: %v", bearerToken), 400)
		return
	}

	// Parse our url, and check if the url is available
	url := uuid.New().String()
	/*
		url := r.FormValue("url")
		if url != "" {
			urlIsAvailable, err := util.CheckIfURLIsAvailable(url)
			if err != nil {
				util.SendError(w, "Error checking requested url.", 500)
				return
			}
			if urlIsAvailable == false {
				util.SendError(w, "Url is taken.", 400)
				return
			}
		} else {
			url = uuid.New().String()
		}
	*/

	// Parse our file and assign it to the proper handlers depending on the type
	file, handler, err := r.FormFile("files")
	if err != nil {
		util.SendError(w, "Error: no file was found in the \"files\" field, or they could not be parsed.", 400)
		return
	}
	defer file.Close()

	re, _ := regexp.Compile("([a-zA-Z]+)/")
	var mimeType = handler.Header["Content-Type"][0]

	// If all is good, let's log what the hell is going on
	fmt.Printf("%v is uploading a %v of size %v to %v\n", user, re.FindStringSubmatch(mimeType)[1], handler.Size, url)

	tempFile, err := ioutil.TempFile("files/temp-videos", "video-*.mp4")
	if err != nil {
		fmt.Println(err)
	}
	defer tempFile.Close()

	// read the uploaded file into a buffer and write it to our temp file
	fileBytes, err := ioutil.ReadAll(file)
	if err != nil {
		fmt.Println(err)
	}
	tempFile.Write(fileBytes)

	fmt.Printf("Moving %v to %v\n", url, tempFile.Name())

	util.SendResponse(w, filepath.Base(tempFile.Name()), 200)
}
