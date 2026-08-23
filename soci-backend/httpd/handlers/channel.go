package handlers

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"soci-backend/httpd/utils"
	"soci-backend/models"
)

func ensureCommunityMember(c *models.Community, userID int) (bool, error) {
	u := models.User{}
	u.FindByID(userID)
	subs, err := u.GetSubscribedCommunities()
	if err != nil {
		return false, err
	}
	for _, sub := range subs {
		if sub.URL == c.URL {
			return true, nil
		}
	}
	return false, nil
}

func isCommunityModerator(c *models.Community, userID int) (bool, error) {
	mods, err := c.GetModerators()
	if err != nil {
		return false, err
	}
	for _, mod := range mods {
		if mod.ID == userID {
			return true, nil
		}
	}
	return false, nil
}

// ChannelCreate - POST /community/channel/create (moderators only)
func ChannelCreate(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		SendResponse(w, utils.MakeError("you can only POST to this route"), 405)
		return
	}

	type requestPayload struct {
		Community string `json:"community"`
		Kind      string `json:"kind"`
		Slug      string `json:"slug"`
		Name      string `json:"name"`
	}
	var payload requestPayload
	decoder := json.NewDecoder(r.Body)
	if err := decoder.Decode(&payload); err != nil {
		SendResponse(w, utils.MakeError("invalid JSON"), 400)
		return
	}

	communityURL := strings.TrimSpace(strings.TrimPrefix(payload.Community, "@"))
	if communityURL == "" {
		SendResponse(w, utils.MakeError("community is required"), 400)
		return
	}

	c := models.Community{}
	if err := c.FindByURL(communityURL); err != nil {
		sendNotFound(w, errors.New("community not found"))
		return
	}

	userID := r.Context().Value("user_id").(int)
	mods, err := c.GetModerators()
	if err != nil {
		sendSystemError(w, err)
		return
	}
	isMod := false
	for _, mod := range mods {
		if mod.ID == userID {
			isMod = true
			break
		}
	}
	if !isMod {
		SendResponse(w, utils.MakeError("only moderators can create channels"), 403)
		return
	}

	u := models.User{}
	u.FindByID(userID)
	ch, err := u.CreateChannel(c.ID, payload.Kind, payload.Slug, payload.Name)
	if err != nil {
		SendResponse(w, map[string]string{"error": err.Error()}, 400)
		return
	}

	SendResponse(w, ch, 201)
}

// GetChannels - GET /community/channels?community=... (member-gated)
func GetChannels(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		SendResponse(w, utils.MakeError("you can only GET this route"), 405)
		return
	}

	communityURL := strings.TrimSpace(r.URL.Query().Get("community"))
	communityURL = strings.TrimPrefix(communityURL, "@")
	if communityURL == "" {
		SendResponse(w, utils.MakeError("community is required"), 400)
		return
	}

	c := models.Community{}
	if err := c.FindByURL(communityURL); err != nil {
		sendNotFound(w, errors.New("community not found"))
		return
	}

	userID := r.Context().Value("user_id").(int)
	isMember, err := ensureCommunityMember(&c, userID)
	if err != nil {
		sendSystemError(w, err)
		return
	}
	if !isMember {
		SendResponse(w, utils.MakeError("you must be a member of this community to list channels"), 403)
		return
	}

	channels, err := models.GetChannelsByCommunityID(c.ID)
	if err != nil {
		sendSystemError(w, err)
		return
	}

	SendResponse(w, map[string]interface{}{"channels": channels}, 200)
}

