package main

import (
	"fmt"
	"net/http"
	"os"
	"time"

	"soci-backend/httpd"
	"soci-backend/httpd/middleware"
	"soci-backend/models"

	"github.com/go-co-op/gocron"
	"github.com/urfave/cli"
)

func runApp(c *cli.Context) error {
	for path, handler := range httpd.OpenRoutes() {
		http.HandleFunc(path, middleware.Gzip(middleware.OpenCors(handler)))
	}
	for path, handler := range httpd.OptionalAuthRoutes() {
		http.HandleFunc(path, middleware.Gzip(middleware.OpenCors(middleware.CheckTokenOptional(handler))))
	}
	for path, handler := range httpd.ProtectedRoutes() {
		http.HandleFunc(path, middleware.Gzip(middleware.ClosedCors(middleware.CheckToken(handler))))
	}

	schedule := gocron.NewScheduler(time.UTC)
	schedule.Every(1).Minutes().Do(models.ProcessPayouts)
	// Dev-only: generate subscription-funded payouts on a shorter cycle (e.g. daily) without Stripe.
	// Guarded by env so we never accidentally run this in prod.
	if os.Getenv("DEV_SUBSCRIPTION_PAYOUTS") == "true" {
		schedule.Every(10).Minutes().Do(models.EnsureSubscriptionPayouts)
	}

	schedule.StartAsync()
	_, nextTime := schedule.NextRun()
	log(fmt.Sprintf("Next payment calculation will run on %v", nextTime.Format("Mon Jan 2 15:04:05 2006")))

	models.FixUserSubs()

	log("Starting web api at port " + sociConfig.AppPort)
	http.ListenAndServe(":"+sociConfig.AppPort, nil)

	return nil
}
