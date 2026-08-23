package route

import (
	"fmt"
	"net/http"
	"regexp"
	"soci-image-cdn/encode"
	"soci-image-cdn/util"

	"github.com/google/uuid"
	"github.com/otiai10/opengraph/v2"
)

// UploadFile takes the form upload and delegates to the encoders
func FetchOGImage(w http.ResponseWriter, r *http.Request) {
	if r.Method == "OPTIONS" {
		util.SendResponse(w, "", 200)
		return
	}
	// Parse our multipart form, set a 1GB max upload size
	r.ParseMultipartForm(1 << 30)

	// Get the user's email if we're authorized
	bearerToken := r.Header.Get("Authorization")
	fmt.Println(bearerToken)
	user, err := util.GetUserEmail(bearerToken)
	fmt.Println(user)
	if err != nil {
		util.SendError(w, fmt.Sprintf("User is not authorized. Token: %v", bearerToken), 400)
		return
	}

	// Parse our url, and check if the url is available
	url := r.FormValue("url")
	if url != "" {
		urlIsAvailable, err := util.CheckIfURLIsAvailable(url)
		if err != nil {
			util.SendError(w, "Error checking requested url.", 500)
			return
		}
		if !urlIsAvailable {
			util.SendError(w, "Url is taken.", 400)
			return
		}
	} else {
		url = uuid.New().String()
	}

	link := r.FormValue("link")
	if link == "" {
		util.SendError(w, "No link was provided.", 400)
		return
	}

	ogThumbnailLink := ""
	ogp, _ := opengraph.Fetch(link)
	if len(ogp.Image) > 0 {
		ogThumbnailLink = ogp.Image[0].URL
	} else {
		util.SendError(w, "No thumbnail was found in the provided link.", 400)
		return
	}

	// Get the data
	resp, err := http.Get(ogThumbnailLink)
	if err != nil {
		util.SendError(w, "couldn't access thumbnail", 400)
		return
	}
	defer resp.Body.Close()

	re, _ := regexp.Compile("([a-zA-Z]+)/")
	var mimeType = resp.Header["Content-Type"][0]

	if re.FindStringSubmatch(mimeType)[1] != "image" {
		util.SendError(w, "Thumbnail is not an image", 400)
		return
	}

	err = encode.Image(resp.Body, url)
	if err != nil {
		util.SendError(w, fmt.Sprintf("Error encoding the file: %v", err), 500)
		return
	}

	util.SendResponse(w, url, 200)
}
