package util

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"nonio-html-cdn/config"
)

type authorizationResponse struct {
	Error string
	Email string
	ID    int
}

// GetUserEmail checks token on the server to see if it's valid, and if so returns the user's email
func GetUserEmail(bearerToken string) (string, error) {
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

	body, err := ioutil.ReadAll(userAuthRes.Body)
	if err != nil {
		fmt.Println("Error parsing the body of the user auth check")
		fmt.Println(err)
		return "", err
	}

	authResponse := authorizationResponse{}
	err = json.Unmarshal(body, &authResponse)
	if err != nil {
		fmt.Println("Error parsing the json of the user auth check")
		fmt.Println(err)
		return "", err
	}

	if authResponse.Error != "" {
		err = fmt.Errorf(authResponse.Error)
	}

	return authResponse.Email, err
}
