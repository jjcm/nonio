package encode

import (
	"bytes"
	"encoding/binary"
	"errors"
	"fmt"
	"io"
	"io/ioutil"
	"os"
	"os/exec"
	"strings"

	"github.com/h2non/filetype"
)

// execCommand is a seam so the encoding pipeline can be asserted on without
// imagemagick present.
var execCommand = exec.Command

// heifBrands are the ISO-BMFF ftyp brands HEIC/HEIF stills ship with. filetype
// only knows "heic", so an iPhone export carrying any of the others would be
// turned away before we get the chance to transcode it.
var heifBrands = map[string]bool{
	"heic": true, "heix": true, "heim": true, "heis": true, "heif": true,
	"hevc": true, "hevx": true, "hevm": true, "hevs": true,
	"mif1": true, "msf1": true,
}

// isHEIF reports whether buf starts with a HEIC/HEIF ftyp box, checking the
// major brand and then the compatible brands that follow the minor version.
func isHEIF(buf []byte) bool {
	if len(buf) < 12 || string(buf[4:8]) != "ftyp" {
		return false
	}
	if heifBrands[string(buf[8:12])] {
		return true
	}
	box := int(binary.BigEndian.Uint32(buf[0:4]))
	for i := 16; i+4 <= len(buf) && i+4 <= box; i += 4 {
		if heifBrands[string(buf[i:i+4])] {
			return true
		}
	}
	return false
}

// imageMIME sniffs the upload's own bytes rather than trusting the declared
// content type, and reports HEIC/HEIF as image/heif so it reaches the encoder.
func imageMIME(buf []byte) (string, error) {
	if isHEIF(buf) {
		return "image/heif", nil
	}
	kind, err := filetype.Match(buf)
	if err != nil {
		return "", err
	}
	if !strings.HasPrefix(kind.MIME.Value, "image/") {
		return "", errors.New("file type not supported")
	}
	return kind.MIME.Value, nil
}

// encodeCommands returns the commands that turn src into the image and
// thumbnail for url. Every output is a webp: HEIC/HEIF is transcoded with the
// same settings as any other photo so nothing but webp reaches the disk.
func encodeCommands(mime, src, url string) [][]string {
	image := fmt.Sprintf("files/images/%v.webp", url)
	thumbnail := fmt.Sprintf("files/thumbnails/%v.webp", url)

	switch mime {
	case "image/gif":
		// Gifs need a static thumbnail off the first frame, then gif2webp for
		// the animation itself.
		return [][]string{
			{"convert", fmt.Sprintf("%v[0]", src), "-resize", "192x144^", thumbnail},
			{"gif2webp", src, "-o", image},
		}
	case "image/png":
		// Screenshots and line art keep their edges with lossless webp.
		return [][]string{{"convert", src, "(", "+clone", "-resize", "192x144^", "-write", thumbnail, "+delete", ")", "-define", "webp:lossless=true", image}}
	default:
		return [][]string{{"convert", src, "(", "+clone", "-resize", "192x144^", "-write", thumbnail, "+delete", ")", image}}
	}
}

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

	mime, err := imageMIME(fileBytes)
	if err != nil {
		fmt.Println(err)
		return err
	}

	workingDir, err := os.Getwd()
	if err != nil {
		fmt.Println(err)
		return err
	}

	for _, args := range encodeCommands(mime, tempFile.Name(), url) {
		cmd := execCommand(args[0], args[1:]...)
		cmd.Dir = workingDir
		var output bytes.Buffer
		cmd.Stderr = &output
		if err := cmd.Run(); err != nil {
			// The stderr matters here: a missing imagemagick delegate for the
			// uploaded format is otherwise an opaque "exit status 1".
			err = fmt.Errorf("%v: %v: %v", args[0], err, strings.TrimSpace(output.String()))
			fmt.Println(err)
			return err
		}
	}

	return nil
}
