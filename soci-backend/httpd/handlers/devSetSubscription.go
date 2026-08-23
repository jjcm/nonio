package handlers

import (
	"encoding/json"
	"net/http"
	"os"
	"soci-backend/httpd/utils"
	"soci-backend/models"
	"time"
)

// DevSetSubscription is a dev-only endpoint for simulator use.
// It lets an authenticated user set their own subscription_amount (in dollars),
// and ensures they have an upcoming subscription-funded payout scheduled.
//
// Enabled only when DEV_TOOLS_ENABLED=true.
func DevSetSubscription(w http.ResponseWriter, r *http.Request) {
	if os.Getenv("DEV_TOOLS_ENABLED") != "true" {
		SendResponse(w, utils.MakeError("dev tools are disabled"), 404)
		return
	}
	if r.Method != "POST" {
		SendResponse(w, utils.MakeError("you can only POST to this route"), 405)
		return
	}

	type requestPayload struct {
		Amount int64 `json:"amount"`
	}
	var payload requestPayload
	_ = json.NewDecoder(r.Body).Decode(&payload)
	if payload.Amount <= 0 {
		SendResponse(w, utils.MakeError("amount must be > 0"), 400)
		return
	}

	u := models.User{}
	if err := u.FindByID(r.Context().Value("user_id").(int)); err != nil {
		sendSystemError(w, err)
		return
	}

	if err := u.UpdateSubscriptionAmount(payload.Amount); err != nil {
		sendSystemError(w, err)
		return
	}
	// Keep in-memory struct consistent for subsequent helper calls.
	u.SubscriptionAmount = float64(payload.Amount)
	_ = u.UpdateAccountType("supporter")

	// Ensure payout row exists for the current simulated period end.
	now := time.Now().UTC()
	if err := models.EnsureSubscriptionPayoutForUser(&u, now, models.PayoutCycleDuration()); err != nil {
		// Fallback: still return updated user info if payout scheduling fails.
		Log.Error("dev set subscription: ensure payout failed: ", err)
	}

	SendResponse(w, map[string]interface{}{"ok": true, "subscriptionAmount": payload.Amount}, 200)
}