// ChannelMessageCreate - POST /community/channel/message (send message to text channel)
func ChannelMessageCreate(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		SendResponse(w, utils.MakeError("you can only POST to this route"), 405)
		return
	}

	type requestPayload struct {
		Community string   `json:"community"`
		Channel   string   `json:"channel"` // slug of the text channel
		Content   string   `json:"content"`
		ImageURL  string   `json:"imageUrl"`
		ImageURLs []string `json:"imageUrls"`
		ParentID  int      `json:"parentID"`
	}
	var payload requestPayload
	decoder := json.NewDecoder(r.Body)
	if err := decoder.Decode(&payload); err != nil {
		SendResponse(w, utils.MakeError("invalid JSON"), 400)
		return
	}

	communityURL := strings.TrimSpace(strings.TrimPrefix(payload.Community, "@"))
	channelSlug := strings.TrimSpace(payload.Channel)
	if communityURL == "" || channelSlug == "" {
		SendResponse(w, utils.MakeError("community and channel are required"), 400)
		return
	}

	c := models.Community{}
	if err := c.FindByURL(communityURL); err != nil {
		sendNotFound(w, errors.New("community not found"))
		return
	}

	ch := models.CommunityChannel{}
	if err := ch.FindByCommunityAndSlug(c.ID, channelSlug); err != nil {
		sendNotFound(w, errors.New("channel not found"))
		return
	}
	if ch.Kind != models.ChannelKindText {
		SendResponse(w, utils.MakeError("channel is not a text channel"), 400)
		return
	}

	userID := r.Context().Value("user_id").(int)
	isMember, err := ensureCommunityMember(&c, userID)
	if err != nil {
		sendSystemError(w, err)
		return
	}
	if !isMember {
		SendResponse(w, utils.MakeError("you must be a member of this community to send messages"), 403)
		return
	}
	if payload.ParentID > 0 {
		SendResponse(w, utils.MakeError("top-level endpoint does not accept parentID"), 400)
		return
	}

	u := models.User{}
	u.FindByID(userID)
	imageURLs := collectMessageImageURLs(payload.ImageURL, payload.ImageURLs)
	msg, err := u.CreateChannelMessage(ch.ID, payload.Content, imageURLs)
	if err != nil {
		SendResponse(w, map[string]string{"error": err.Error()}, 400)
		return
	}
	msg.Author = u
	broadcastChannelMessageCreated(c.URL, ch.Slug, &msg)

	SendResponse(w, &msg, 201)
}

// GetChannelMessages - GET /community/channel/messages?community=...&channel=...&before=...&limit=...
func GetChannelMessages(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		SendResponse(w, utils.MakeError("you can only GET this route"), 405)
		return
	}

	communityURL := strings.TrimSpace(r.URL.Query().Get("community"))
	communityURL = strings.TrimPrefix(communityURL, "@")
	channelSlug := strings.TrimSpace(r.URL.Query().Get("channel"))
	if communityURL == "" || channelSlug == "" {
		SendResponse(w, utils.MakeError("community and channel are required"), 400)
		return
	}

	c := models.Community{}
	if err := c.FindByURL(communityURL); err != nil {
		sendNotFound(w, errors.New("community not found"))
		return
	}

	ch := models.CommunityChannel{}
	if err := ch.FindByCommunityAndSlug(c.ID, channelSlug); err != nil {
		sendNotFound(w, errors.New("channel not found"))
		return
	}
	if ch.Kind != models.ChannelKindText {
		SendResponse(w, utils.MakeError("channel is not a text channel"), 400)
		return
	}

	userID := r.Context().Value("user_id").(int)
	isMember, err := ensureCommunityMember(&c, userID)
	if err != nil {
		sendSystemError(w, err)
		return
	}
	if !isMember {
		SendResponse(w, utils.MakeError("you must be a member of this community to read messages"), 403)
		return
	}

	params := &models.ChannelMessageQueryParams{ChannelID: ch.ID, Limit: 50, TopLevelOnly: true}
	if b := r.URL.Query().Get("before"); b != "" {
		if id, err := strconv.Atoi(b); err == nil && id > 0 {
			params.BeforeID = id
		}
	}
	if l := r.URL.Query().Get("limit"); l != "" {
		if n, err := strconv.Atoi(l); err == nil && n > 0 {
			params.Limit = n
		}
	}

	msgs, err := models.GetChannelMessages(params)
	if err != nil {
		sendSystemError(w, err)
		return
	}
	if err := models.HydrateChannelMessageMetadata(msgs, userID); err != nil {
		sendSystemError(w, err)
		return
	}

	SendResponse(w, map[string]interface{}{"messages": msgs}, 200)
}

// ChannelMessages - dispatch GET or POST for /community/channel/messages
func ChannelMessages(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		GetChannelMessages(w, r)
	case http.MethodPost:
		ChannelMessageCreate(w, r)
	default:
		SendResponse(w, utils.MakeError("method not allowed"), 405)
	}
}

