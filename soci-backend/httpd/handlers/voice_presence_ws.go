package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"runtime/debug"
	"sort"
	"strings"
	"sync"
	"time"

	"soci-backend/httpd/utils"
	"soci-backend/models"

	jwt "github.com/dgrijalva/jwt-go"
	"github.com/livekit/protocol/livekit"
	"golang.org/x/net/websocket"
)

const voicePresenceTickInterval = 1 * time.Second

var voicePresenceHub = newCommunityVoicePresenceHub()
var voicePresenceBroadcasterOnce sync.Once

type communityVoicePresenceHub struct {
	mu        sync.RWMutex
	clients   map[string]map[*voicePresenceClient]struct{}
	snapshots map[string]map[string][]string
}

type voicePresenceClient struct {
	conn      *websocket.Conn
	community string
	mu        sync.Mutex
}

func newCommunityVoicePresenceHub() *communityVoicePresenceHub {
	return &communityVoicePresenceHub{
		clients:   map[string]map[*voicePresenceClient]struct{}{},
		snapshots: map[string]map[string][]string{},
	}
}

func (h *communityVoicePresenceHub) add(client *voicePresenceClient) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if _, ok := h.clients[client.community]; !ok {
		h.clients[client.community] = map[*voicePresenceClient]struct{}{}
	}
	h.clients[client.community][client] = struct{}{}
}

func (h *communityVoicePresenceHub) remove(client *voicePresenceClient) {
	h.mu.Lock()
	defer h.mu.Unlock()
	communityClients, ok := h.clients[client.community]
	if !ok {
		return
	}
	delete(communityClients, client)
	if len(communityClients) == 0 {
		delete(h.clients, client.community)
		delete(h.snapshots, client.community)
	}
}

func (h *communityVoicePresenceHub) communities() []string {
	h.mu.RLock()
	defer h.mu.RUnlock()
	keys := make([]string, 0, len(h.clients))
	for community, clients := range h.clients {
		if len(clients) == 0 {
			continue
		}
		keys = append(keys, community)
	}
	return keys
}

func (h *communityVoicePresenceHub) snapshot(community string) map[string][]string {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return clonePresenceMap(h.snapshots[community])
}

func (h *communityVoicePresenceHub) setSnapshot(community string, snapshot map[string][]string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.snapshots[community] = clonePresenceMap(snapshot)
}

func (h *communityVoicePresenceHub) communityClients(community string) []*voicePresenceClient {
	h.mu.RLock()
	defer h.mu.RUnlock()
	clients := h.clients[community]
	out := make([]*voicePresenceClient, 0, len(clients))
	for client := range clients {
		out = append(out, client)
	}
	return out
}

func (h *communityVoicePresenceHub) communityClientCount(community string) int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.clients[community])
}

func (c *voicePresenceClient) writeJSON(payload interface{}) error {
	data, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	_ = c.conn.SetWriteDeadline(time.Now().Add(5 * time.Second))
	return websocket.Message.Send(c.conn, string(data))
}

type voicePresenceChange struct {
	Channel      string   `json:"channel"`
	Joined       []string `json:"joined,omitempty"`
	Left         []string `json:"left,omitempty"`
	Participants []string `json:"participants"`
}

func ensureVoicePresenceBroadcaster() {
	voicePresenceBroadcasterOnce.Do(func() {
		go func() {
			ticker := time.NewTicker(voicePresenceTickInterval)
			defer ticker.Stop()
			for range ticker.C {
				if LiveKitURL == "" || LiveKitAPIKey == "" || LiveKitSecret == "" {
					continue
				}
				communities := voicePresenceHub.communities()
				for _, community := range communities {
					next, err := getVoicePresenceChannels(community)
					if err != nil {
						Log.WithError(err).Warnf("voice presence ws: refresh failed for @%s", community)
						continue
					}
					prev := voicePresenceHub.snapshot(community)
					changes := diffVoicePresence(prev, next)
					if len(changes) == 0 {
						continue
					}
					voicePresenceHub.setSnapshot(community, next)
					msg := map[string]interface{}{
						"type":      "voice.presence.update",
						"community": community,
						"channels":  next,
						"changes":   changes,
					}
					Log.Infof("voice presence ws: broadcast update @%s changes=%d clients=%d", community, len(changes), voicePresenceHub.communityClientCount(community))
					for _, client := range voicePresenceHub.communityClients(community) {
						if err := client.writeJSON(msg); err != nil {
							Log.WithError(err).Debugf("voice presence ws: dropping stale client for @%s", community)
							voicePresenceHub.remove(client)
							_ = client.conn.Close()
						}
					}
				}
			}
		}()
	})
}

