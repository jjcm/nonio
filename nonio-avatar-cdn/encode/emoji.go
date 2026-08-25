package encode

import (
	"bytes"
	"errors"
	"fmt"
	"io/ioutil"
	"mime/multipart"
	"os"
	"os/exec"
	"path/filepath"

	"github.com/h2non/filetype"
)

// Emoji converts uploaded image/gif to a 64x64 webp. Animated GIFs become animated webp.
func Emoji(file multipart.File, key string) (bool, error) {
	tempFile, err := ioutil.TempFile("files/temp-images", "emoji-*")
	if err != nil {
		return false, err
	}
	defer tempFile.Close()
	defer os.Remove(tempFile.Name())

	fileBytes, err := ioutil.ReadAll(file)
	if err != nil {
		return false, err
	}
	if _, err := tempFile.Write(fileBytes); err != nil {
		return false, err
	}

	if !filetype.IsImage(fileBytes) {
		return false, errors.New("file type not supported")
	}
	kind, err := filetype.Match(fileBytes)
	if err != nil {
		return false, err
	}

	dst := fmt.Sprintf("files/images/%s.webp", key)
	if err := os.MkdirAll(filepath.Dir(dst), 0755); err != nil {
		return false, err
	}

	workingDir, _ := os.Getwd()
	var output bytes.Buffer

	if kind.MIME.Value == "image/gif" {
		resizedGif, err := ioutil.TempFile("files/temp-images", "emoji-gif-*")
		if err != nil {
			return false, err
		}
		resizedGifPath := resizedGif.Name()
		resizedGif.Close()
		defer os.Remove(resizedGifPath)

		resizeCmd := exec.Command(
			"convert",
			tempFile.Name(),
			"-coalesce",
			"-resize", "64x64",
			"-gravity", "center",
			"-extent", "64x64",
			"-layers", "Optimize",
			resizedGifPath,
		)
		resizeCmd.Dir = workingDir
		resizeCmd.Stderr = &output
		if err := resizeCmd.Run(); err != nil {
			return false, err
		}

		encodeCmd := exec.Command("gif2webp", resizedGifPath, "-o", dst)
		encodeCmd.Dir = workingDir
		output.Reset()
		encodeCmd.Stderr = &output
		if err := encodeCmd.Run(); err != nil {
			return false, err
		}
		return true, nil
	}

	cmd := exec.Command(
		"convert",
		tempFile.Name(),
		"-background", "none",
		"-alpha", "set",
		"-resize", "64x64",
		"-gravity", "center",
		"-extent", "64x64",
		dst,
	)
	cmd.Dir = workingDir
	cmd.Stderr = &output
	if err := cmd.Run(); err != nil {
		return false, err
	}
	return false, nil
}
