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

var nonioConfig bs.Config

func bootstrap() {
	c, err := bs.InitConfig()
	nonioConfig = c
	if err != nil {
		logError(err)
		log(nonioConfig)
		panic("Application can't start without a valid DB connection")
	}

	log("Application bootstrapped with these settings:")
	log("Port: " + nonioConfig.AppPort)
	log("Database: " + nonioConfig.DBDatabase)
	log("DB Username: " + nonioConfig.DBUsername)

	// let's now hydrate a few things in the handlers package
	handlers.DBConn = nonioConfig.DBConn
	handlers.Log = nonioConfig.Logger
	utils.HmacSampleSecret = nonioConfig.HMACKey
	utils.AdminEmail = nonioConfig.AdminEmail
	utils.AdminEmailPassword = nonioConfig.AdminEmailPassword
	utils.Log = nonioConfig.Logger
	fmt.Println(nonioConfig.AdminEmail)

	// let's now hydrate a few things in the middleware package
	middleware.Log = nonioConfig.Logger

	// let's now hydrate a few things in the models package
	models.DBConn = nonioConfig.DBConn
	models.Log = nonioConfig.Logger
	models.ServerFee, err = strconv.ParseFloat(nonioConfig.ServerFee, 64)
	models.WebHost = nonioConfig.WebHost

	// init the stripe secret key
	stripe.Key = nonioConfig.StripeSecretKey

	// LiveKit voice (optional)
	handlers.LiveKitURL = nonioConfig.LiveKitURL
	handlers.LiveKitAPIKey = nonioConfig.LiveKitAPIKey
	handlers.LiveKitSecret = nonioConfig.LiveKitSecret
}
