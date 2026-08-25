package encode

import (
	"bytes"
	"errors"
	"fmt"
	"io/ioutil"
	"mime/multipart"
	"os"
	"os/exec"
	"strconv"
	"strings"

	"github.com/h2non/filetype"
)

// Image encodes the image into a webp and returns the path to it
func Image(file multipart.File, user string, xOffset int, yOffset int, size int) error {

	workingDir, _ := os.Getwd()

	// Determine filename: communities get @ prefix, users don't
	var name string
	if strings.HasPrefix(user, "community_") {
		name = "@" + strings.TrimPrefix(user, "community_")
	} else {
		name = user
	}

	// Create a temp file
	tempFile, err := ioutil.TempFile("files/temp-images", "image-*")
	if err != nil {
		return err
	}
	defer tempFile.Close()
	defer os.Remove(tempFile.Name())

	// read the uploaded file into a buffer and write it to our temp file
	fileBytes, err := ioutil.ReadAll(file)
	if err != nil {
		return err
	}
	tempFile.Write(fileBytes)

	if !filetype.IsImage(fileBytes) {
		err = errors.New("file type not supported")
		return err
	}

	// get the dimensions of the file that was uploaded and print to stdout
	infoCmd := exec.Command("identify", "-format", "%w %h", tempFile.Name())
	infoCmd.Dir = workingDir
	infoOutput, err := infoCmd.Output()
	if err != nil {
		return err
	}

	// If we got output without errors, then parse the output and log it.
	dimensionTokens := strings.Split(string(infoOutput), " ")
	width, err := strconv.Atoi(dimensionTokens[0])
	height, err := strconv.Atoi(dimensionTokens[1])
	if err != nil {
		return err
	}
	fmt.Printf("Image width: %v, height: %v\n", width, height)

	// Check if our crop fits within the image size
	if size+xOffset > width {
		size = width - xOffset
	}

	if size+yOffset > height {
		size = width - yOffset
	}

	// If the checks are good, let's crop our temp image.
	cropCmd := exec.Command("convert", tempFile.Name(), "-crop", fmt.Sprintf("%vx%v+%v+%v", size, size, xOffset, yOffset), "+repage", tempFile.Name())
	cropCmd.Dir = workingDir
	var cropOutput bytes.Buffer
	cropCmd.Stderr = &cropOutput
	err = cropCmd.Run()
	if err != nil {
		fmt.Println("Error cropping file.")
		fmt.Println(err)
		return err
	}

	// since this is an image we'll use magick to encode it
	cmd := exec.Command("convert", tempFile.Name(),
		"(", "+clone", "-resize", "96x96^", "-write", fmt.Sprintf("files/thumbnails/%v.webp", name), "+delete", ")",
		"(", "+clone", "-resize", "96x96^", "-write", fmt.Sprintf("files/thumbnails/%v.heic", name), "+delete", ")",
		"(", "+clone", "-resize", "512x512>", "-write", fmt.Sprintf("files/images/%v.heic", name), "+delete", ")",
		"-resize", "512x512>", fmt.Sprintf("files/images/%v.webp", name))
	cmd.Dir = workingDir
	var output bytes.Buffer
	cmd.Stderr = &output
	err = cmd.Run()
	if err != nil {
		fmt.Println("Error resizing multiple versions of file.")
		fmt.Println(err)
		fmt.Println(output.String())
		return err
	}

	return err
}

// Banner encodes a community banner image with rectangular dimensions
func Banner(file multipart.File, user string, xOffset int, yOffset int, cropWidth int, cropHeight int) error {

	workingDir, _ := os.Getwd()

	// Banners are always for communities - add @ prefix
	name := "@" + strings.TrimPrefix(user, "community_")

	// Create a temp file
	tempFile, err := ioutil.TempFile("files/temp-images", "banner-*")
	if err != nil {
		return err
	}
	defer tempFile.Close()
	defer os.Remove(tempFile.Name())

	// read the uploaded file into a buffer and write it to our temp file
	fileBytes, err := ioutil.ReadAll(file)
	if err != nil {
		return err
	}
	tempFile.Write(fileBytes)

	if !filetype.IsImage(fileBytes) {
		err = errors.New("file type not supported")
		return err
	}

	// get the dimensions of the file that was uploaded and print to stdout
	infoCmd := exec.Command("identify", "-format", "%w %h", tempFile.Name())
	infoCmd.Dir = workingDir
	infoOutput, err := infoCmd.Output()
	if err != nil {
		return err
	}

	// If we got output without errors, then parse the output and log it.
	dimensionTokens := strings.Split(string(infoOutput), " ")
	width, err := strconv.Atoi(dimensionTokens[0])
	height, err := strconv.Atoi(dimensionTokens[1])
	if err != nil {
		return err
	}
	fmt.Printf("Banner width: %v, height: %v\n", width, height)

	// Check if our crop fits within the image size
	if cropWidth+xOffset > width {
		cropWidth = width - xOffset
	}
	if cropHeight+yOffset > height {
		cropHeight = height - yOffset
	}

	// If the checks are good, let's crop our temp image.
	cropCmd := exec.Command("convert", tempFile.Name(), "-crop", fmt.Sprintf("%vx%v+%v+%v", cropWidth, cropHeight, xOffset, yOffset), "+repage", tempFile.Name())
	cropCmd.Dir = workingDir
	var cropOutput bytes.Buffer
	cropCmd.Stderr = &cropOutput
	err = cropCmd.Run()
	if err != nil {
		fmt.Println("Error cropping banner file.")
		fmt.Println(err)
		return err
	}

	// Resize to banner dimensions: 800x180 full, 160x36 thumbnail
	cmd := exec.Command("convert", tempFile.Name(),
		"(", "+clone", "-resize", "160x36!", "-write", fmt.Sprintf("files/thumbnails/%v.webp", name), "+delete", ")",
		"(", "+clone", "-resize", "160x36!", "-write", fmt.Sprintf("files/thumbnails/%v.heic", name), "+delete", ")",
		"(", "+clone", "-resize", "800x180!", "-write", fmt.Sprintf("files/images/%v.heic", name), "+delete", ")",
		"-resize", "800x180!", fmt.Sprintf("files/images/%v.webp", name))
	cmd.Dir = workingDir
	var output bytes.Buffer
	cmd.Stderr = &output
	err = cmd.Run()
	if err != nil {
		fmt.Println("Error resizing banner versions of file.")
		fmt.Println(err)
		fmt.Println(output.String())
		return err
	}

	return err
}