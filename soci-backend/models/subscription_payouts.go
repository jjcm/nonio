package models

import (
	"os"
	"strconv"
	"time"
)

// payoutCycleDays returns the length of a "subscription period" used to schedule payouts.
// This is ONLY meant for dev/testing (simulator mode). Production uses Stripe invoice period_end.
//
// Env:
// - PAYOUT_CYCLE_DAYS: integer days, default 30
func payoutCycleDays() int {
	v := os.Getenv("PAYOUT_CYCLE_DAYS")
	if v == "" {
		return 30
	}
	n, err := strconv.Atoi(v)
	if err != nil || n <= 0 {
		return 30
	}
	return n
}

func payoutCycleDuration() time.Duration {
	return time.Duration(payoutCycleDays()) * 24 * time.Hour
}

// PayoutCycleDays is the exported version of payoutCycleDays for dev tooling.
func PayoutCycleDays() int {
	return payoutCycleDays()
}

// PayoutCycleDuration is the exported version of payoutCycleDuration for dev tooling.
func PayoutCycleDuration() time.Duration {
	return payoutCycleDuration()
}

// EnsureSubscriptionPayouts creates future payout rows for users with a non-zero subscription_amount,
// on their current_period_end. In dev, if current_period_end is missing or in the past, it advances
// it by PAYOUT_CYCLE_DAYS and creates a payout for that date.
//
// This is guarded by scheduling in cmd/app.go behind DEV_SUBSCRIPTION_PAYOUTS=true.
func EnsureSubscriptionPayouts() error {
	now := time.Now().UTC()
	cycle := payoutCycleDuration()

	users := []User{}
	// Keep this query conservative; simulator/dev can set subscription_amount on test users.
	if err := DBConn.Select(&users, "SELECT * FROM users WHERE subscription_amount > 0 AND account_type != ?", "banned"); err != nil {
		return err
	}

	for i := range users {
		u := &users[i]
		if err := EnsureSubscriptionPayoutForUser(u, now, cycle); err != nil {
			return err
		}
	}

	return nil
}

func EnsureSubscriptionPayoutForUser(u *User, now time.Time, cycle time.Duration) error {
	// If the user's period end isn't set, or it's expired, bump it forward by one cycle.
	if u.CurrentPeriodEnd.IsZero() || u.CurrentPeriodEnd.Before(now) {
		newEnd := now.Add(cycle)
		if err := u.UpdateCurrentPeriodEnd(newEnd); err != nil {
			return err
		}
		if err := u.UpdateNextPayout(newEnd); err != nil {
			return err
		}
		u.CurrentPeriodEnd = newEnd
		u.NextPayout = newEnd
	}

	// Idempotently ensure there's a payout row for this period end.
	var count int
	if err := DBConn.Get(&count, "SELECT COUNT(*) FROM payouts WHERE user_id = ? AND payout_date = ?", u.ID, u.CurrentPeriodEnd); err != nil {
		return err
	}
	if count == 0 {
		// subscription_amount is stored in dollars (Stripe invoice.AmountPaid/100 in prod webhook).
		if err := u.CreateFuturePayout(u.SubscriptionAmount, u.CurrentPeriodEnd); err != nil {
			return err
		}
	}

	return nil
}