// GetChannelThread - GET /community/channel/thread?community=...&channel=...&parentID=...
func GetChannelThread(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		SendResponse(w, utils.MakeError("you can only GET this route"), 405)
		return
	}
	communityURL := strings.TrimSpace(strings.TrimPrefix(r.URL.Query().Get("community"), "@"))
	channelSlug := strings.TrimSpace(r.URL.Query().Get("channel"))
	parentID, _ := strconv.Atoi(strings.TrimSpace(r.URL.Query().Get("parentID")))
	if communityURL == "" || channelSlug == "" || parentID <= 0 {
		SendResponse(w, utils.MakeError("community, channel, and parentID are required"), 400)
		return
	}

	c := models.Community{}
	if err := c.FindByURL(communityURL); err != nil {
		sendNotFound(w, errors.New("community not found"))
		return
	}
	ch := models.CommunityChannel{}
	if err := ch.FindByCommunityAndSlug(c.ID, channelSlug); err != nil {
		sendNotFound(w, errors.New("channel not found"))
		return
	}
	if ch.Kind != models.ChannelKindText {
		SendResponse(w, utils.MakeError("channel is not a text channel"), 400)
		return
	}

	userID := r.Context().Value("user_id").(int)
	isMember, err := ensureCommunityMember(&c, userID)
	if err != nil {
		sendSystemError(w, err)
		return
	}
	if !isMember {
		SendResponse(w, utils.MakeError("you must be a member of this community to read messages"), 403)
		return
	}

	parent := models.CommunityChannelMessage{}
	if err := parent.FindByID(parentID); err != nil {
		sendNotFound(w, errors.New("parent message not found"))
		return
	}
	if parent.ChannelID != ch.ID || parent.ParentID != nil {
		SendResponse(w, utils.MakeError("parent must be a top-level message in this channel"), 400)
		return
	}

	params := &models.ChannelMessageQueryParams{ChannelID: ch.ID, ParentID: &parentID, Limit: 100}
	replies, err := models.GetChannelMessages(params)
	if err != nil {
		sendSystemError(w, err)
		return
	}
	if err := models.HydrateChannelMessageMetadata(replies, userID); err != nil {
		sendSystemError(w, err)
		return
	}

	SendResponse(w, map[string]interface{}{"parent": parent, "messages": replies}, 200)
}

// ChannelThreadCreate - POST /community/channel/thread
func ChannelThreadCreate(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		SendResponse(w, utils.MakeError("you can only POST to this route"), 405)
		return
	}
	type requestPayload struct {
		Community string   `json:"community"`
		Channel   string   `json:"channel"`
		ParentID  int      `json:"parentID"`
		Content   string   `json:"content"`
		ImageURL  string   `json:"imageUrl"`
		ImageURLs []string `json:"imageUrls"`
	}
	var payload requestPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		SendResponse(w, utils.MakeError("invalid JSON"), 400)
		return
	}
	communityURL := strings.TrimSpace(strings.TrimPrefix(payload.Community, "@"))
	channelSlug := strings.TrimSpace(payload.Channel)
	if communityURL == "" || channelSlug == "" || payload.ParentID <= 0 {
		SendResponse(w, utils.MakeError("community, channel, and parentID are required"), 400)
		return
	}

	c := models.Community{}
	if err := c.FindByURL(communityURL); err != nil {
		sendNotFound(w, errors.New("community not found"))
		return
	}
	ch := models.CommunityChannel{}
	if err := ch.FindByCommunityAndSlug(c.ID, channelSlug); err != nil {
		sendNotFound(w, errors.New("channel not found"))
		return
	}
	if ch.Kind != models.ChannelKindText {
		SendResponse(w, utils.MakeError("channel is not a text channel"), 400)
		return
	}

	userID := r.Context().Value("user_id").(int)
	isMember, err := ensureCommunityMember(&c, userID)
	if err != nil {
		sendSystemError(w, err)
		return
	}
	if !isMember {
		SendResponse(w, utils.MakeError("you must be a member of this community to send messages"), 403)
		return
	}

	u := models.User{}
	u.FindByID(userID)
	imageURLs := collectMessageImageURLs(payload.ImageURL, payload.ImageURLs)
	msg, err := u.CreateChannelReply(ch.ID, payload.ParentID, payload.Content, imageURLs)
	if err != nil {
		SendResponse(w, map[string]string{"error": err.Error()}, 400)
		return
	}
	msg.Author = u
	broadcastChannelMessageCreated(c.URL, ch.Slug, &msg)
	SendResponse(w, &msg, 201)
}

func collectMessageImageURLs(imageURL string, imageURLs []string) []string {
	seen := map[string]struct{}{}
	out := make([]string, 0, len(imageURLs)+1)
	for _, entry := range imageURLs {
		value := strings.TrimSpace(entry)
		if value == "" {
			continue
		}
		if _, exists := seen[value]; exists {
			continue
		}
		seen[value] = struct{}{}
		out = append(out, value)
	}
	single := strings.TrimSpace(imageURL)
	if single != "" {
		if _, exists := seen[single]; !exists {
			out = append([]string{single}, out...)
		}
	}
	return out
}

