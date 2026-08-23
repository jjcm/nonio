package handlers

import (
	"net/http"
	"os"
	"soci-backend/httpd/utils"

	"github.com/stripe/stripe-go/v72"
	"github.com/stripe/stripe-go/v72/price"
)

// StripeGetPriceConfig create a new subscription with fixed price for user
func StripeGetPriceConfig(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		SendResponse(w, utils.MakeError("you can only GET to the price config route"), http.StatusMethodNotAllowed)
		return
	}

	params := &stripe.PriceListParams{
		LookupKeys: stripe.StringSlice([]string{"sample_basic", "sample_premium"}),
	}
	prices := make([]*stripe.Price, 0)

	i := price.List(params)
	for i.Next() {
		prices = append(prices, i.Price())
	}

	output := map[string]interface{}{
		"publishableKey": os.Getenv("STRIPE_PUBLISHABLE_KEY"),
		"prices":         prices,
	}
	SendResponse(w, output, 200)
}
