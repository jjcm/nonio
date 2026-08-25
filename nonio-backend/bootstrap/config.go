package bootstrap

import (
	"os"

	_ "github.com/go-sql-driver/mysql" // db connections are made via mysql/mariaDB
	"github.com/jmoiron/sqlx"
	"github.com/sirupsen/logrus"
)

// Config this is a general purpose struct where we can keep all the app
// configuration items in a singleton style object
type Config struct {
	AppPort              string
	DBHost               string
	DBPort               string
	DBDatabase           string
	DBUsername           string
	DBPassword           string
	ServerFee            string
	AdminEmail           string
	AdminEmailPassword   string
	WebHost              string
	HMACKey              []byte
	Logger               *logrus.Logger
	DBConn               *sqlx.DB
	StripeSecretKey      string
	StripePublishableKey string

	// LiveKit (optional): if set, voice channels are enabled
	LiveKitURL    string
	LiveKitAPIKey string
	LiveKitSecret string
}

// InitConfig this function will run and log out all the different environment
// variables if something isn't set correctly, it'll die and log the errors
func InitConfig() (Config, error) {
	requiredVars := []string{
		"APP_KEY",
		"STRIPE_SECRET_KEY",
		"STRIPE_PUBLISHABLE_KEY",
	}
	for _, v := range requiredVars {
		if os.Getenv(v) == "" {
			panic("The env variable " + v + " is required")
		}
	}

	c := Config{
		DBHost:               os.Getenv("DB_HOST"),
		DBPort:               os.Getenv("DB_PORT"),
		DBDatabase:           os.Getenv("DB_DATABASE"),
		DBUsername:           os.Getenv("DB_USER"),
		DBPassword:           os.Getenv("DB_PASSWORD"),
		AppPort:              os.Getenv("APP_PORT"),
		ServerFee:            os.Getenv("SERVER_FEE"),
		AdminEmail:           os.Getenv("ADMIN_EMAIL"),
		AdminEmailPassword:   os.Getenv("ADMIN_EMAIL_PASSWORD"),
		WebHost:              os.Getenv("WEB_HOST"),
		HMACKey:              []byte(os.Getenv("APP_KEY")),
		StripeSecretKey:      os.Getenv("STRIPE_SECRET_KEY"),
		StripePublishableKey: os.Getenv("STRIPE_PUBLISHABLE_KEY"),
		LiveKitURL:           os.Getenv("LIVEKIT_URL"),
		LiveKitAPIKey:        os.Getenv("LIVEKIT_API_KEY"),
		LiveKitSecret:        os.Getenv("LIVEKIT_API_SECRET"),
	}
	// now that we've tried to pull the env values, let's set defaults if any of them are empty
	if c.DBHost == "" {
		c.DBHost = "localhost"
	}
	if c.DBDatabase == "" {
		c.DBDatabase = "socidb"
	}
	if c.DBPassword == "" {
		c.DBPassword = "password"
	}
	if c.DBPort == "" {
		c.DBPort = "3306"
	}
	if c.DBUsername == "" {
		c.DBUsername = "dbuser"
	}
	if c.AppPort == "" {
		c.AppPort = "9000"
	}
	if c.ServerFee == "" {
		c.ServerFee = "1"
	}
	if c.WebHost == "" {
		c.WebHost = "http://localhost:4200"
	}

	// initialize logging to stdout, maybe later we can extend this to
	// log stash/splunk/etc
	c.Logger = logrus.New()
	c.Logger.Out = os.Stdout

	db, err := sqlx.Connect("mysql", dsn(c))
	if err != nil {
		return c, err
	}

	c.DBConn = db
	return c, nil
}

func dsn(c Config) string {
	dsn := c.DBUsername + ":" + c.DBPassword + "@tcp(" + c.DBHost + ":" + c.DBPort + ")/" + c.DBDatabase + "?parseTime=true"
	return dsn
}
