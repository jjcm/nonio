package models

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"
)

// Post - struct representation of a single post
type Post struct {
	ID           int       `db:"id" json:"ID"`
	Title        string    `db:"title" json:"title"`
	URL          string    `db:"url" json:"url"`
	Link         string    `db:"link" json:"link"`
	Domain       string    `db:"domain" json:"-"`
	Author       User      `db:"-" json:"user"`
	AuthorID     int       `db:"user_id" json:"-"`
	Thumbnail    string    `db:"thumbnail" json:"thumbnail"`
	Score        int       `db:"score" json:"score"`
	CommentCount int       `db:"comment_count" json:"commentCount"`
	Content      string    `db:"content" json:"content"`
	Type         string    `db:"type" json:"type"`
	CreatedAt    time.Time `db:"created_at" json:"date"`
	UpdatedAt    time.Time `db:"updated_at" json:"updated_at"`
	Tags         []PostTag `db:"-"`
	Width        int       `db:"width" json:"width"`
	Height       int       `db:"height" json:"height"`
	IsEncoding   bool      `db:"is_encoding" json:"isEncoding"`
	CommunityID  *int      `db:"community_id" json:"communityID,omitempty"`
	CommunityURL *string   `db:"community_url" json:"community,omitempty"`
}

// PostQueryParams - structure represents the parameters for querying posts
type PostQueryParams struct {
	TagID       int
	Since       string
	Offset      int
	UserID      int
	Sort        string
	CommunityID int
	Type        string
}

// MarshalJSON custom JSON builder for Post structs
func (p *Post) MarshalJSON() ([]byte, error) {
	// build tag array for JS if the tag list is currently empty
	if len(p.Tags) < 1 {
		p.getPostTags()
	}

	// populate user if it currently isn't hydrated
	if p.Author.ID == 0 {
		p.Author.FindByID(p.AuthorID)
	}

	// return the custom JSON for this post
	var communityID *int
	if p.CommunityID != nil && *p.CommunityID != 0 {
		communityID = p.CommunityID
	}

	var communityURL *string
	if p.CommunityURL != nil && *p.CommunityURL != "" {
		communityURL = p.CommunityURL
	}

	return json.Marshal(&struct {
		ID           int       `json:"ID"`
		Title        string    `json:"title"`
		UserName     string    `json:"user"`
		TimeStamp    int64     `json:"time"`
		URL          string    `json:"url"`
		Link         string    `json:"link"`
		Content      string    `json:"content"`
		Type         string    `json:"type"`
		Score        int       `json:"score"`
		CommentCount int       `json:"commentCount"`
		Tags         []PostTag `json:"tags"`
		Width        int       `json:"width"`
		Height       int       `json:"height"`
		IsEncoding   bool      `json:"isEncoding"`
		CommunityID  *int      `json:"communityID,omitempty"`
		CommunityURL *string   `json:"community,omitempty"`
	}{
		ID:           p.ID,
		Title:        p.Title,
		UserName:     p.Author.GetDisplayName(),
		TimeStamp:    p.CreatedAt.UnixNano() / int64(time.Millisecond),
		URL:          p.URL,
		Link:         p.Link,
		Content:      p.Content,
		Type:         p.Type,
		Score:        p.Score,
		CommentCount: p.CommentCount,
		Tags:         p.Tags,
		Width:        p.Width,
		Height:       p.Height,
		IsEncoding:   p.IsEncoding,
		CommunityID:  communityID,
		CommunityURL: communityURL,
	})
}

// ToJSON - get a string representation of this Post in JSON
func (p *Post) ToJSON() string {
	jsonData, err := json.Marshal(p)
	if err != nil {
		return err.Error()
	}
	return string(jsonData)
}

/************************************************/
/******************** CREATE ********************/
/************************************************/

