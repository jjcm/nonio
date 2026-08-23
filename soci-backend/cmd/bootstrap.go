package main

import (
	"fmt"
	bs "soci-backend/bootstrap"
	"soci-backend/httpd/handlers"
	"soci-backend/httpd/middleware"
	"soci-backend/httpd/utils"
	"soci-backend/models"
	"strconv"

	"github.com/stripe/stripe-go/v72"
)

var sociConfig bs.Config

func bootstrap() {
	c, err := bs.InitConfig()
	sociConfig = c
	if err != nil {
		logError(err)
		log(sociConfig)
		panic("Application can't start without a valid DB connection")
	}

	log("Application bootstrapped with these settings:")
	log("Port: " + sociConfig.AppPort)
	log("Database: " + sociConfig.DBDatabase)
	log("DB Username: " + sociConfig.DBUsername)

	// let's now hydrate a few things in the handlers package
	handlers.DBConn = sociConfig.DBConn
	handlers.Log = sociConfig.Logger
	utils.HmacSampleSecret = sociConfig.HMACKey
	utils.AdminEmail = sociConfig.AdminEmail
	utils.AdminEmailPassword = sociConfig.AdminEmailPassword
	utils.Log = sociConfig.Logger
	fmt.Println(sociConfig.AdminEmail)

	// let's now hydrate a few things in the middleware package
	middleware.Log = sociConfig.Logger

	// let's now hydrate a few things in the models package
	models.DBConn = sociConfig.DBConn
	models.Log = sociConfig.Logger
	models.ServerFee, err = strconv.ParseFloat(sociConfig.ServerFee, 64)
	models.WebHost = sociConfig.WebHost

	// init the stripe secret key
	stripe.Key = sociConfig.StripeSecretKey

	// LiveKit voice (optional)
	handlers.LiveKitURL = sociConfig.LiveKitURL
	handlers.LiveKitAPIKey = sociConfig.LiveKitAPIKey
	handlers.LiveKitSecret = sociConfig.LiveKitSecret
}
