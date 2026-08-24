package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"

	"soci-backend/httpd/utils"
	"soci-backend/models"
)

// CreatePost - protected http handler
// the user associated with the passed auth token can create a new post
func CreatePost(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		SendResponse(w, utils.MakeError("you can only POST to the post creation route"), 405)
		return
	}

	type requestPayload struct {
		Title     string   `json:"title"`
		URL       string   `json:"url"`
		Link      string   `json:"link"`
		Content   string   `json:"content"`
		Type      string   `json:"type"`
		Width     int      `json:"width"`
		Height    int      `json:"height"`
		Tags      []string `json:"tags"`
		Community string   `json:"community"`
	}

	var payload requestPayload
	decoder := json.NewDecoder(r.Body)
	decoder.Decode(&payload)

	u := models.User{}
	u.FindByID(r.Context().Value("user_id").(int))

	Log.Info("attempting to create post")
	Log.Infof("Community value received: '%s' (length: %d)", payload.Community, len(payload.Community))

	communityID := 0
	communitySlug := ""
	c, slug, err := resolveCommunity(payload.Community)
	if err != nil {
		Log.Errorf("Community query failed when creating post for community '%s': %v", slug, err)
		SendResponse(w, utils.MakeError("Community '"+slug+"' does not exist. Please create it first."), 404)
		return
	}
	if c != nil {
		communityID = c.ID
		communitySlug = slug
	}

	// Posting permissions:
	// - root/frontpage: requires CanPost() (paid/legacy)
	// - community posts: obey community.post_permission ("all" vs "paid")
	if c == nil || c.PostPermission == "paid" {
		canPost, err := u.CanPost()
		if err != nil {
			Log.Error("Error checking if user can post")
			sendSystemError(w, err)
			return
		}
		if !canPost {
			if c != nil {
				SendResponse(w, utils.MakeError("only users with an active subscription or accounts created before Nov 1, 2025 can submit posts in this community"), 403)
				return
			}
			SendResponse(w, utils.MakeError("only users with an active subscription or accounts created before Nov 1, 2025 can submit posts"), 403)
			return
		}
	}

	newPost, err := u.CreatePost(payload.Title, payload.URL, payload.Link, payload.Content, payload.Type, payload.Width, payload.Height, communityID)
	if err != nil {
		Log.Error("Post creation failed")
		sendSystemError(w, err)
		return
	}

	// Create tags
	for _, tag := range payload.Tags {
		t, err := models.GetOrCreateTag(tag, u, communityID)
		if err != nil {
			Log.Error("Resolving tag during post creation failed")
			sendSystemError(w, err)
			return
		}

		// Create the post tag
		postTag := models.PostTag{}
		postTag.PostID = newPost.ID
		postTag.TagID = t.ID

		postTagVote := models.PostTagVote{}
		// check if this is the first PostTagVote by user for the specific post
		votes, err := postTagVote.GetVotesByPostUser(newPost.ID, u.ID)
		if err != nil {
			sendSystemError(w, fmt.Errorf("query votes: %v", err))
			return
		}

		needUpdatePost := true
		if len(votes) > 0 {
			needUpdatePost = false
		}

		// prepare the PostTagVote for insertion
		postTagVote = models.PostTagVote{
			PostID:  newPost.ID,
			TagID:   t.ID,
			VoterID: u.ID,
		}

		if err = models.WithTransaction(func(tx models.Transaction) error {
			// insert the PostTag to database
			if err := postTag.CreatePostTagWithTx(tx); err != nil {
				return fmt.Errorf("creating a new post tag during post creation failed: %v", err)
			}

			// insert the PostTagVote to database
			if err := postTagVote.CreatePostTagVoteWithTx(tx); err != nil {
				return fmt.Errorf("creating a post tag vote during post creation failed: %v", err)
			}

			// check if it needs to increment the score of post
			if needUpdatePost {
				// increment the score of Post
				if err := newPost.IncrementScoreWithTx(tx, newPost.ID); err != nil {
					return fmt.Errorf("incrementing a post's score during creation failed: %v", err)
				}
			}

			return nil
		}); err != nil {
			sendSystemError(w, err)
			return
		}
	}

	tags, err := models.GetPostTags(newPost.ID)
	if err != nil {
		sendSystemError(w, err)
		return
	}
	newPost.Tags = tags
	if communityID > 0 && communitySlug != "" {
		newPost.CommunityURL = &communitySlug
	}

	SendResponse(w, &newPost, 200)

	// Nuke the cache
	PostCache = make(map[string]PostQueryResponse)
}