func ChannelThread(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		GetChannelThread(w, r)
	case http.MethodPost:
		ChannelThreadCreate(w, r)
	default:
		SendResponse(w, utils.MakeError("method not allowed"), 405)
	}
}

// ChannelMessageReact - POST /community/channel/message/react
func ChannelMessageReact(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		SendResponse(w, utils.MakeError("you can only POST to this route"), 405)
		return
	}
	type requestPayload struct {
		MessageID int    `json:"messageID"`
		Emoji     string `json:"emoji"`
	}
	var payload requestPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		SendResponse(w, utils.MakeError("invalid JSON"), 400)
		return
	}
	if payload.MessageID <= 0 || strings.TrimSpace(payload.Emoji) == "" {
		SendResponse(w, utils.MakeError("messageID and emoji are required"), 400)
		return
	}
	msg := models.CommunityChannelMessage{}
	if err := msg.FindByID(payload.MessageID); err != nil {
		sendNotFound(w, errors.New("message not found"))
		return
	}
	ch := models.CommunityChannel{}
	if err := ch.FindByID(msg.ChannelID); err != nil {
		sendNotFound(w, errors.New("channel not found"))
		return
	}
	c := models.Community{}
	if err := c.FindByID(ch.CommunityID); err != nil {
		sendNotFound(w, errors.New("community not found"))
		return
	}
	userID := r.Context().Value("user_id").(int)
	isMember, err := ensureCommunityMember(&c, userID)
	if err != nil {
		sendSystemError(w, err)
		return
	}
	if !isMember {
		SendResponse(w, utils.MakeError("you must be a member of this community to react"), 403)
		return
	}
	reacted, err := models.ToggleChannelMessageReaction(payload.MessageID, userID, payload.Emoji)
	if err != nil {
		SendResponse(w, map[string]string{"error": err.Error()}, 400)
		return
	}
	count, err := models.GetReactionCountForMessageEmoji(payload.MessageID, payload.Emoji)
	if err != nil {
		sendSystemError(w, err)
		return
	}
	broadcastChannelMessageReactionUpdated(c.URL, ch.Slug, payload.MessageID, payload.Emoji, reacted, count)
	SendResponse(w, map[string]interface{}{"reacted": reacted}, 200)
}

// GetCommunityEmojis - GET /community/emojis?community=...
func GetCommunityEmojis(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		SendResponse(w, utils.MakeError("you can only GET this route"), 405)
		return
	}
	communityURL := strings.TrimSpace(strings.TrimPrefix(r.URL.Query().Get("community"), "@"))
	if communityURL == "" {
		SendResponse(w, utils.MakeError("community is required"), 400)
		return
	}
	c := models.Community{}
	if err := c.FindByURL(communityURL); err != nil {
		sendNotFound(w, errors.New("community not found"))
		return
	}
	items, err := models.GetCommunityEmojis(c.ID)
	if err != nil {
		sendSystemError(w, err)
		return
	}
	SendResponse(w, map[string]interface{}{"emojis": items}, 200)
}

// CommunityEmojiCreate - POST /community/emoji/create
func CommunityEmojiCreate(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		SendResponse(w, utils.MakeError("you can only POST to this route"), 405)
		return
	}
	type requestPayload struct {
		Community string `json:"community"`
		Name      string `json:"name"`
		// Key is no longer needed; name is unique globally
		Animated bool `json:"animated"`
	}
	var payload requestPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		SendResponse(w, utils.MakeError("invalid JSON"), 400)
		return
	}
	communityURL := strings.TrimSpace(strings.TrimPrefix(payload.Community, "@"))
	if communityURL == "" {
		SendResponse(w, utils.MakeError("community is required"), 400)
		return
	}
	c := models.Community{}
	if err := c.FindByURL(communityURL); err != nil {
		sendNotFound(w, errors.New("community not found"))
		return
	}
	userID := r.Context().Value("user_id").(int)
	isMod, err := isCommunityModerator(&c, userID)
	if err != nil {
		sendSystemError(w, err)
		return
	}
	if !isMod {
		SendResponse(w, utils.MakeError("only moderators can create community emojis"), 403)
		return
	}
	item, err := models.CreateCommunityEmoji(c.ID, userID, payload.Name, payload.Animated)
	if err != nil {
		SendResponse(w, map[string]string{"error": err.Error()}, 400)
		return
	}
	SendResponse(w, item, 201)
}

