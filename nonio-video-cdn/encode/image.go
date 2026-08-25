package encode

import (
	"bytes"
	"fmt"
	"io/ioutil"
	"mime/multipart"
	"os"
	"os/exec"
)

// Image encodes the image into a webp and returns the path to it
func Image(file multipart.File, url string) error {
	// Create a temp file
	tempFile, err := ioutil.TempFile("files/temp-images", "image-*")
	if err != nil {
		fmt.Println(err)
		return err
	}
	defer tempFile.Close()

	// read the uploaded file into a buffer and write it to our temp file
	fileBytes, err := ioutil.ReadAll(file)
	if err != nil {
		fmt.Println(err)
		return err
	}
	tempFile.Write(fileBytes)

	// since this is an image we'll use magick to encode it
	cmd := exec.Command("convert", tempFile.Name(), "(", "+clone", "-resize", "192x144^", "-write", fmt.Sprintf("files/thumbnails/%v.webp", url), "+delete", ")", fmt.Sprintf("files/images/%v.webp", url))
	workingDir, err := os.Getwd()
	if err != nil {
		fmt.Println(err)
		return err
	}
	cmd.Dir = workingDir
	var output bytes.Buffer
	cmd.Stderr = &output
	err = cmd.Run()

	return err
}
