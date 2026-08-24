package route

import (
	"fmt"
	"math"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"soci-video-cdn/util"
	"strconv"
	"strings"
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

// Encode accepts either a filename or url as a param
// If url is provided, it looks up the temp filename and connects to existing encoding if in progress
func Encode(w http.ResponseWriter, r *http.Request) {
	// Allow connections from anywhere
	if r.Method == "OPTIONS" {
		util.SendResponse(w, "", 200)
		return
	}
	upgrader.CheckOrigin = func(r *http.Request) bool {
		return true
	}

	// Upgrade the connection to a websocket
	ws, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		fmt.Println(err)
		if _, ok := err.(websocket.HandshakeError); !ok {
			fmt.Println(err)
		}
		return
	}
	defer ws.Close()

	// Get filename from either 'file' or 'url' parameter
	var filename string
	var baseFilename string
	
	if urlParam, ok := r.URL.Query()["url"]; ok && len(urlParam) > 0 && urlParam[0] != "" {
		// URL parameter provided - look up the temp filename
		postURL := urlParam[0]
		tempFilename, found := util.GetFilenameFromURL(postURL)
		if !found {
			ws.WriteMessage(websocket.TextMessage, []byte("Error: No encoding session found for this URL"))
			ws.Close()
			return
		}
		baseFilename = tempFilename
		filename = tempFilename + ".mp4"
		
		// Check if encoding is already in progress
		if session, exists := util.GetSession(baseFilename); exists {
			// Add this connection to the existing session
			session.AddConnection(ws)
			// Send current resolution if available
			if session.Resolution != "" {
				ws.WriteMessage(websocket.TextMessage, []byte(fmt.Sprintf("resolution:%v", session.Resolution)))
			}
			// Keep connection alive - progress updates will be broadcast from the encoding process
			// Wait for connection to close
			for {
				_, _, err := ws.ReadMessage()
				if err != nil {
					break
				}
			}
			return
		}
		// If no session exists but we have a URL, we can't start encoding without the temp file
		// This shouldn't happen, but handle it gracefully
		ws.WriteMessage(websocket.TextMessage, []byte("Error: Encoding not started for this URL"))
		ws.Close()
		return
	} else if fileParam, ok := r.URL.Query()["file"]; ok && len(fileParam) > 0 {
		// File parameter provided - use it directly
		filename = fileParam[0]
		baseFilename = strings.TrimSuffix(filename, filepath.Ext(filename))
	} else {
		ws.WriteMessage(websocket.TextMessage, []byte("Error: Must provide either 'file' or 'url' parameter"))
		ws.Close()
		return
	}

	// Check if encoding is already in progress for this file
	if session, exists := util.GetSession(baseFilename); exists {
		// Encoding already in progress - add this connection to the session
		session.AddConnection(ws)
		// Send current resolution if available
		if session.Resolution != "" {
			ws.WriteMessage(websocket.TextMessage, []byte(fmt.Sprintf("resolution:%v", session.Resolution)))
		}
		// Keep connection alive
		for {
			_, _, err := ws.ReadMessage()
			if err != nil {
				break
			}
		}
		return
	}

	// Start new encoding session
	session := util.GetOrCreateSession(baseFilename)
	session.AddConnection(ws)
	defer util.CloseSession(baseFilename)

	fmt.Printf("Encoding starting for %v\n", filename)
	out, err := exec.Command("ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=s=x:p=0", fmt.Sprintf("files/temp-videos/%v", filename)).Output()
	if err != nil {
		fmt.Println(err)
	}
	resolution := strings.Split(strings.TrimSpace(string(out)), "x")
	if len(resolution) < 1 {
		fmt.Println("Cannot detect resolution")
	}
	x, err := strconv.ParseFloat(resolution[0], 64)
	if err != nil {
		fmt.Println("Error detecting x resolution")
		fmt.Println(err)
	}
	y, err := strconv.ParseFloat(resolution[1], 64)
	if err != nil {
		fmt.Println("Error detecting y resolution")
		fmt.Println(err)
	}
	out, _ = exec.Command("ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream_tags=rotate", "-of", "default=nw=1:nk=1", "-i", fmt.Sprintf("files/temp-videos/%v", filename)).Output()
	rotation, err := strconv.Atoi(strings.TrimSpace(string(out)))
	if err != nil {
		fmt.Println("Error detecting rotation, trying again with stream_side_data")
		// Try again with stream_side data
		out, _ = exec.Command("ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream_side_data=rotation", "-of", "default=nw=1:nk=1", "-i", fmt.Sprintf("files/temp-videos/%v", filename)).Output()
		rotation, err = strconv.Atoi(strings.TrimSpace(string(out)))
		if err != nil {
			fmt.Println("Error detecting rotation")
			fmt.Println(err)
		}
	}

	nativeSize := math.Max(x, y)

	// Check and see if there's metadata for rotation. If so and it's 90deg or 270deg, swap the x and y resolution.
	if (rotation-90)%180 == 0 {
		tmpX := x
		x = y
		y = tmpX
	}

	resolutionMsg := fmt.Sprintf("resolution:%vx%v", x, y)
	session.Resolution = fmt.Sprintf("%vx%v", x, y)
	session.Broadcast([]byte(resolutionMsg))
	fmt.Printf("resolution:%vx%v\n", x, y)

	// For bitrates, we use 2 * the number of pixels
	// I.e. 8k has 33 million pixels, so we use 66Mbps
	nativeBitrate := "1M"
	var downscaleResolution string
	var time int64

	// Halfway between 720p and 480p
	// ( 1280 + 854 ) / 2 == 1600
	if nativeSize > 1067 {
		nativeBitrate = "1.8M"
		if x > y {
			downscaleResolution = fmt.Sprintf("854x%0.f", math.RoundToEven(854*(y/x)/2)*2)
		} else {
			downscaleResolution = fmt.Sprintf("%0.fx854", math.RoundToEven(854*(x/y)/2)*2)
		}
		if time, err = EncodeToFormat(session, filename, "-480p", "0.8M", downscaleResolution); err != nil {
			return
		}
		fmt.Printf("480p finished: %vs\n", time)
	}

	// Halfway between 1080p and 720p
	// ( 1920 + 1280 ) / 2 == 1600
	if nativeSize > 1600 {
		nativeBitrate = "4M"
		if x > y {
			downscaleResolution = fmt.Sprintf("1280x%0.f", math.RoundToEven(1280*(y/x)/2)*2)
		} else {
			downscaleResolution = fmt.Sprintf("%0.fx1280", math.RoundToEven(1280*(x/y)/2)*2)
		}
		if time, err = EncodeToFormat(session, filename, "-720p", "1.8M", downscaleResolution); err != nil {
			return
		}
		fmt.Printf("720p finished: %vs\n", time)
	}

	// Halfway between 1440p and 1080p
	// ( 2560 + 1920 ) / 2 == 2240
	if nativeSize > 2240 {
		nativeBitrate = "7.2M"
		if x > y {
			downscaleResolution = fmt.Sprintf("1920x%0.f", math.RoundToEven(1920*(y/x)/2)*2)
		} else {
			downscaleResolution = fmt.Sprintf("%0.fx1920", math.RoundToEven(1920*(x/y)/2)*2)
		}
		if time, err = EncodeToFormat(session, filename, "-1080p", "4M", downscaleResolution); err != nil {
			return
		}
		fmt.Printf("1080p finished: %vs\n", time)
	}

	// Halfway between 4k and 1440p
	// ( 3840 + 2560 ) / 2 == 3200
	if nativeSize > 3200 {
		nativeBitrate = "16.6M"
		if x > y {
			downscaleResolution = fmt.Sprintf("2560x%0.f", math.RoundToEven(2560*(y/x)/2)*2)
		} else {
			downscaleResolution = fmt.Sprintf("%0.fx2560", math.RoundToEven(2560*(x/y)/2)*2)
		}
		if time, err = EncodeToFormat(session, filename, "-1440p", "7.2M", downscaleResolution); err != nil {
			return
		}
		fmt.Printf("1440p finished: %vs\n", time)
	}

	// Seriously what are they uploading that we need to downscale to 4k?
	// Halfway between 8k and 4k
	// ( 7680 + 3840 ) / 2 == 5760
	if nativeSize > 5760 {
		nativeBitrate = "66M"
		if x > y {
			downscaleResolution = fmt.Sprintf("3840x%0.f", math.RoundToEven(3840*(y/x)/2)*2)
		} else {
			downscaleResolution = fmt.Sprintf("%0.fx3840", math.RoundToEven(3840*(x/y)/2)*2)
		}
		if time, err = EncodeToFormat(session, filename, "-2160p", "16.6M", downscaleResolution); err != nil {
			return
		}
		fmt.Printf("4k finished: %vs\n", time)
	}

	if time, err = EncodeToFormat(session, filename, "", nativeBitrate, fmt.Sprintf("%0.fx%0.f", x, y)); err != nil {
		return
	}
	fmt.Printf("Source finished: %vs\n", time)
	fmt.Printf("Encoding finished for %v\n", filename)

	// Check if we have a URL mapping for this filename (user submitted while encoding)
	if postURL, ok := util.GetURLFromFilename(baseFilename); ok {
		// Move the encoded files to the final URL
		err := moveEncodedFiles(baseFilename, postURL)
		if err != nil {
			fmt.Printf("Error moving encoded files: %v\n", err)
		} else {
			fmt.Printf("Moved encoded files from %v to %v\n", baseFilename, postURL)
		}
		
		// Notify backend that encoding is complete
		if err := util.NotifyEncodingComplete(postURL); err != nil {
			fmt.Printf("Error notifying backend of encoding completion: %v\n", err)
		} else {
			fmt.Printf("Notified backend that encoding is complete for %v\n", postURL)
		}
		// Clean up the mapping
		util.DeleteFilenameMapping(baseFilename)
	}
}

