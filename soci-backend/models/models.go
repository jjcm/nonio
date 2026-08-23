package models

import (
	"github.com/jmoiron/sqlx"
	"github.com/sirupsen/logrus"
)

// DBConn this is here so that we can hydrate all the web handlers with the same
// DB connection that we are using in the main package
var DBConn *sqlx.DB

// Log this is here so we can share the same logger with the main package
var Log *logrus.Logger

// The fee for the server
var ServerFee float64

// The url for the frontend being used
var WebHost string
