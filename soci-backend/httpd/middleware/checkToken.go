package middleware

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"soci-backend/httpd/handlers"
	"soci-backend/httpd/utils"
	"soci-backend/models"

	jwt "github.com/dgrijalva/jwt-go"
)

// CheckToken this acts as a middleware, but I'm not really using any middleware packages
func CheckToken(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		token := r.Header.Get("Authorization")
		if strings.TrimSpace(token) == "" || strings.TrimSpace(token) == "Bearer" {
			handlers.SendResponse(w, "Authorization required", http.StatusUnauthorized)
			return
		}

		// if the header starts with "Bearer " then let's trim that junk
		if token[:7] == "Bearer " {
			token = token[7:]
		}

		goodies, err := jwt.Parse(token, func(token *jwt.Token) (interface{}, error) {
			// Don't forget to validate the alg is what you expect:
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
			}

			// hmacSampleSecret is a []byte containing your secret, e.g. []byte("my_secret_key")
			return utils.HmacSampleSecret, nil
		})

		claims, ok := goodies.Claims.(jwt.MapClaims)
		if !ok || !goodies.Valid || err != nil {
			handlers.SendResponse(w, utils.MakeError("error working with your token"), 500)
			return
		}

		// check expiresAt inside the token
		// convert unix timestamp to int
		i := int64(claims["expiresAt"].(float64))
		ts := time.Unix(i, 0)
		now := time.Now()
		if now.After(ts) {
			handlers.SendResponse(w, utils.MakeError("your token is expired"), http.StatusUnauthorized)
			return
		}
		secondsRemaining := int(ts.Sub(now).Seconds())
		w.Header().Set("X-Seconds-Remaining", strconv.Itoa(secondsRemaining))

		user := models.User{}
		user.FindByEmail(claims["email"].(string))
		if user.ID == 0 {
			handlers.SendResponse(w, utils.MakeError("your user is no longer valid"), http.StatusUnauthorized)
			return
		}
		Log.Info(fmt.Sprintf("%v is accessing %v", user.Username, r.RequestURI))
		ctx := context.WithValue(r.Context(), "user_email", user.Email)
		ctx = context.WithValue(ctx, "user_id", user.ID)
		ctx = context.WithValue(ctx, "user_username", user.Username)
		next(w, r.WithContext(ctx))
	}
}

// CheckTokenOptional - checks token if present, but doesn't fail if missing
func CheckTokenOptional(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		token := r.Header.Get("Authorization")
		if strings.TrimSpace(token) == "" || strings.TrimSpace(token) == "Bearer" {
			next(w, r)
			return
		}

		// if the header starts with "Bearer " then let's trim that junk
		if len(token) > 7 && token[:7] == "Bearer " {
			token = token[7:]
		}

		goodies, err := jwt.Parse(token, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
			}
			return utils.HmacSampleSecret, nil
		})

		if err != nil || !goodies.Valid {
			// If token is invalid, just proceed as unauthenticated
			next(w, r)
			return
		}

		claims, ok := goodies.Claims.(jwt.MapClaims)
		if !ok {
			next(w, r)
			return
		}

		i := int64(claims["expiresAt"].(float64))
		ts := time.Unix(i, 0)
		now := time.Now()
		if now.After(ts) {
			next(w, r)
			return
		}

		user := models.User{}
		user.FindByEmail(claims["email"].(string))
		if user.ID == 0 {
			next(w, r)
			return
		}

		ctx := context.WithValue(r.Context(), "user_email", user.Email)
		ctx = context.WithValue(ctx, "user_id", user.ID)
		ctx = context.WithValue(ctx, "user_username", user.Username)
		next(w, r.WithContext(ctx))
	}
}