// EncodeToFormat encodes a video source and sends back progress via the websocket session
func EncodeToFormat(session *util.EncodingSession, filename string, suffix string, bitrate string, size string) (int64, error) {
	now := time.Now()
	start := now.Unix()
	// Set up our encoding options
	ffmpegConf := &ffmpeg.Config{
		FfmpegBinPath:   "/usr/local/bin/ffmpeg",
		FfprobeBinPath:  "/usr/local/bin/ffprobe",
		ProgressEnabled: true,
	}

	overwrite := true
	format := "mp4"
	codec := "h264"
	pix_fmt := "yuv420p"

	opts := ffmpeg.Options{
		OutputFormat: &format,
		Overwrite:    &overwrite,
		VideoCodec:   &codec,
		VideoBitRate: &bitrate,
		Resolution:   &size,
		PixFmt:       &pix_fmt,
	}

	progress, err := ffmpeg.
		New(ffmpegConf).
		Input(fmt.Sprintf("files/temp-videos/%v", filename)).
		Output(fmt.Sprintf("files/videos/%v%v.mp4", strings.TrimSuffix(filename, filepath.Ext(filename)), suffix)).
		WithOptions(opts).
		Start(opts)

	if err != nil {
		// TODO: this doesn't seem to throw an error when things go wrong.
		// Easiest way to test: try and encode a h264 video at 25x25 resolution
		// It will fail since h264 doesn't allow resolutions that arent divisible by 2
		fmt.Println(err)
		session.Broadcast([]byte("Error"))
		return 0, err
	}

	if len(suffix) == 0 {
		suffix = "source"
	} else {
		suffix = strings.TrimPrefix(suffix, "-")
	}
	for msg := range progress {
		progressMsg := []byte(fmt.Sprintf("%v:%.1f", suffix, msg.GetProgress()))
		session.Broadcast(progressMsg)
	}
	session.Broadcast([]byte(fmt.Sprintf("%v:100", suffix)))

	now = time.Now()
	end := now.Unix()

	return end - start, nil
}

// moveEncodedFiles moves all encoded video files from temp filename to final URL
func moveEncodedFiles(tempFile, finalURL string) error {
	// Move source file
	if _, err := os.Stat(fmt.Sprintf("files/videos/%v.mp4", tempFile)); err == nil {
		if err := os.Rename(fmt.Sprintf("files/videos/%v.mp4", tempFile), fmt.Sprintf("files/videos/%v.mp4", finalURL)); err != nil {
			return fmt.Errorf("error renaming source file: %v", err)
		}
	}

	// Move resolution variants
	resolutions := []string{"2160p", "1440p", "1080p", "720p", "480p"}
	for _, res := range resolutions {
		srcPath := fmt.Sprintf("files/videos/%v-%v.mp4", tempFile, res)
		dstPath := fmt.Sprintf("files/videos/%v-%v.mp4", finalURL, res)
		if _, err := os.Stat(srcPath); err == nil {
			if err := os.Rename(srcPath, dstPath); err != nil {
				return fmt.Errorf("error renaming %v file: %v", res, err)
			}
		}
	}

	return nil
}
