package models

import (
	"fmt"

	"github.com/stripe/stripe-go/v72"
	"github.com/stripe/stripe-go/v72/sub"
)

func FixUserSubs() {
	users := []User{}
	err := DBConn.Select(&users, `SELECT * FROM users where subscription_amount > 0 and stripe_subscription_id = ""`)
	if err != nil {
		Log.Errorf("Error getting users: %v", err)
		return
	}

	if len(users) == 0 {
		return
	}

	Log.Infof("%v Users found with no sub ID. Running patch", len(users))

	for _, u := range users {
		err = FixSubscriptionId(u)
		if err != nil {
			fmt.Println("User sub update failed")
			return
		}
	}

}

func FixSubscriptionId(u User) error {
	// get yesterday's date
	// Check if the user has any active subscriptions, and cancel the others if they're adding one.
	listParams := &stripe.SubscriptionListParams{
		Customer: u.StripeCustomerID,
		Status:   "all",
	}
	listParams.AddExpand("data.default_payment_method")

	iter := sub.List(listParams)
	subscriptions := iter.SubscriptionList().Data
	if len(subscriptions) > 0 {
		fmt.Println(fmt.Sprintf("Subscription found for user %v: %v", u.Username, subscriptions[0].ID))
		u.UpdateStripeSubscriptionId(subscriptions[0].ID)
	}
	Log.Info("update complete")
	return nil
}
