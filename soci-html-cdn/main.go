package main

import (
	"fmt"
	"net/http"
	"os"
	"soci-html-cdn/config"
	"soci-html-cdn/route"
)

func setupRoutes(settings *config.Config) {
	http.HandleFunc("/upload", route.UploadFile)
	http.HandleFunc("/move", route.MoveFile)
	http.Handle("/temp/", http.StripPrefix("/temp/", http.FileServer(http.Dir("./files/temp"))))
	http.Handle("/nonio-embedded-page.js", http.FileServer(http.Dir("./static")))
	http.Handle("/", http.FileServer(http.Dir("./files")))

	port := os.Getenv("APP_PORT")
	if port == "" {
		port = settings.Port
		if port == "" {
			port = "4205"
		}
	}

	fmt.Printf("Listening on %v\n", port)
	http.ListenAndServe(":"+port, nil)
}

func main() {
	if err := config.ParseJSONFile("./config.json", &config.Settings); err != nil {
		panic(err)
	}
	if err := config.Settings.Validate(); err != nil {
		panic(err)
	}

	fmt.Println("Starting html upload server...")
	setupRoutes(&config.Settings)
}
