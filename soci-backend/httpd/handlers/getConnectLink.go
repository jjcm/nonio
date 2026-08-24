package handlers

import (
	"fmt"
	"github.com/stripe/stripe-go/v72"
	"github.com/stripe/stripe-go/v72/loginlink"
	"net/http"
	"soci-backend/httpd/utils"
	"soci-backend/models"
)

// GetConnectLink creates a strip login link for a user
func GetConnectLink(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		SendResponse(w, utils.MakeError("you can only GET to the get connect link route"), 405)
		return
	}

	// second, find the user that is trying to write the post
	u := models.User{}
	err := u.FindByID(r.Context().Value("user_id").(int))
	if err != nil {
		sendSystemError(w, fmt.Errorf("find user error: %v", err))
		return
	}

	expressAccountId, err := u.GetStripeConnectAccountId()
	if err != nil {
		sendSystemError(w, fmt.Errorf("get exress account error: %v", err))
		return
	}

	params := &stripe.LoginLinkParams{
		Account: stripe.String(expressAccountId),
	}

	link, err := loginlink.New(params)
	if err != nil {
		sendSystemError(w, fmt.Errorf("get login link: %v", err))
		return
	}

	if link != nil {
		http.Redirect(w, r, link.URL, http.StatusSeeOther)
	}

	SendResponse(w, link, 200)
}
