package main

import (
	"fmt"
	"net/http"
	"os"
	"soci-avatar-cdn/config"
	"soci-avatar-cdn/route"
)

func setupRoutes(settings *config.Config) {
	http.Handle("/thumbnail/", http.StripPrefix("/thumbnail/", http.FileServer(http.Dir("./files/thumbnails"))))
	http.HandleFunc("/upload", route.UploadFile)
	http.Handle("/", http.FileServer(http.Dir("./files/images")))

	port := os.Getenv("APP_PORT")
	if port == "" {
		port = settings.Port
		if port == "" {
			port = "4202"
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

	fmt.Println("Starting avatar encoding server...")
	setupRoutes(&config.Settings)
}
