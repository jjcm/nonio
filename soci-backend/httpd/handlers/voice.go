package handlers

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"soci-backend/httpd/utils"
	"soci-backend/models"

	"github.com/livekit/protocol/auth"
	"github.com/livekit/protocol/livekit"
)

// VoiceJoin - POST /voice/join: validate membership, mint LiveKit token for room
func VoiceJoin(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		SendResponse(w, utils.MakeError("you can only POST to this route"), 405)
		return
	}

	type requestPayload struct {
		Community string `json:"community"`
		Channel   string `json:"channel"`
	}
	var payload requestPayload
	decoder := json.NewDecoder(r.Body)
	if err := decoder.Decode(&payload); err != nil {
		SendResponse(w, utils.MakeError("invalid JSON"), 400)
		return
	}

	communityURL := strings.TrimSpace(strings.TrimPrefix(payload.Community, "@"))
	channel := strings.TrimSpace(payload.Channel)

	if communityURL == "" {
		SendResponse(w, utils.MakeError("community is required"), 400)
		return
	}

	if LiveKitURL == "" || LiveKitAPIKey == "" || LiveKitSecret == "" {
		SendResponse(w, utils.MakeError("voice is not configured"), 503)
		return
	}

	userID := r.Context().Value("user_id").(int)
	username := r.Context().Value("user_username").(string)

	c := models.Community{}
	if err := c.FindByURL(communityURL); err != nil {
		sendNotFound(w, errors.New("community not found"))
		return
	}

	// Members-only: user must be subscribed to this community
	u := models.User{}
	u.FindByID(userID)
	subs, err := u.GetSubscribedCommunities()
	if err != nil {
		sendSystemError(w, err)
		return
	}
	isMember := false
	for _, sub := range subs {
		if sub.URL == c.URL {
			isMember = true
			break
		}
	}
	if !isMember {
		SendResponse(w, utils.MakeError("you must be a member of this community to join voice"), 403)
		return
	}

	ch := models.CommunityChannel{}
	if err := ch.FindByCommunityAndSlug(c.ID, channel); err != nil {
		sendNotFound(w, errors.New("channel not found"))
		return
	}
	if ch.Kind != models.ChannelKindVoice {
		SendResponse(w, utils.MakeError("channel is not a voice channel"), 400)
		return
	}

	roomName := "community:" + c.URL + ":" + channel
	identity := username

	at := auth.NewAccessToken(LiveKitAPIKey, LiveKitSecret)
	grant := &auth.VideoGrant{
		RoomJoin:     true,
		Room:         roomName,
		CanPublish:   ptr(true),
		CanSubscribe: ptr(true),
	}
	at.SetVideoGrant(grant).
		SetIdentity(identity).
		SetName(username).
		SetValidFor(24 * time.Hour)

	token, err := at.ToJWT()
	if err != nil {
		Log.Errorf("voice: failed to mint token: %v", err)
		sendSystemError(w, err)
		return
	}

	wsURL := strings.TrimSuffix(LiveKitURL, "/")
	if strings.HasPrefix(wsURL, "https://") {
		wsURL = "wss://" + wsURL[8:]
	} else if strings.HasPrefix(wsURL, "http://") {
		wsURL = "ws://" + wsURL[7:]
	}

	output := map[string]interface{}{
		"token":    token,
		"wsUrl":    wsURL,
		"roomName": roomName,
		"channel":  channel,
	}
	SendResponse(w, output, 200)
}

// VoicePresence - POST /voice/presence: list current participants by channel for a community
func VoicePresence(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		SendResponse(w, utils.MakeError("you can only POST to this route"), 405)
		return
	}

	type requestPayload struct {
		Community string `json:"community"`
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

	if LiveKitURL == "" || LiveKitAPIKey == "" || LiveKitSecret == "" {
		SendResponse(w, utils.MakeError("voice is not configured"), 503)
		return
	}

	userID := r.Context().Value("user_id").(int)

	c := models.Community{}
	if err := c.FindByURL(communityURL); err != nil {
		sendNotFound(w, errors.New("community not found"))
		return
	}

	// Members-only: user must be subscribed to this community
	u := models.User{}
	u.FindByID(userID)
	subs, err := u.GetSubscribedCommunities()
	if err != nil {
		sendSystemError(w, err)
		return
	}
	isMember := false
	for _, sub := range subs {
		if sub.URL == c.URL {
			isMember = true
			break
		}
	}
	if !isMember {
		SendResponse(w, utils.MakeError("you must be a member of this community to view voice presence"), 403)
		return
	}

	channels, err := getVoicePresenceChannels(c.URL)
	if err != nil {
		sendSystemError(w, err)
		return
	}

	SendResponse(w, map[string]interface{}{
		"community": c.URL,
		"channels":  channels,
	}, 200)
}

type liveKitBearerRoundTripper struct {
	token string
	base  http.RoundTripper
}

func (rt *liveKitBearerRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	next := req.Clone(req.Context())
	next.Header = req.Header.Clone()
	next.Header.Set("Authorization", "Bearer "+rt.token)
	return rt.base.RoundTrip(next)
}

func newLiveKitRoomServiceClient() (livekit.RoomService, error) {
	at := auth.NewAccessToken(LiveKitAPIKey, LiveKitSecret)
	grant := &auth.VideoGrant{
		RoomList:  true,
		RoomAdmin: true,
	}
	at.SetVideoGrant(grant).
		SetIdentity("nonio-backend-voice-presence").
		SetName("nonio-backend-voice-presence").
		SetValidFor(2 * time.Minute)

	token, err := at.ToJWT()
	if err != nil {
		return nil, err
	}

	httpClient := &http.Client{
		Transport: &liveKitBearerRoundTripper{
			token: token,
			base:  http.DefaultTransport,
		},
		Timeout: 5 * time.Second,
	}
	return livekit.NewRoomServiceProtobufClient(liveKitHTTPBaseURL(), httpClient), nil
}

func voiceRoomName(communityURL, channel string) string {
	return "community:" + communityURL + ":" + channel
}

func liveKitHTTPBaseURL() string {
	base := strings.TrimSuffix(strings.TrimSpace(LiveKitURL), "/")
	switch {
	case strings.HasPrefix(base, "wss://"):
		return "https://" + strings.TrimPrefix(base, "wss://")
	case strings.HasPrefix(base, "ws://"):
		return "http://" + strings.TrimPrefix(base, "ws://")
	default:
		return base
	}
}

func ptr(b bool) *bool { return &b }
