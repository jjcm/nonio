package handlers

import (
	"errors"
	"fmt"
	"net/http"
	"strings"

	"soci-backend/httpd/utils"
	"soci-backend/models"
)

// GetCommentVotesForPost - gets a user's votes for a post.
func GetCommentVotesForPost(w http.ResponseWriter, r *http.Request) {
	Log.Info("getting comment votes")
	communitySlug, url := parseCommunityAndSlug(r.URL.Path, "/comment-votes/post/")
	if communitySlug == "" {
		communitySlug = strings.TrimSpace(r.URL.Query().Get("community"))
	}

	communityID, err := resolveCommunityID(communitySlug)
	if err != nil {
		sendSystemError(w, fmt.Errorf("community lookup: %v", err))
		return
	}

	if strings.TrimSpace(url) == "" {
		sendSystemError(w, errors.New("a post url is needed to get the comment votes for it"))
		return
	}

	u := models.User{}
	u.FindByID(r.Context().Value("user_id").(int))

	p := models.Post{}
	err = p.FindByURL(url, communityID)
	if err != nil {
		sendNotFound(w, errors.New("we couldn't find a post with the url `"+url+"`"))
		return
	}

	votes, err := u.GetCommentVotesForPost(p.ID)
	if err != nil {
		SendResponse(w, utils.MakeError(err.Error()), 500)
		return
	}

	output := map[string]interface{}{
		"votes": votes,
	}
	SendResponse(w, output, 200)
}

// GetCommentVotes - get the comment votes from database with different url parameters
func GetCommentVotes(w http.ResponseWriter, r *http.Request) {
	u := models.User{}
	u.FindByID(r.Context().Value("user_id").(int))

	Log.Info(r.URL)
	params := &models.CommentVoteQueryParams{}
	// parse the url parameters
	r.ParseForm()

	// ?post=POST
	// Only returns votes on comments that match a specific post url.
	post := strings.TrimSpace(r.FormValue("post"))
	if post != "" {
		communitySlug := strings.TrimSpace(r.FormValue("community"))
		communityID, err := resolveCommunityID(communitySlug)
		if err != nil {
			sendSystemError(w, fmt.Errorf("query comment votes by post %s: %v", post, err))
			return
		}
		p := &models.Post{}
		err = p.FindByURL(post, communityID)
		if err != nil {
			sendSystemError(w, fmt.Errorf("query comment votes by post %s: %v", post, err))
			return
		}
		params.PostID = p.ID
	}

	// ?user=USER
	// Only returns votes on comments made by a specific user
	formUser := strings.TrimSpace(r.FormValue("user"))
	if formUser != "" {
		author := models.User{}
		// query the user by user name
		if err := author.FindByUsername(formUser); err != nil {
			sendSystemError(w, fmt.Errorf("query user by name %s: %v", formUser, err))
			return
		}
		if author.ID == 0 {
			sendNotFound(w, errors.New("user's name: "+formUser))
			return
		}
		params.UserID = author.ID
	}

	// query the comments by the url parameters
	commentVotes, err := models.GetCommentVotesByParams(&u, params)
	if err != nil {
		sendSystemError(w, fmt.Errorf("query comments by parameters: %v", err))
		return
	}

	output := map[string]interface{}{
		"commentVotes": commentVotes,
	}
	SendResponse(w, output, 200)
}
