package main

import (
	"fmt"
	"net/http"
	"os"
	"nonio-image-cdn/config"
	"nonio-image-cdn/route"
)

func setupRoutes(settings *config.Config) {
	imageCache := "public, max-age=86400"
	http.Handle("/", cacheControl(imageCache, http.FileServer(http.Dir("./files/images"))))
	http.Handle("/thumbnail/", http.StripPrefix("/thumbnail/", cacheControl(imageCache, http.FileServer(http.Dir("./files/thumbnails")))))
	http.HandleFunc("/upload", route.UploadFile)
	http.HandleFunc("/fetch-og-image", route.FetchOGImage)
	http.HandleFunc("/move", route.MoveFile)

	port := os.Getenv("APP_PORT")
	if port == "" {
		port = settings.Port
		if port == "" {
			port = "4203"
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

	fmt.Println("Starting image encoding server...")
	setupRoutes(&config.Settings)
}
