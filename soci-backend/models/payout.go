package models

import (
	"time"

	"github.com/stripe/stripe-go/v72"
	"github.com/stripe/stripe-go/v72/transfer"
)

type Payout struct {
	ID         int       `db:"id" json:"-"`
	User       *User     `db:"-" json:"-"`
	UserID     int       `db:"user_id" json:"userID"`
	Amount     float64   `db:"amount" json:"amount"`
	PayoutDate time.Time `db:"payout_date" json:"payoutDate"`
	CreatedAt  time.Time `db:"created_at" json:"createdAt"`
	Tallied    bool      `db:"tallied" json:"tallied"`
}

func AllocatePayouts() error {
	currentTime := time.Now()

	u := User{}
	allUsers, err := u.GetAllForPayout()
	for _, user := range allUsers {
		tempCash := user.Cash
		params := &stripe.TransferParams{
			Amount:      stripe.Int64(int64(tempCash)),
			Currency:    stripe.String(string(stripe.CurrencyUSD)),
			Destination: stripe.String(user.StripeConnectAccountID),
		}

		_, err := transfer.New(params)
		if err != nil {
			return err
		}

		tx, txErr := DBConn.Begin()
		if txErr != nil {
			return txErr
		}
		_, txErr = tx.Exec("insert into ledger (author_id, contributor_id, community_id, amount, type, description) values (?, ?, ?, ?, ?, ?)",
			user.ID, -1, nil, tempCash, "withdrawal", "withdrawal from non.io to Stripe",
		)
		_, txErr = tx.Exec("UPDATE users SET cash = 0 WHERE id = ?", user.ID)
		txErr = tx.Commit()
		if txErr != nil {
			return txErr
		}

		err = user.UpdateLastPayout(time.Now())
		if err != nil {
			return err
		}

		now := time.Now()
		tomorrow := now.Add(time.Hour * 24)
		if user.CurrentPeriodEnd.After(now) && user.CurrentPeriodEnd.Before(tomorrow) {
			err = user.UpdateNextPayout(user.CurrentPeriodEnd)
			if err != nil {
				return err
			}
		}
	}

	v := PostTagVote{}
	err = v.MarkVotesAsTallied(currentTime)
	if err != nil {
		return err
	}

	return nil
}

func uniquePostFilter(votes []PostTagVote) []PostTagVote {
	keys := make(map[int]bool)
	uniqueVotes := []PostTagVote{}

	for _, vote := range votes {
		if _, added := keys[vote.PostID]; !added {
			keys[vote.PostID] = true
			uniqueVotes = append(uniqueVotes, vote)
		}
	}

	return uniqueVotes
}

func (u *User) CreateFuturePayout(amount float64, payoutDate time.Time) error {
	Log.Infof("creating future payout for user %v with amount %v, on %v", u.ID, amount, payoutDate)
	_, err := DBConn.Exec("INSERT INTO payouts (user_id, payout_date, amount) VALUES (?, ?, ?)", u.ID, payoutDate, amount)
	if err != nil {
		return err
	}
	return nil
}

func ProcessPayouts() error {
	Log.Info("Processing payouts")
	payouts := []Payout{}

	err := DBConn.Select(&payouts, "select * from payouts where tallied = 0 AND payout_date < ?", time.Now())
	if err != nil {
		return err
	}

	for _, payout := range payouts {
		user := User{}
		user.FindByID(payout.UserID)

		Log.Infof("Processing payouts for user %v", user.Username)

		votes, err := user.GetUntalliedVotes(payout.PayoutDate)
		if err != nil {
			return err
		}

		votes = uniquePostFilter(votes)

		payoutPerVote := (payout.Amount / float64(len(votes)))

		Log.Infof("Payout is $%v, spread across %v votes. Each vote will get %v", payout.Amount, len(votes), payoutPerVote)

		tx, txErr := DBConn.Begin()
		if txErr != nil {
			return txErr
		}
		for _, vote := range votes {
			post := Post{}
			author := User{}
			post.FindByID(vote.PostID)
			author.FindByID(post.AuthorID)

			amountForAuthor := payoutPerVote

			if post.CommunityID != nil && *post.CommunityID > 0 {
				// Calculate moderator share
				modShare := payoutPerVote * 0.10
				amountForAuthor = payoutPerVote - modShare

				// Find moderators
				community := Community{}
				community.FindByID(*post.CommunityID)
				moderators, err := community.GetModerators()
				if err != nil {
					Log.Error("Error getting moderators for community")
					// Fallback to giving it to author
					amountForAuthor = payoutPerVote
				} else if len(moderators) > 0 {
					sharePerMod := modShare / float64(len(moderators))
					for _, mod := range moderators {
						Log.Infof("Creating a ledger entry for moderator %v", mod.Username)
						_, txErr = tx.Exec("insert into ledger (author_id, contributor_id, community_id, amount, type, description) values (?, ?, ?, ?, ?, ?)",
							mod.ID, user.ID, *post.CommunityID, sharePerMod, "deposit", "moderator share from "+user.Username,
						)
						if txErr != nil {
							Log.Error("Error inserting ledger entry for moderator")
							return txErr
						}
						_, txErr = tx.Exec("UPDATE users SET cash = cash + ? WHERE id = ?", sharePerMod, mod.ID)
						if txErr != nil {
							Log.Error("Error updating moderator cash")
							return txErr
						}
					}
				} else {
					// If no moderators, give it to author
					amountForAuthor = payoutPerVote
				}
			}

			Log.Infof("Creating a ledger entry for user %v", author.Username)
			_, txErr = tx.Exec("insert into ledger (author_id, contributor_id, community_id, amount, type, description) values (?, ?, ?, ?, ?, ?)",
				author.ID, user.ID, post.CommunityID, amountForAuthor, "deposit", "deposit from "+user.Username,
			)
			if txErr != nil {
				Log.Error("Error inserting ledger entry")
				return txErr
			}
			_, txErr = tx.Exec("UPDATE users SET cash = cash + ? WHERE id = ?", amountForAuthor, author.ID)
			if txErr != nil {
				Log.Error("Error updating user cash")
				return txErr
			}
		}

		_, txErr = tx.Exec("UPDATE payouts SET tallied = 1 WHERE id = ?", payout.ID)
		if txErr != nil {
			Log.Error("Error setting payout to tallied")
			return txErr
		}

		_, txErr = tx.Exec("UPDATE posts_tags_votes SET tallied = 1 WHERE voter_id = ? AND created_at < ?", payout.UserID, payout.PayoutDate)
		if txErr != nil {
			Log.Error("Error setting votes to tallied")
			return txErr
		}

		txErr = tx.Commit()
		if txErr != nil {
			return txErr
		}
	}

	return nil
}
