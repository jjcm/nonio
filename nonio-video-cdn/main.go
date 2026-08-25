package main

import (
	"fmt"
	"net/http"
	"os"
	"nonio-video-cdn/config"
	"nonio-video-cdn/route"
)

func setupRoutes(settings *config.Config) {
	videoCache := "public, max-age=86400"
	http.Handle("/", cacheControl(videoCache, http.FileServer(http.Dir("./files/videos"))))
	http.Handle("/thumbnail/", http.StripPrefix("/thumbnail/", cacheControl(videoCache, http.FileServer(http.Dir("./files/thumbnails")))))
	http.HandleFunc("/upload", route.UploadFile)
	http.HandleFunc("/move", route.MoveFile)
	http.HandleFunc("/encode", route.Encode)

	port := os.Getenv("APP_PORT")
	if port == "" {
		port = settings.Port
		if port == "" {
			port = "4204"
		}
	}

	fmt.Printf("Listening on %v\n", port)
	http.ListenAndServe(":"+port, nil)
}

func main() {
	// parse the config file
	if err := config.ParseJSONFile("./config.json", &config.Settings); err != nil {
		panic(err)
	}
	// validate the config file
	if err := config.Settings.Validate(); err != nil {
		panic(err)
	}

	fmt.Println("Starting video encoding server...")
	setupRoutes(&config.Settings)
}
