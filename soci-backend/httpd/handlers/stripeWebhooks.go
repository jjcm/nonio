package handlers

import (
	"encoding/json"
	"errors"
	"fmt"
	"io/ioutil"
	"net/http"
	"os"
	"soci-backend/httpd/utils"
	"soci-backend/models"
	"time"

	"github.com/stripe/stripe-go/v72"
	"github.com/stripe/stripe-go/v72/webhook"
)

// StripeWebhook create a new customer for user
func StripeWebhook(w http.ResponseWriter, r *http.Request) {
	Log.Info("Stripe: received webhook")
	if r.Method != "POST" {
		SendResponse(w, utils.MakeError("you can only POST to the stripe webhook route"), http.StatusMethodNotAllowed)
		return
	}

	const MaxBodyBytes = int64(65536)

	r.Body = http.MaxBytesReader(w, r.Body, MaxBodyBytes)
	body, err := ioutil.ReadAll(r.Body)
	if err != nil {
		Log.Errorf("Error reading stripe webhook body: %v", err)
		sendSystemError(w, err)
		return
	}

	endPointSecret := os.Getenv("WEBHOOK_ENDPOINT_SECRET")

	event, err := webhook.ConstructEvent(body, r.Header.Get("Stripe-Signature"), endPointSecret)

	if err != nil {
		Log.Error("Error verifying webhook signature")
		sendSystemError(w, err)
		return
	}

	Log.Infof("Stripe: received event %s", event.Type)

	switch event.Type {
	case "payment_intent.succeeded":
		var paymentIntent stripe.PaymentIntent
		err := json.Unmarshal(event.Data.Raw, &paymentIntent)
		if err != nil {
			sendSystemError(w, err)
			return
		}
		u := models.User{}
		if err := u.FindByCustomerId(paymentIntent.Customer.ID); err != nil {
			sendSystemError(w, fmt.Errorf("find user by id: %v", err))
			return
		}
		if u.StripeCustomerID == "" {
			sendSystemError(w, errors.New("no customer for the user"))
			return
		}
		if err := u.UpdateAccountType("supporter"); err != nil {
			sendSystemError(w, fmt.Errorf("find user by id: %v", err))
			return
		}
		Log.Infof("Stripe: payment_intent.succeeded for user %s", u.Username)
	case "payment_intent.payment_failed":
		var paymentIntent stripe.PaymentIntent
		err := json.Unmarshal(event.Data.Raw, &paymentIntent)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error parsing webhook JSON: %v\n", err)
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		u := models.User{}
		if err := u.FindByCustomerId(paymentIntent.Customer.ID); err != nil {
			sendSystemError(w, fmt.Errorf("find user by id: %v", err))
			return
		}
		if u.StripeCustomerID == "" {
			sendSystemError(w, errors.New("no customer for the user"))
			return
		}
		if err := u.UpdateAccountType("free"); err != nil {
			sendSystemError(w, fmt.Errorf("find user by id: %v", err))
			return
		}
		Log.Infof("Stripe: payment_intent.payment_failed for user %s", u.Username)
	case "invoice.paid":
		Log.Info("Stripe invoice paid event detected")
		var invoice stripe.Invoice
		err := json.Unmarshal(event.Data.Raw, &invoice)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error parsing webhook JSON: %v\n", err)
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		u := models.User{}
		if err := u.FindByCustomerId(invoice.Customer.ID); err != nil {
			sendSystemError(w, fmt.Errorf("find user by id: %v", err))
			return
		}
		if u.StripeCustomerID == "" {
			sendSystemError(w, errors.New("no customer for the user"))
			return
		}
		if len(invoice.Lines.Data) == 0 {
			Log.Error("Stripe: No invoice lines")
			//sendSystemError(w, errors.New("no invoice lines"))
			//return
		} else {
			Log.Infof("Period ends on %v", time.Unix(invoice.Lines.Data[0].Period.End, 0))
		}
		err = u.UpdateCurrentPeriodEnd(time.Unix(invoice.PeriodEnd, 0))
		if err != nil {
			sendSystemError(w, fmt.Errorf("update subscription amount: %v", err))
			return
		}
		err = u.CreateFuturePayout(float64(invoice.AmountPaid)/100, time.Unix(invoice.PeriodEnd, 0))
		if err != nil {
			sendSystemError(w, errors.New("error creating future payout"))
			return
		}
		Log.Infof("Stripe: invoice.paid for user %s", u.Username)
	}

	SendResponse(w, true, 200)
}
