package route

import (
	"fmt"
	"net/http"
	"os"
	"soci-video-cdn/util"
)

// MoveFile takes the temp file and renames it to match the url
func MoveFile(w http.ResponseWriter, r *http.Request) {
	if r.Method == "OPTIONS" {
		util.SendResponse(w, "", 200)
		return
	}

	r.ParseMultipartForm(1 << 30)

	// Get the user's email if we're authorized
	bearerToken := r.Header.Get("Authorization")
	fmt.Println(bearerToken)
	user, err := util.GetUserEmail(bearerToken)
	fmt.Println(user)
	if err != nil {
		util.SendError(w, "User is not authorized.", 400)
		return
	}

	// Parse our url, and check if the url is available
	url := r.FormValue("url")
	
	// Store mapping from temp filename to post URL for encoding completion notification
	tempFile := r.FormValue("oldUrl")
	if tempFile != "" {
		// Remove .mp4 extension if present to match the base filename used in encode
		baseFilename := tempFile
		if len(baseFilename) > 4 && baseFilename[len(baseFilename)-4:] == ".mp4" {
			baseFilename = baseFilename[:len(baseFilename)-4]
		}
		util.SetFilenameToURL(baseFilename, url)
	}
	
	urlIsAvailable, err := util.CheckIfURLIsAvailable(url)
	if err != nil {
		util.SendError(w, fmt.Sprintf("Error checking requested url: %v", url), 500)
		fmt.Println(err)
		return
	}
	if urlIsAvailable == false {
		util.SendError(w, fmt.Sprintf("Url \"%v\" is taken.", url), 400)
		return
	}

	// Check if the encoded files exist in files/videos/
	// If encoding is not complete yet, just store the mapping and return success
	// The files will be moved when encoding completes
	_, err = os.Stat(fmt.Sprintf("files/videos/%v.mp4", tempFile))
	if os.IsNotExist(err) {
		// Files don't exist yet (encoding in progress), just store mapping and return
		// The encoding completion handler will move the files
		util.SendResponse(w, url, 200)
		return
	}
	/*
		if _, err := os.Stat(fmt.Sprintf("files/thumbnails/%v.webp", tempFile)); os.IsNotExist(err) {
			util.SendError(w, "No temp thumbnail exists with that name.", 400)
			fmt.Println(err)
			return
		}
	*/

	// If everything else looks good, lets move the file.
	err = os.Rename(fmt.Sprintf("files/videos/%v.mp4", tempFile), fmt.Sprintf("files/videos/%v.mp4", url))
	if err != nil {
		util.SendError(w, "Error renaming file.", 500)
		return
	}
	/*
		err = os.Rename(fmt.Sprintf("files/thumbnails/%v.webp", tempFile), fmt.Sprintf("files/thumbnails/%v.webp", url))
		if err != nil {
			util.SendError(w, "Error renaming thumbnail.", 500)
			return
		}
	*/
	if _, err := os.Stat(fmt.Sprintf("files/videos/%v-2160p.mp4", tempFile)); err == nil {
		err = os.Rename(fmt.Sprintf("files/videos/%v-2160p.mp4", tempFile), fmt.Sprintf("files/videos/%v-2160p.mp4", url))
		if err != nil {
			util.SendError(w, "Error renaming 2160p res file.", 500)
			return
		}
	}

	if _, err := os.Stat(fmt.Sprintf("files/videos/%v-1440p.mp4", tempFile)); err == nil {
		err = os.Rename(fmt.Sprintf("files/videos/%v-1440p.mp4", tempFile), fmt.Sprintf("files/videos/%v-1440p.mp4", url))
		if err != nil {
			util.SendError(w, "Error renaming 1440p res file.", 500)
			return
		}
	}

	if _, err := os.Stat(fmt.Sprintf("files/videos/%v-1080p.mp4", tempFile)); err == nil {
		err = os.Rename(fmt.Sprintf("files/videos/%v-1080p.mp4", tempFile), fmt.Sprintf("files/videos/%v-1080p.mp4", url))
		if err != nil {
			util.SendError(w, "Error renaming 1080p res file.", 500)
			return
		}
	}

	if _, err := os.Stat(fmt.Sprintf("files/videos/%v-720p.mp4", tempFile)); err == nil {
		err = os.Rename(fmt.Sprintf("files/videos/%v-720p.mp4", tempFile), fmt.Sprintf("files/videos/%v-720p.mp4", url))
		if err != nil {
			util.SendError(w, "Error renaming 720p res file.", 500)
			return
		}
	}

	if _, err := os.Stat(fmt.Sprintf("files/videos/%v-480p.mp4", tempFile)); err == nil {
		fmt.Println("the 480 exists")
		err = os.Rename(fmt.Sprintf("files/videos/%v-480p.mp4", tempFile), fmt.Sprintf("files/videos/%v-480p.mp4", url))
		if err != nil {
			fmt.Println(err)
			util.SendError(w, "Error renaming 480p res file.", 500)
			return
		}
	}

	// Send back a response.
	util.SendResponse(w, url, 200)
}
