package route

import (
	"fmt"
	"net/http"
	"regexp"
	"soci-avatar-cdn/encode"
	"soci-avatar-cdn/util"
	"strconv"
	"strings"
)

func sanitizeEmojiName(name string) string {
	name = strings.TrimSpace(strings.ToLower(name))
	re := regexp.MustCompile(`[^a-z0-9_]+`)
	name = re.ReplaceAllString(name, "_")
	name = strings.Trim(name, "_")
	if len(name) < 2 {
		return ""
	}
	if len(name) > 32 {
		name = name[:32]
	}
	return name
}

// UploadFile takes the form upload and delegates to the encoders
func UploadFile(w http.ResponseWriter, r *http.Request) {
	if r.Method == "OPTIONS" {
		util.SendResponse(w, "", 200)
		return
	}
	if r.Method == "GET" {
		util.SendError(w, "You can only post to this route", 500)
		return
	}
	// Parse our multipart form, set a 1GB max upload size
	r.ParseMultipartForm(1 << 30)

	// Get the user's email if we're authorized
	bearerToken := r.Header.Get("Authorization")
	fmt.Println(bearerToken)
	user, err := util.GetUsername(bearerToken)
	fmt.Println(user)
	if err != nil {
		util.SendError(w, fmt.Sprintf("User is not authorized. Token: %v", bearerToken), 400)
		return
	}

	// Get the crop parameters.
	xOffset, _ := strconv.Atoi(r.FormValue("xoffset"))
	yOffset, _ := strconv.Atoi(r.FormValue("yoffset"))
	uploadType := r.FormValue("type")

	community := strings.TrimSpace(r.FormValue("community"))
	if community != "" {
		isAdmin, err := util.VerifyCommunityAdmin(community, bearerToken)
		if err != nil || !isAdmin {
			util.SendError(w, "User is not an admin of this community", 403)
			return
		}
		user = "community_" + community
	}

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
	fmt.Printf("%v is uploading a %v of size %v to %v\n", user, re.FindStringSubmatch(mimeType)[1], handler.Size, user)

	switch re.FindStringSubmatch(mimeType)[1] {
	case "image":
		if uploadType == "emoji" {
			name := sanitizeEmojiName(r.FormValue("name"))
			if name == "" {
				util.SendError(w, "invalid emoji name", 400)
				return
			}
			// Deterministic path: files/images/emoji/<name>.webp
			// The encode.Emoji function expects just the key part inside files/images/
			key := "emoji/" + name
			animated, encErr := encode.Emoji(file, key)
			if encErr != nil {
				err = encErr
			} else if animated {
				key += ".animated"
			}
			if err == nil {
				util.SendResponse(w, key, 200)
				return
			}
		} else if uploadType == "banner" {
			cropWidth, _ := strconv.Atoi(r.FormValue("width"))
			cropHeight, _ := strconv.Atoi(r.FormValue("height"))
			err = encode.Banner(file, user, xOffset, yOffset, cropWidth, cropHeight)
		} else {
			size, _ := strconv.Atoi(r.FormValue("size"))
			err = encode.Image(file, user, xOffset, yOffset, size)
		}
	}

	if err != nil {
		fmt.Println(err)
		util.SendError(w, fmt.Sprintf("Error encoding or cropping the file: %v", err), 500)
		return
	}

	util.SendResponse(w, user, 200)
}
