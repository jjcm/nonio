package main

import (
	"os"

	"github.com/urfave/cli"
)

func main() {
	// check app config and bootstrap system
	bootstrap()

	app := cli.NewApp()
	app.Name = "soci-backend"
	app.Version = "0.0.0"
	app.Usage = "launch the web API server for SOCI"
	app.Flags = []cli.Flag{
		&cli.StringFlag{
			Name:  "port, p",
			Usage: "The port number should we run the API on",
		},
	}
	app.Action = runApp
	app.Commands = []cli.Command{
		migrateQuillToMarkdownCommand(),
	}

	err := app.Run(os.Args)
	if err != nil {
		logError(err)
	}
}
