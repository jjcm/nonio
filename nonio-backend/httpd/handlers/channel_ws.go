package handlers

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"sync"
	"time"

	"nonio-backend/httpd/utils"
	"nonio-backend/models"

	"golang.org/x/net/websocket"
)

var channelMessageHub = newChannelMessageHub()

type channelMessageHubStore struct {
	mu      sync.RWMutex
	clients map[string]map[*channelMessageClient]struct{}
}

type channelMessageClient struct {
	conn      *websocket.Conn
	community string
	channel   string
	mu        sync.Mutex
}

func newChannelMessageHub() *channelMessageHubStore {
	return &channelMessageHubStore{
		clients: map[string]map[*channelMessageClient]struct{}{},
	}
}

func channelMessageHubKey(community, channel string) string {
	return community + "\n" + channel
}

func (h *channelMessageHubStore) add(client *channelMessageClient) {
	key := channelMessageHubKey(client.community, client.channel)
	h.mu.Lock()
	defer h.mu.Unlock()
	if _, ok := h.clients[key]; !ok {
		h.clients[key] = map[*channelMessageClient]struct{}{}
	}
	h.clients[key][client] = struct{}{}
}

func (h *channelMessageHubStore) remove(client *channelMessageClient) {
	key := channelMessageHubKey(client.community, client.channel)
	h.mu.Lock()
	defer h.mu.Unlock()
	channelClients, ok := h.clients[key]
	if !ok {
		return
	}
	delete(channelClients, client)
	if len(channelClients) == 0 {
		delete(h.clients, key)
	}
}

func (h *channelMessageHubStore) clientsFor(community, channel string) []*channelMessageClient {
	key := channelMessageHubKey(community, channel)
	h.mu.RLock()
	defer h.mu.RUnlock()
	channelClients := h.clients[key]
	out := make([]*channelMessageClient, 0, len(channelClients))
	for client := range channelClients {
		out = append(out, client)
	}
	return out
}

func (c *channelMessageClient) writeJSON(payload interface{}) error {
	data, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	_ = c.conn.SetWriteDeadline(time.Now().Add(5 * time.Second))
	return websocket.Message.Send(c.conn, string(data))
}

func broadcastChannelMessageCreated(community, channel string, message interface{}) {
	payload := map[string]interface{}{
		"type":      "channel.message.created",
		"community": community,
		"channel":   channel,
		"message":   message,
	}
	for _, client := range channelMessageHub.clientsFor(community, channel) {
		if err := client.writeJSON(payload); err != nil {
			channelMessageHub.remove(client)
			_ = client.conn.Close()
		}
	}
}

func broadcastChannelMessageReactionUpdated(community, channel string, messageID int, emoji string, reacted bool, count int) {
	payload := map[string]interface{}{
		"type":      "channel.message.reaction",
		"community": community,
		"channel":   channel,
		"messageID": messageID,
		"emoji":     emoji,
		"reacted":   reacted,
		"count":     count,
	}
	for _, client := range channelMessageHub.clientsFor(community, channel) {
		if err := client.writeJSON(payload); err != nil {
			channelMessageHub.remove(client)
			_ = client.conn.Close()
		}
	}
}

// ChannelMessagesWS - GET /community/channel/ws?community=...&channel=...&token=...
func ChannelMessagesWS(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		SendResponse(w, utils.MakeError("you can only GET this route"), http.StatusMethodNotAllowed)
		return
	}
	communityURL := strings.TrimSpace(strings.TrimPrefix(r.URL.Query().Get("community"), "@"))
	channelSlug := strings.TrimSpace(r.URL.Query().Get("channel"))
	if communityURL == "" || channelSlug == "" {
		SendResponse(w, utils.MakeError("community and channel are required"), http.StatusBadRequest)
		return
	}
	user, err := wsAuthUserFromRequest(r)
	if err != nil {
		SendResponse(w, utils.MakeError(err.Error()), http.StatusUnauthorized)
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
		SendResponse(w, utils.MakeError("channel is not a text channel"), http.StatusBadRequest)
		return
	}
	isMember, err := ensureCommunityMember(&c, user.ID)
	if err != nil {
		sendSystemError(w, err)
		return
	}
	if !isMember {
		SendResponse(w, utils.MakeError("you must be a member of this community to read messages"), http.StatusForbidden)
		return
	}

	websocket.Handler(func(conn *websocket.Conn) {
		client := &channelMessageClient{
			conn:      conn,
			community: c.URL,
			channel:   ch.Slug,
		}
		channelMessageHub.add(client)
		defer func() {
			channelMessageHub.remove(client)
			_ = conn.Close()
		}()
		for {
			var ignored string
			if err := websocket.Message.Receive(conn, &ignored); err != nil {
				return
			}
		}
	}).ServeHTTP(w, r)
}