// UserEmojiCreate - POST /emoji/create
func UserEmojiCreate(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		SendResponse(w, utils.MakeError("you can only POST to this route"), 405)
		return
	}
	type requestPayload struct {
		Name     string `json:"name"`
		Animated bool   `json:"animated"`
	}
	var payload requestPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		SendResponse(w, utils.MakeError("invalid JSON"), 400)
		return
	}
	userID := r.Context().Value("user_id").(int)
	item, err := models.CreateUserEmoji(userID, payload.Name, payload.Animated)
	if err != nil {
		SendResponse(w, map[string]string{"error": err.Error()}, 400)
		return
	}
	SendResponse(w, item, 201)
}

// EmojiSets - GET /emojis/sets?community=...
func EmojiSets(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		SendResponse(w, utils.MakeError("you can only GET this route"), 405)
		return
	}
	userID := r.Context().Value("user_id").(int)
	communityURL := strings.TrimSpace(strings.TrimPrefix(r.URL.Query().Get("community"), "@"))
	communityEmojis := []models.Emoji{}
	if communityURL != "" {
		c := models.Community{}
		if err := c.FindByURL(communityURL); err == nil {
			items, err := models.GetCommunityEmojis(c.ID)
			if err != nil {
				sendSystemError(w, err)
				return
			}
			communityEmojis = items
		}
	}
	personal, err := models.GetUserOwnedEmojis(userID)
	if err != nil {
		sendSystemError(w, err)
		return
	}
	subscribed, err := models.GetUserSubscribedEmojis(userID)
	if err != nil {
		sendSystemError(w, err)
		return
	}
	SendResponse(w, map[string]interface{}{
		"defaults":   models.GetDefaultEmojis(),
		"community":  communityEmojis,
		"personal":   personal,
		"subscribed": subscribed,
	}, 200)
}

// EmojiSubscribe - POST /emoji/subscribe
func EmojiSubscribe(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		SendResponse(w, utils.MakeError("you can only POST to this route"), 405)
		return
	}
	type requestPayload struct {
		EmojiID   int    `json:"emojiID"`
		EmojiName string `json:"emojiName"`
	}
	var payload requestPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		SendResponse(w, utils.MakeError("invalid JSON"), 400)
		return
	}
	userID := r.Context().Value("user_id").(int)

	if payload.EmojiID > 0 {
		if err := models.SubscribeToEmoji(userID, payload.EmojiID); err != nil {
			sendSystemError(w, err)
			return
		}
	} else if payload.EmojiName != "" {
		if err := models.SubscribeToEmojiByName(userID, payload.EmojiName); err != nil {
			sendSystemError(w, err)
			return
		}
	} else {
		SendResponse(w, utils.MakeError("emojiID or emojiName is required"), 400)
		return
	}
	SendResponse(w, true, 200)
}

// EmojiByID - GET /emoji?id=1 or /emoji?ids=1,2,3
func EmojiByID(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		SendResponse(w, utils.MakeError("you can only GET this route"), 405)
		return
	}
	if id := strings.TrimSpace(r.URL.Query().Get("id")); id != "" {
		n, err := strconv.Atoi(id)
		if err != nil || n <= 0 {
			SendResponse(w, utils.MakeError("invalid id"), 400)
			return
		}
		item, err := models.GetEmojiByID(n)
		if err != nil {
			sendNotFound(w, errors.New("emoji not found"))
			return
		}
		SendResponse(w, item, 200)
		return
	}
	raw := strings.TrimSpace(r.URL.Query().Get("ids"))
	if raw == "" {
		SendResponse(w, utils.MakeError("id or ids is required"), 400)
		return
	}
	tokens := strings.Split(raw, ",")
	ids := make([]int, 0, len(tokens))
	for _, t := range tokens {
		n, err := strconv.Atoi(strings.TrimSpace(t))
		if err == nil && n > 0 {
			ids = append(ids, n)
		}
	}
	if len(ids) == 0 {
		SendResponse(w, utils.MakeError("no valid ids"), 400)
		return
	}
	items, err := models.GetEmojisByIDs(ids)
	if err != nil {
		sendSystemError(w, err)
		return
	}
	SendResponse(w, map[string]interface{}{"emojis": items}, 200)
}