// VoicePresenceWS - GET /voice/presence/ws?community=...&token=...
func VoicePresenceWS(w http.ResponseWriter, r *http.Request) {
	defer func() {
		if rec := recover(); rec != nil {
			Log.Errorf("voice presence ws: panic url=%s remote=%s panic=%v stack=%s", r.URL.String(), r.RemoteAddr, rec, string(debug.Stack()))
		}
	}()

	if r.Method != http.MethodGet {
		Log.Warnf("voice presence ws: reject method=%s url=%s remote=%s", r.Method, r.URL.String(), r.RemoteAddr)
		SendResponse(w, utils.MakeError("you can only GET this route"), http.StatusMethodNotAllowed)
		return
	}
	if LiveKitURL == "" || LiveKitAPIKey == "" || LiveKitSecret == "" {
		Log.Warnf("voice presence ws: reject voice-not-configured url=%s remote=%s", r.URL.String(), r.RemoteAddr)
		SendResponse(w, utils.MakeError("voice is not configured"), http.StatusServiceUnavailable)
		return
	}

	communityURL := strings.TrimSpace(strings.TrimPrefix(r.URL.Query().Get("community"), "@"))
	if communityURL == "" {
		Log.Warnf("voice presence ws: reject missing-community url=%s remote=%s", r.URL.String(), r.RemoteAddr)
		SendResponse(w, utils.MakeError("community is required"), http.StatusBadRequest)
		return
	}

	user, err := wsAuthUserFromRequest(r)
	if err != nil {
		Log.WithError(err).Warnf("voice presence ws: reject auth url=%s remote=%s", r.URL.String(), r.RemoteAddr)
		SendResponse(w, utils.MakeError(err.Error()), http.StatusUnauthorized)
		return
	}

	c := models.Community{}
	if err := c.FindByURL(communityURL); err != nil {
		Log.WithError(err).Warnf("voice presence ws: reject community-not-found community=%s url=%s remote=%s", communityURL, r.URL.String(), r.RemoteAddr)
		sendNotFound(w, errors.New("community not found"))
		return
	}

	subs, err := user.GetSubscribedCommunities()
	if err != nil {
		Log.WithError(err).Warnf("voice presence ws: reject membership-fetch-failed community=%s userID=%d url=%s remote=%s", c.URL, user.ID, r.URL.String(), r.RemoteAddr)
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
		Log.Warnf("voice presence ws: reject not-member community=%s userID=%d url=%s remote=%s", c.URL, user.ID, r.URL.String(), r.RemoteAddr)
		SendResponse(w, utils.MakeError("you must be a member of this community to view voice presence"), http.StatusForbidden)
		return
	}

	ensureVoicePresenceBroadcaster()
	Log.Infof("voice presence ws: attempting upgrade community=%s userID=%d remote=%s origin=%s", c.URL, user.ID, r.RemoteAddr, r.Header.Get("Origin"))

	websocket.Handler(func(conn *websocket.Conn) {
		remoteAddr := conn.RemoteAddr().String()
		Log.Infof("voice presence ws: connected @%s userID=%d remote=%s", c.URL, user.ID, remoteAddr)
		client := &voicePresenceClient{
			conn:      conn,
			community: c.URL,
		}
		voicePresenceHub.add(client)
		Log.Infof("voice presence ws: clients @%s now=%d", c.URL, voicePresenceHub.communityClientCount(c.URL))
		closeReason := "handler-exit"
		defer func() {
			voicePresenceHub.remove(client)
			Log.Infof("voice presence ws: disconnected @%s userID=%d remote=%s reason=%s clients_now=%d", c.URL, user.ID, remoteAddr, closeReason, voicePresenceHub.communityClientCount(c.URL))
			_ = conn.Close()
		}()

		initial, err := getVoicePresenceChannels(c.URL)
		if err == nil {
			voicePresenceHub.setSnapshot(c.URL, initial)
			_ = client.writeJSON(map[string]interface{}{
				"type":      "voice.presence.snapshot",
				"community": c.URL,
				"channels":  initial,
			})
			Log.Infof("voice presence ws: initial snapshot sent @%s channels=%d", c.URL, len(initial))
		} else {
			Log.WithError(err).Warnf("voice presence ws: initial snapshot failed for @%s", c.URL)
		}

		for {
			var ignored string
			if err := websocket.Message.Receive(conn, &ignored); err != nil {
				closeReason = err.Error()
				Log.WithError(err).Infof("voice presence ws: receive loop ended @%s userID=%d remote=%s", c.URL, user.ID, remoteAddr)
				return
			}
		}
	}).ServeHTTP(w, r)
	Log.Infof("voice presence ws: upgrade handler returned community=%s userID=%d remote=%s", c.URL, user.ID, r.RemoteAddr)
}

