package handlers

import (
	"github.com/jmoiron/sqlx"
	"github.com/sirupsen/logrus"
)

// DBConn this is here so that we can hydrate all the web handlers with the same
// DB connection that we are using in the main package
var DBConn *sqlx.DB

// Log this is here so we can share the same logger with the main package
var Log *logrus.Logger

// LiveKit config for voice channels (set by bootstrap when LIVEKIT_* env vars are present)
var LiveKitURL, LiveKitAPIKey, LiveKitSecret string
