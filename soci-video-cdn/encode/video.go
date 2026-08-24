package encode

import (
	"fmt"
	"io/ioutil"
	"mime/multipart"
	"net/http"
	"time"

	ffmpeg "github.com/floostack/transcoder/ffmpeg"
	"github.com/gorilla/websocket"
)

const (
	pongWait   = 60 * time.Second
	pingPeriod = (pongWait * 9) / 10
)

var (
	upgrader = websocket.Upgrader{
		ReadBufferSize:  1024,
		WriteBufferSize: 1024,
	}
)

//TODO
// I should probs break this into two requests - the upload request, after which returns the temp file name
// then the encode request, which is a websocket req with the temp file name

// Video encodes the video into a webm and returns the path to it
func Video(file multipart.File, url string, w http.ResponseWriter, r *http.Request) error {
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

	format := "mp4"
	overwrite := true

	opts := ffmpeg.Options{
		OutputFormat: &format,
		Overwrite:    &overwrite,
	}

	ffmpegConf := &ffmpeg.Config{
		FfmpegBinPath:   "/usr/local/bin/ffmpeg",
		FfprobeBinPath:  "/usr/local/bin/ffprobe",
		ProgressEnabled: true,
	}

	fmt.Println(tempFile.Name())
	progress, err := ffmpeg.
		New(ffmpegConf).
		Input(tempFile.Name()).
		Output(fmt.Sprintf("files/videos/%v.webm", url)).
		WithOptions(opts).
		Start(opts)

	if err != nil {
		fmt.Println(err)
	}

	for msg := range progress {
		fmt.Println(msg)
	}

	/*
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
	*/

	// probs don't need to full panic?
	/*
		if err != nil {
			panic(output.String())
			return err
		}
	*/

	return err
}