func wsAuthUserFromRequest(r *http.Request) (models.User, error) {
	token := strings.TrimSpace(r.URL.Query().Get("token"))
	if token == "" {
		authHeader := strings.TrimSpace(r.Header.Get("Authorization"))
		if len(authHeader) > 7 && strings.HasPrefix(authHeader, "Bearer ") {
			token = strings.TrimSpace(authHeader[7:])
		}
	}
	if token == "" {
		return models.User{}, errors.New("authorization required")
	}

	goodies, err := jwt.Parse(token, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return utils.HmacSampleSecret, nil
	})
	if err != nil || !goodies.Valid {
		return models.User{}, errors.New("error working with your token")
	}

	claims, ok := goodies.Claims.(jwt.MapClaims)
	if !ok {
		return models.User{}, errors.New("error working with your token")
	}

	expiresAtRaw, ok := claims["expiresAt"].(float64)
	if !ok {
		return models.User{}, errors.New("error working with your token")
	}
	if time.Now().After(time.Unix(int64(expiresAtRaw), 0)) {
		return models.User{}, errors.New("your token is expired")
	}

	email, ok := claims["email"].(string)
	if !ok || strings.TrimSpace(email) == "" {
		return models.User{}, errors.New("error working with your token")
	}

	user := models.User{}
	user.FindByEmail(email)
	if user.ID == 0 {
		return models.User{}, errors.New("your user is no longer valid")
	}
	return user, nil
}

func getVoicePresenceChannels(communityURL string) (map[string][]string, error) {
	c := models.Community{}
	if err := c.FindByURL(communityURL); err != nil {
		return nil, err
	}

	roomService, err := newLiveKitRoomServiceClient()
	if err != nil {
		return nil, err
	}

	allChannels, err := models.GetChannelsByCommunityID(c.ID)
	if err != nil {
		return nil, err
	}
	voiceSlugs := make([]string, 0, len(allChannels))
	for _, ch := range allChannels {
		if ch.Kind == models.ChannelKindVoice {
			voiceSlugs = append(voiceSlugs, ch.Slug)
		}
	}

	channels := map[string][]string{}
	for _, channel := range voiceSlugs {
		roomName := voiceRoomName(c.URL, channel)
		resp, listErr := roomService.ListParticipants(context.Background(), &livekit.ListParticipantsRequest{Room: roomName})
		if listErr != nil {
			Log.WithError(listErr).Debugf("voice presence ws: list participants failed for %s", roomName)
			channels[channel] = []string{}
			continue
		}

		idents := make([]string, 0, len(resp.Participants))
		for _, p := range resp.Participants {
			identity := strings.TrimSpace(p.Identity)
			if identity == "" {
				continue
			}
			idents = append(idents, identity)
		}
		sort.Strings(idents)
		channels[channel] = idents
	}
	return channels, nil
}

func clonePresenceMap(in map[string][]string) map[string][]string {
	if in == nil {
		return map[string][]string{}
	}
	out := make(map[string][]string, len(in))
	for channel, participants := range in {
		cp := append([]string(nil), participants...)
		sort.Strings(cp)
		out[channel] = cp
	}
	return out
}

func diffVoicePresence(prev, next map[string][]string) []voicePresenceChange {
	allChannelsMap := map[string]struct{}{}
	for channel := range prev {
		allChannelsMap[channel] = struct{}{}
	}
	for channel := range next {
		allChannelsMap[channel] = struct{}{}
	}

	allChannels := make([]string, 0, len(allChannelsMap))
	for channel := range allChannelsMap {
		allChannels = append(allChannels, channel)
	}
	sort.Strings(allChannels)

	changes := make([]voicePresenceChange, 0)
	for _, channel := range allChannels {
		prevSet := toSet(prev[channel])
		nextSet := toSet(next[channel])

		joined := make([]string, 0)
		for participant := range nextSet {
			if _, ok := prevSet[participant]; !ok {
				joined = append(joined, participant)
			}
		}
		left := make([]string, 0)
		for participant := range prevSet {
			if _, ok := nextSet[participant]; !ok {
				left = append(left, participant)
			}
		}
		if len(joined) == 0 && len(left) == 0 {
			continue
		}
		sort.Strings(joined)
		sort.Strings(left)
		participants := append([]string(nil), next[channel]...)
		sort.Strings(participants)
		changes = append(changes, voicePresenceChange{
			Channel:      channel,
			Joined:       joined,
			Left:         left,
			Participants: participants,
		})
	}
	return changes
}

func toSet(values []string) map[string]struct{} {
	set := map[string]struct{}{}
	for _, value := range values {
		trimmed := strings.TrimSpace(value)
		if trimmed == "" {
			continue
		}
		set[trimmed] = struct{}{}
	}
	return set
}
