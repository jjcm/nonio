package util

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"soci-avatar-cdn/config"
)

type communityResponse struct {
	Error   string
	IsAdmin bool `json:"isAdmin"`
}

// VerifyCommunityAdmin checks if the user is an admin of the community
func VerifyCommunityAdmin(communityURL, bearerToken string) (bool, error) {
	client := &http.Client{}
	req, err := http.NewRequest("GET", fmt.Sprintf("%v/communities/%v", config.Settings.APIHost, communityURL), nil)
	req.Header.Add("Authorization", bearerToken)

	res, err := client.Do(req)
	if err != nil {
		return false, err
	}
	defer res.Body.Close()

	body, err := ioutil.ReadAll(res.Body)
	if err != nil {
		return false, err
	}

	cRes := communityResponse{}
	err = json.Unmarshal(body, &cRes)
	if err != nil {
		return false, err
	}

	if cRes.Error != "" {
		return false, fmt.Errorf(cRes.Error)
	}

	return cRes.IsAdmin, nil
}

