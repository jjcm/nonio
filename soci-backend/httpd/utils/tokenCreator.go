package utils

import (
	"time"

	jwt "github.com/dgrijalva/jwt-go"
)

// HmacSampleSecret this is the random string needed to sign/encrypt/decrypt the
// JWT tokens
var HmacSampleSecret []byte

// TokenCreator creates a jwt token for us to use
func TokenCreator(email string, expiresAfterHours time.Duration, tokenType string) (string, error) {
	expirationTime := time.Now().Add(time.Hour * expiresAfterHours)
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"email":     email,
		"expiresAt": expirationTime.Unix(),
		"type":      tokenType,
	})
	tokenString, err := token.SignedString(HmacSampleSecret)
	if err != nil {
		return "", err
	}

	return tokenString, nil
}
