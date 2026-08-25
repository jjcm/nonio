package encode

import (
	"bytes"
	"fmt"
	"io/ioutil"
	"mime/multipart"
	"os"
	"os/exec"
)

// Video encodes the video into a webm and returns the path to it
func Video(file multipart.File, url string) error {
	// Create a temp file
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

	// since this is a video we'll use ffmpeg to encode it
	cmd := exec.Command("ffmpeg", "-y", "-i", tempFile.Name(), "-c:v", "libvpx-vp9", "-b:v", "2M", fmt.Sprintf("files/videos/%v.webm", url))
	workingDir, err := os.Getwd()
	if err != nil {
		fmt.Println(err)
	}
	cmd.Dir = workingDir
	var output bytes.Buffer
	cmd.Stderr = &output
	err = cmd.Run()

	// probs don't need to full panic?
	/*
		if err != nil {
			panic(output.String())
			return err
		}
	*/

	return err
}
