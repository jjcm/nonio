package encode

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"io/ioutil"
	"os"
	"os/exec"

	"github.com/h2non/filetype"
)

// Image encodes the image into a webp and returns the path to it
func Image(file io.Reader, url string) error {
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

	if !filetype.IsImage(fileBytes) {
		err = errors.New("file type not supported")
		return err
	}

	// read the file header and check
	kind, err := filetype.Match(fileBytes)
	if err != nil {
		fmt.Println(err)
		return err
	}
	if kind.MIME.Value == "image/gif" {
		// It's a gif, so we gotta create a static thumbnail first, then use ffmpeg to create an animated webp
		cmd := exec.Command("convert", fmt.Sprintf("%v[0]", tempFile.Name()), "-resize", "192x144^", fmt.Sprintf("files/thumbnails/%v.webp", url))
		workingDir, err := os.Getwd()
		if err != nil {
			fmt.Println(err)
			return err
		}
		cmd.Dir = workingDir
		var output bytes.Buffer
		cmd.Stderr = &output
		err = cmd.Run()
		if err != nil {
			fmt.Println(err)
			return err
		}

		cmd = exec.Command("gif2webp", tempFile.Name(), "-o", fmt.Sprintf("files/images/%v.webp", url))
		cmd.Dir = workingDir
		cmd.Stderr = &output
		err = cmd.Run()
		if err != nil {
			fmt.Println(err)
			return err
		}

	} else if kind.MIME.Value == "image/png" {
		// It's a png image, so set the flags to be lossless
		cmd := exec.Command("convert", tempFile.Name(), "(", "+clone", "-resize", "192x144^", "-write", fmt.Sprintf("files/thumbnails/%v.webp", url), "+delete", ")", "-define", "webp:lossless=true", fmt.Sprintf("files/images/%v.webp", url))
		workingDir, err := os.Getwd()
		if err != nil {
			fmt.Println(err)
			return err
		}
		cmd.Dir = workingDir
		var output bytes.Buffer
		cmd.Stderr = &output
		err = cmd.Run()
		if err != nil {
			fmt.Println(err)
			return err
		}

	} else {
		// It's a normal image, just use imagemagick to convert it
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
		if err != nil {
			fmt.Println(err)
			return err
		}
	}

	return err
}