// CreatePost - create a new post in the database
func (u *User) CreatePost(title string, postUrl string, link string, content string, postType string, width int, height int, communityID ...int) (Post, error) {
	p := Post{}
	now := time.Now().Format("2006-01-02 15:04:05")

	communityIDVal := 0
	if len(communityID) > 0 {
		communityIDVal = communityID[0]
	}

	if len(title) == 0 {
		return p, fmt.Errorf("post must contain a title")
	}

	if len(postUrl) == 0 {
		return p, fmt.Errorf("post must contain a url")
	}

	// perpare and truncate the title if necessary
	if len(title) > 256 {
		title = title[0:255]
	}

	// If the URL has invalid characters, throw an error
	validURL := regexp.MustCompile(`^[a-zA-Z0-9\-\._]*$`)
	if !validURL.MatchString(postUrl) {
		return p, fmt.Errorf("url contains invalid characters")
	}

	// Check if the link is a valid URL, and if so set our domain to the URL's domain
	postLink := url.URL{}
	if link != "" {
		// set the postLink to the parsed value of the url
		parsedUrl, err := url.Parse(link)
		if err != nil {
			return p, fmt.Errorf("link is not a valid URL")
		}
		postLink = *parsedUrl
	}

	// set the type if it's blank
	if strings.TrimSpace(postType) == "" {
		postType = "image"
	}

	// set is_encoding to true for video posts (they need encoding)
	isEncoding := postType == "video"

	// Normalize communityID so that root/frontpage posts use 0
	communityKey := communityIDVal
	if communityKey < 0 {
		communityKey = 0
	}

	// try and create the post in the DB
	result, err := DBConn.Exec("INSERT INTO posts (title, url, link, domain, user_id, thumbnail, score, content, type, width, height, is_encoding, community_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", title, postUrl, postLink.String(), postLink.Host, u.ID, "", 0, content, postType, width, height, isEncoding, communityKey, now, now)
	// check for specific error of an existing post URL
	// if we hit this error, run a second DB call to see how many of the posts have a similar URL alias and then tack on a suffix to make this one unique
	if err != nil && err.Error()[0:10] == "Error 1062" {
		var countSimilarAliases int
		// the uniquie URL that we are testing for might not be long enough for the following LIKE query to work, so let's check that here
		urlToCheckFor := postUrl
		if len(urlToCheckFor) > 240 {
			urlToCheckFor = urlToCheckFor[0:240] // 240 is safe enough, since this is such an edge case that it's probably never going to happen
		}
		DBConn.Get(&countSimilarAliases, "SELECT COUNT(*) FROM posts WHERE url LIKE ? AND COALESCE(community_id, 0) = ?", urlToCheckFor+"%", communityKey)
		suffix := "-" + strconv.Itoa(countSimilarAliases+1)
		newURL := postUrl + suffix
		if len(newURL) > 255 {
			newURL = postUrl[0:len(postUrl)-len(suffix)] + suffix
		}

		// now let's try it again with the updated post URL
		result, err = DBConn.Exec("INSERT INTO posts (title, url, link, domain, user_id, thumbnail, score, content, type, width, height, is_encoding, community_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", title, newURL, postLink.String(), postLink.Host, u.ID, "", 0, content, postType, width, height, isEncoding, communityKey, now, now)
		if err != nil {
			return p, err
		}
	}

	if err != nil {
		Log.Error("Error creating post - error 166")
		return p, err
	}
	insertID, err := result.LastInsertId()
	if err != nil {
		Log.Error("Error creating post - error 171")
		return p, err
	}
	p.FindByID(int(insertID))
	p.Author = *u

	return p, nil
}

/************************************************/
/********************* READ *********************/
/************************************************/

// FindByID - find a given post in the database by its primary key
func (p *Post) FindByID(id int) error {
	dbPost := Post{}
	err := DBConn.Get(&dbPost, "SELECT * FROM posts WHERE id = ?", id)
	if err != nil {
		return err
	}

	*p = dbPost
	return nil
}

// FindByURL - find a given post in the database by its URL scoped to a community
// If no community is provided, the root/frontpage (0) is assumed.
func (p *Post) FindByURL(url string, communityID ...int) error {
	communityKey := 0
	if len(communityID) > 0 {
		communityKey = communityID[0]
	}
	dbPost := Post{}
	query := `
		SELECT p.*, c.url AS community_url
		FROM posts p
		LEFT JOIN communities c ON p.community_id = c.id
		WHERE p.url = ? AND COALESCE(p.community_id, 0) = ?
		LIMIT 1`
	err := DBConn.Get(&dbPost, query, url, communityKey)
	if err != nil {
		Log.Error(err.Error())
		return err
	}

	*p = dbPost
	return nil
}

// GetPostsByParams - get the posts by parameters
func GetPostsByParams(params *PostQueryParams) ([]*Post, error) {
	args := []interface{}{}

	query := `
		SELECT p.*, c.url AS community_url
		FROM posts p
		LEFT JOIN communities c ON p.community_id = c.id
		WHERE p.created_at > ? AND (p.is_encoding = false OR (p.type = 'video' AND p.is_encoding = true AND p.created_at < DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 24 HOUR)))`
	// time range
	args = append(args, params.Since)
	Log.Infof("time range: %s", params.Since)

	// special user
	if params.UserID > 0 {
		query = query + " and p.user_id = ?"
		args = append(args, params.UserID)
	}

	// community
	if params.CommunityID > 0 {
		query = query + " and p.community_id = ?"
		args = append(args, params.CommunityID)
	} else {
		// If no community is specified, only show posts with no community (frontpage)
		// Or should we show all? The requirement says "Content submitted to a community wouldn't be visible on the frontpage"
		// So if CommunityID is 0 (or not set), we should filter out community posts.
		query = query + " and (p.community_id IS NULL OR p.community_id = 0)"
	}

	// tags
	if params.TagID > 0 {
		Log.Infof("tag id: %d", params.TagID)
		query = query + " and p.id in (SELECT post_id from posts_tags where tag_id = ?)"
		args = append(args, params.TagID)
	}

	// type filter (image, video, blog, link, audio)
	if params.Type != "" {
		query = query + " and p.type = ?"
		args = append(args, params.Type)
	}

	// orders
	switch params.Sort {
	case "popular":
		// "Hot" sort: score decays by age (in hours). Use TIMESTAMPDIFF for correct units.
		// +2 prevents division by zero and reduces extreme boosting for brand-new posts.
		query = query + " order by p.score / POWER(((TIMESTAMPDIFF(SECOND, p.created_at, CURRENT_TIMESTAMP()) / 3600) + 2), 1.8) desc"
	case "top":
		query = query + " order by p.score desc"
		Log.Info("top")
	case "new":
		query = query + " order by p.created_at desc"
	default:
		query = query + " order by p.created_at desc"
	}

	// offset
	query = query + " limit 100 offset ?"
	args = append(args, params.Offset)
	Log.Infof("Offset: %d", params.Offset)

	Log.Infof("final query: %s", query)
	posts := []*Post{}
	// exec the query string
	if err := DBConn.Select(&posts, query, args...); err != nil {
		return nil, err
	}

	Log.Infof("number of posts: %d", len(posts))
	return posts, nil
}

