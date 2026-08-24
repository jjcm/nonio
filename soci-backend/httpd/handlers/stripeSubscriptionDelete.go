package handlers

import (
	"fmt"
	"net/http"
	"soci-backend/httpd/utils"
	"soci-backend/models"

	"github.com/stripe/stripe-go/v72/sub"
)

// StripeCancelSubscription cancel a subscription
func StripeCancelSubscription(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		SendResponse(w, utils.MakeError("you can only POST to the cancel subscription route"), http.StatusMethodNotAllowed)
		return
	}

	u := models.User{}
	u.FindByID(r.Context().Value("user_id").(int))

	if u.StripeSubscriptionID == "" {
		sendSystemError(w, fmt.Errorf("no subscription for the user"))
		return
	}

	_, err := sub.Cancel(u.StripeSubscriptionID, nil)
	if err != nil {
		sendSystemError(w, fmt.Errorf("cancel subscription: %v", err))
		return
	}

	u.UpdateStripeSubscriptionId("")

	SendResponse(w, true, 200)
}
