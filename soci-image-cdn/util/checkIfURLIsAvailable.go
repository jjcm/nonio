package util

import (
	"fmt"
	"io/ioutil"
	"net/http"
	"soci-image-cdn/config"
)

// CheckIfURLIsAvailable hits our api server and checks to see if the url is available to upload to
func CheckIfURLIsAvailable(url string) (bool, error) {
	urlCheckRes, err := http.Get(fmt.Sprintf("%v/post/url-is-available/%v", config.Settings.APIHost, url))
	if err != nil {
		fmt.Println("Error checking if url is available")
		fmt.Println(err)
		return false, err
	}
	defer urlCheckRes.Body.Close()
	body, err := ioutil.ReadAll(urlCheckRes.Body)
	if err != nil {
		fmt.Println("Error parsing the body of the url check")
		fmt.Println(err)
		return false, err
	}

	return string(body) == "true", err
}