// GetPosts will return all Posts that were authored by this user.
// limit and offset will adjust the SQL query to return a smaller subset
// pass -1 for limit and you can return all
func (u *User) GetPosts(limit, offset int) ([]Post, error) {
	posts := []Post{}

	// run the correct sql query
	var query string
	if limit == -1 {
		query = "SELECT * FROM posts WHERE user_id = ?"
		err := DBConn.Select(&posts, query, u.ID)
		if err != nil {
			return posts, err
		}
	} else {
		query = "SELECT * FROM posts WHERE user_id = ? LIMIT ? OFFSET ?"
		err := DBConn.Select(&posts, query, u.ID, limit, offset)
		if err != nil {
			return posts, err
		}
	}

	return posts, nil
}

/************************************************/
/******************** UPDATE ********************/
/************************************************/

// IncrementScore - increment the score by post id
func (p *Post) IncrementScore(id int) error {
	_, err := DBConn.Exec("update posts set score=score+1 where id = ?", id)
	return err
}

// IncrementScoreWithTx - increment the score by post id
func (p *Post) IncrementScoreWithTx(tx Transaction, id int) error {
	_, err := tx.Exec("update posts set score=score+1 where id = ?", id)
	return err
}

// DecrementScoreWithTx - decrement the score by post id
func (p *Post) DecrementScoreWithTx(tx Transaction, id int) error {
	_, err := tx.Exec("update posts set score=score-1 where id = ?", id)
	return err
}

// MarkEncodingComplete - mark a post as no longer encoding
func (p *Post) MarkEncodingComplete(url string) error {
	result, err := DBConn.Exec("update posts set is_encoding = false where url = ?", url)
	if err != nil {
		Log.Errorf("Error updating encoding status for post with url %s: %v", url, err)
		return err
	}
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		Log.Errorf("Error getting rows affected for post with url %s: %v", url, err)
		return err
	}
	if rowsAffected == 0 {
		Log.Warnf("No post found with url %s to mark encoding complete", url)
		return fmt.Errorf("no post found with url %s", url)
	}
	Log.Infof("Marked encoding complete for post with url %s (rows affected: %d)", url, rowsAffected)
	return nil
}

/************************************************/
/******************** DELETE ********************/
/************************************************/

// DeletePost removes a post and all associated data from the database
func (p *Post) DeletePost() error {
	if p.ID == 0 {
		return errors.New("can't delete a post with an invalid ID")
	}

	if err := WithTransaction(func(tx Transaction) error {
		// Delete all post tags
		_, err := tx.Exec("DELETE FROM posts_tags WHERE post_id = ?", p.ID)
		if err != nil {
			return fmt.Errorf("delete post tags: %v", err)
		}

		// Delete all post tag votes
		_, err = tx.Exec("DELETE FROM posts_tags_votes WHERE post_id = ?", p.ID)
		if err != nil {
			return fmt.Errorf("delete post tag votes: %v", err)
		}

		// Delete all comment votes for comments on this post
		_, err = tx.Exec("DELETE FROM comment_votes WHERE comment_id IN (SELECT id FROM comments WHERE post_id = ?)", p.ID)
		if err != nil {
			return fmt.Errorf("delete comment votes: %v", err)
		}

		// Delete all comments on this post
		_, err = tx.Exec("DELETE FROM comments WHERE post_id = ?", p.ID)
		if err != nil {
			return fmt.Errorf("delete comments: %v", err)
		}

		// Delete the post itself
		_, err = tx.Exec("DELETE FROM posts WHERE id = ?", p.ID)
		if err != nil {
			return fmt.Errorf("delete post: %v", err)
		}

		return nil
	}); err != nil {
		return err
	}

	return nil
}

/************************************************/
/******************** HELPER ********************/
/************************************************/

// GetCreatedAtTimestamp - get the created at timestamp in the predetermined format
func (p *Post) GetCreatedAtTimestamp() int64 {
	return p.CreatedAt.UnixNano() / int64(time.Millisecond)
}
