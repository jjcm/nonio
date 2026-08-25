package util

import (
	"sync"

	"github.com/gorilla/websocket"
)

// EncodingSession tracks an active encoding session
type EncodingSession struct {
	Filename     string
	Connections  []*websocket.Conn
	Resolution   string // "widthxheight"
	Mutex        sync.Mutex
}

var (
	// activeSessions maps filenames (without extension) to active encoding sessions
	activeSessions = make(map[string]*EncodingSession)
	sessionsMutex  sync.RWMutex
)

// GetOrCreateSession gets an existing encoding session or creates a new one
func GetOrCreateSession(filename string) *EncodingSession {
	sessionsMutex.Lock()
	defer sessionsMutex.Unlock()

	if session, ok := activeSessions[filename]; ok {
		return session
	}

	session := &EncodingSession{
		Filename:    filename,
		Connections: make([]*websocket.Conn, 0),
	}
	activeSessions[filename] = session
	return session
}

// GetSession gets an existing encoding session
func GetSession(filename string) (*EncodingSession, bool) {
	sessionsMutex.RLock()
	defer sessionsMutex.RUnlock()
	session, ok := activeSessions[filename]
	return session, ok
}

// AddConnection adds a WebSocket connection to a session
func (s *EncodingSession) AddConnection(ws *websocket.Conn) {
	s.Mutex.Lock()
	defer s.Mutex.Unlock()
	s.Connections = append(s.Connections, ws)
}

// Broadcast sends a message to all connected WebSockets in this session
func (s *EncodingSession) Broadcast(message []byte) {
	s.Mutex.Lock()
	defer s.Mutex.Unlock()
	
	// Remove closed connections and send to active ones
	activeConnections := make([]*websocket.Conn, 0)
	for _, conn := range s.Connections {
		if err := conn.WriteMessage(websocket.TextMessage, message); err != nil {
			// Connection is closed, skip it
			continue
		}
		activeConnections = append(activeConnections, conn)
	}
	s.Connections = activeConnections
}

// Close removes the session
func CloseSession(filename string) {
	sessionsMutex.Lock()
	defer sessionsMutex.Unlock()
	
	if session, ok := activeSessions[filename]; ok {
		session.Mutex.Lock()
		// Close all connections
		for _, conn := range session.Connections {
			conn.Close()
		}
		session.Mutex.Unlock()
		delete(activeSessions, filename)
	}
}

