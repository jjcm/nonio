package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"soci-backend/httpd/utils"

	"github.com/stripe/stripe-go/v72"
	"github.com/stripe/stripe-go/v72/sub"
)

// StripeEditSubscription update a subscription
func StripeEditSubscription(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		SendResponse(w, utils.MakeError("you can only POST to the update subscription route"), http.StatusMethodNotAllowed)
		return
	}

	type requestPayload struct {
		SubscriptionID string `json:"subscriptionId"`
		NewPriceID     string `json:"newPriceId"`
	}
	var payload requestPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		sendSystemError(w, fmt.Errorf("decode request payload: %v", err))
		return
	}

	subscription, err := sub.Get(payload.SubscriptionID, nil)
	if err != nil {
		sendSystemError(w, fmt.Errorf("load subscription: %v", err))
		return
	}

	params := &stripe.SubscriptionParams{
		Items: []*stripe.SubscriptionItemsParams{{
			ID:    stripe.String(subscription.Items.Data[0].ID),
			Price: stripe.String(payload.NewPriceID),
		}},
	}
	updatedSubscription, err := sub.Update(payload.SubscriptionID, params)
	if err != nil {
		sendSystemError(w, fmt.Errorf("update subscription: %v", err))
		return
	}

	output := map[string]interface{}{
		"subscription": updatedSubscription,
	}
	SendResponse(w, output, 200)
}
