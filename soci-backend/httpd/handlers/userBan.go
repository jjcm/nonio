package handlers

import (
	"encoding/json"
	"fmt"
	"github.com/stripe/stripe-go/v72"
	"github.com/stripe/stripe-go/v72/sub"
	"net/http"
	"os"
	"soci-backend/httpd/utils"
	"soci-backend/models"
)

func UserBan(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		SendResponse(w, utils.MakeError("you can only POST to the get connect link route"), 405)
		return
	}

	// Decode the JSON payload
	type requestPayload struct {
		Username string `json:"username"`
		Reason   string `json:"reason"`
	}

	requestingUser := models.User{}
	requestingUser.FindByID(r.Context().Value("user_id").(int))

	var payload requestPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		sendSystemError(w, fmt.Errorf("decode request payload: %v", err))
		return
	}

	u := models.User{}
	if err := u.FindByUsername(payload.Username); err != nil {
		sendSystemError(w, fmt.Errorf("find user by id: %v", err))
		return
	}

	admin, err := requestingUser.IsAdmin()
	if err != nil {
		sendSystemError(w, fmt.Errorf("find user by id: %v", err))
		return
	}

	// if requesting user is an admin
	if admin {
		// First ban user
		err := u.Ban()
		if err != nil {
			sendSystemError(w, fmt.Errorf("user ban error: %v", err))
			return
		}

		// Cancel his stripe subscription
		params := &stripe.SubscriptionListParams{}
		params.Customer = u.StripeCustomerID
		params.Limit = stripe.Int64(1)
		i := sub.List(params)
		for i.Next() {
			s := i.Subscription()
			_, err := sub.Cancel(s.ID, nil)
			if err != nil {
				sendSystemError(w, fmt.Errorf("subscription cancel erro: %v", err))
				return
			}
		}

		utils.SendEmail(u.Email, "You have been banned", `
			You've been banned from`+os.Getenv("WEB_HOST")+`. The reason for your ban is the following:`+"\n\n"+payload.Reason+"\n\n"+`To challenge this ban, respond to this email. If no response is heard your subscription will be cancelled.`)
	}
}
