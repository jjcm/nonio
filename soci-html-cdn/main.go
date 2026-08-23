package main

import (
	"fmt"
	"net/http"
	"os"
	"soci-html-cdn/config"
	"soci-html-cdn/route"
	"soci-html-cdn/util"
)

func setupRoutes(settings *config.Config) {
	http.HandleFunc("/upload", route.UploadFile)
	http.HandleFunc("/move", route.MoveFile)
	// gzip: this CDN serves HTML/CSS/JS, the most compressible payloads in
	// the system, and previously shipped them uncompressed
	http.Handle("/temp/", http.StripPrefix("/temp/", cacheControl("no-store", util.Gzip(http.FileServer(http.Dir("./files/temp")).ServeHTTP))))
	http.Handle("/nonio-embedded-page.js", cacheControl("public, max-age=300", util.Gzip(http.FileServer(http.Dir("./static")).ServeHTTP)))
	http.Handle("/", cacheControl("public, max-age=3600", util.Gzip(http.FileServer(http.Dir("./files")).ServeHTTP)))

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
