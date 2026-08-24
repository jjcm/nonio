package util

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"soci-image-cdn/config"
)

type authorizationResponse struct {
	Error string
	Email string
	ID    int
}

// GetUserEmail checks token on the server to see if it's valid, and if so returns the user's email
func GetUserEmail(bearerToken string) (string, error) {
	// Send a req to the api to get the email from our token, if it's valid
	client := &http.Client{}
	req, err := http.NewRequest("GET", fmt.Sprintf("%v/protected", config.Settings.APIHost), nil)
	req.Header.Add("Authorization", bearerToken)
	userAuthRes, err := client.Do(req)
	if err != nil {
		fmt.Println("Error checking if the user is authorized")
		fmt.Println(err)
		return "", err
	}
	defer userAuthRes.Body.Close()

	// Parse the body of the request once it comes back
	body, err := ioutil.ReadAll(userAuthRes.Body)
	if err != nil {
		fmt.Println("Error parsing the body of the user auth check")
		fmt.Println(err)
		return "", err
	}

	// Create a authResponse struct, fill it with the parsed json values
	authResponse := authorizationResponse{}
	err = json.Unmarshal(body, &authResponse)
	if err != nil {
		fmt.Println("Error parsing the json of the user auth check")
		fmt.Println(err)
		return "", err
	}

	// Populate our error with the json response's error
	if authResponse.Error != "" {
		err = fmt.Errorf(authResponse.Error)
	}

	return authResponse.Email, err
}
