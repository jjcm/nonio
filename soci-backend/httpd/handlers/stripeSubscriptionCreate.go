package handlers

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"soci-backend/httpd/utils"
	"soci-backend/models"
	"time"

	price2 "github.com/stripe/stripe-go/v72/price"

	"github.com/stripe/stripe-go/v72"
	"github.com/stripe/stripe-go/v72/paymentmethod"
	"github.com/stripe/stripe-go/v72/sub"
)

// StripeCreateSubscription create a new subscription with fixed price for user
func StripeCreateSubscription(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		SendResponse(w, utils.MakeError("you can only POST to the stripe create customer route"), http.StatusMethodNotAllowed)
		return
	}

	// Decode the JSON payload
	type requestPayload struct {
		PaymentMethodID string `json:"paymentMethodId"`
		Price           int64  `json:"price"`
	}

	var payload requestPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		sendSystemError(w, fmt.Errorf("decode request payload: %v", err))
		return
	}

	// Get the user from the context of who made the request
	uid := r.Context().Value("user_id").(int)

	u := models.User{}
	if err := u.FindByID(uid); err != nil {
		sendSystemError(w, fmt.Errorf("find user by id: %v", err))
		return
	}
	if u.StripeCustomerID == "" {
		sendSystemError(w, errors.New("no customer for the user"))
		return
	}

	// Attach the payment method to the customer
	paymentParams := &stripe.PaymentMethodAttachParams{
		Customer: stripe.String(u.StripeCustomerID),
	}

	_, err := paymentmethod.Attach(
		payload.PaymentMethodID,
		paymentParams,
	)

	if err != nil {
		sendSystemError(w, fmt.Errorf("attaching payment method failed: %v", err))
		return
	}

	// Check if the user has any active subscriptions, and cancel the others if they're adding one.
	listParams := &stripe.SubscriptionListParams{
		Customer: u.StripeCustomerID,
		Status:   "all",
	}
	listParams.AddExpand("data.default_payment_method")

	iter := sub.List(listParams)
	subscriptions := iter.SubscriptionList().Data
	if len(subscriptions) > 0 {
		Log.Info(fmt.Sprintf("%v subscriptions found for %v. Cancelling...", len(subscriptions), u.Username))
		for i := 0; i < len(subscriptions); i++ {
			if subscriptions[i].Status != "canceled" && subscriptions[i].Status != "incomplete_expired" {
				Log.Info(fmt.Sprintf("Cancelling %v. Status %v", subscriptions[i].ID, subscriptions[i].Status))
				subscription, err := sub.Cancel(subscriptions[i].ID, nil)
				if err != nil {
					sendSystemError(w, fmt.Errorf("cancel subscription: %v", err))
					return
				}
				Log.Info(fmt.Sprintf("Cancelled %v", subscription.ID))
			}
		}
		Log.Info("Old subscriptions cancelled.")
		time.Sleep(5 * time.Second)
	}

	// get products with this amount
	priceListParams := &stripe.PriceListParams{}
	priceListParams.Active = stripe.Bool(true)
	priceListParams.Currency = stripe.String(string(stripe.CurrencyUSD))
	i := price2.List(priceListParams)

	var priceId string

	for i.Next() {
		p := i.Price()
		if p.UnitAmount == payload.Price*100 {
			priceId = p.ID
			break
		}
	}

	if err != nil {
		sendSystemError(w, fmt.Errorf("creating price: %v", err))
		return
	}

	// Create subscription
	subscriptionParams := &stripe.SubscriptionParams{
		Customer: stripe.String(u.StripeCustomerID),
		Items: []*stripe.SubscriptionItemsParams{
			{
				Price: stripe.String(priceId),
			},
		},
		PaymentBehavior:      stripe.String("error_if_incomplete"),
		DefaultPaymentMethod: stripe.String(payload.PaymentMethodID),
	}

	subscriptionParams.AddExpand("latest_invoice.payment_intent")
	newSub, err := sub.New(subscriptionParams)
	if err != nil {
		sendSystemError(w, fmt.Errorf("new subscription: %v", err))
		return
	}

	// Update subscription amount in user model
	err = u.UpdateSubscriptionAmount(payload.Price)
	if err != nil {
		sendSystemError(w, fmt.Errorf("update subscription amount: %v", err))
		return
	}

	// Set current_period_end of subscription for user
	err = u.UpdateCurrentPeriodEnd(time.Unix(newSub.CurrentPeriodEnd, 0))
	if err != nil {
		sendSystemError(w, fmt.Errorf("update current_period_end: %v", err))
		return
	}

	// Set next_payout equal to current_period_end
	err = u.UpdateNextPayout(time.Unix(newSub.CurrentPeriodEnd, 0))
	if err != nil {
		sendSystemError(w, fmt.Errorf("update next_payout: %v", err))
		return
	}

	u.UpdateStripeSubscriptionId(newSub.ID)

	// If everything looks good, then send some info back to the user
	output := map[string]interface{}{
		"subscriptionId": newSub.ID,
		"clientSecret":   newSub.LatestInvoice.PaymentIntent.ClientSecret,
	}
	SendResponse(w, output, 200)
}
