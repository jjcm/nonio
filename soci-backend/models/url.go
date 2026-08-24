package models

import (
	"fmt"

	"github.com/otiai10/opengraph/v2"
)

// URLIsAvailable - check the database to see if a given URL is available for a specific community
func URLIsAvailable(url string, communityID int) (bool, error) {
	var total int
	err := DBConn.Get(&total, "SELECT COUNT(*) FROM posts WHERE url = ? AND COALESCE(community_id, 0) = ?", url, communityID)
	if err != nil {
		return false, err
	}
	if total != 0 {
		return false, nil
	}
	return true, nil
}

type OGMetadata struct {
	Title       string `json:"title"`
	Description string `json:"description"`
	Image       string `json:"image"`
}

func ParseExternalURL(url string) (OGMetadata, error) {
	ogMetadata := OGMetadata{}
	ogp, _ := opengraph.Fetch(url)
	ogMetadata.Title = ogp.Title
	ogMetadata.Description = ogp.Description
	if len(ogp.Image) > 0 {
		ogMetadata.Image = ogp.Image[0].URL
	}
	fmt.Println(ogMetadata.Description)
	fmt.Println(ogMetadata.Title)
	fmt.Println(ogMetadata.Image)

	return ogMetadata, nil
}
