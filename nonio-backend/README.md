# Nonio API - Now in Go!

This small program runs the backend API for the SCOI Web App.

# Requirements

You need to have a few environment variables set in order for the go app to run. If you don't have these set, it'll make a few (sensible?) default assumptions:

```
APP_PORT=9000
DB_HOST=localhost
DB_PORT=3306
DB_DATABASE=socidb
DB_USER=dbuser
DB_PASSWORD=password
```

There is one environment variable that you'll need to set that doesn't have a default. `APP_KEY` is what is used to sign the JWT tokens, and it should be a nice random string between 32 and 64 chars. If you ever change this, the JWTs that are signed with one key won't be readable with another key. So, on my local computer, I start the linux binary with this command from the project root:

`APP_KEY=asdf DB_USER=root DB_PASSWORD=secret dist/noniod`

# Database

Next, you'll probably need to make sure that database exists and that your db user has the correct permissions to work with that database. 

`CREATE DATABASE socidb;`

`CREATE USER 'dbuser'@localhost IDENTIFIED BY 'password';`

`GRANT ALL PRIVILEGES ON 'socidb'.* TO 'dbuser'@localhost;`

You can get the database schema up to date by running the migrations inside the `migrations/` folder. You'll need to have goose (https://github.com/pressly/goose) added to your path.

If that's all good to go, go ahead and run this command from inside the migrations folder:

```
goose mysql "dbuser:dbpass@tcp(dbhost:dbport)/dbname" up
```

Here's what I run on my local dev machine:

```
goose mysql "root:password@tcp(127.0.0.1:3306)/socidb" up
```

## Building the app

If all is well up to this point, you can build the binary. The included `build.sh` bash script will try and build the go code and place two different binary files into the `dist/` folder. There's one for linux, and one for OSX, so jump into that folder and run whichever one makes sense for you.

## Deploymet of builds

When your latest code is ready to be tested on the stanging server, we can build this code directly on the staging machine. While the team is small, this works pretty well. We will eventually want to automate this into a CI/CD pipeline, but until then here is what you can do:

First ssh into the staging machine. Once you are there, navigate to the `/nonio` folder and run `./release.sh`. You will likely need to run this with sudo privileges, as it not only builds the latest binary but also stops the systemd process, replaces the old binary with the new one, and starts up the service again. It also runs all migrations on the DB, so please make sure your migrations are all up to date and working properly with the tests before running this script.

If you are having trouble with permissions, you may also want to add your user to the linux group `soci-build`. All files created in the /soci-build folder wil be owned by the group `soci-build` so as long as your user is in that group all git commands should work.

This release script is pretty rudimentary, and assumes success on each build step, so there is definitly room for improvement here. Since this is a temporary hold while we are still pre alpha, it'll do the job.

## Voice (LiveKit)

Voice channels use a self-hosted [LiveKit](https://github.com/livekit/livekit) server. If the following env vars are not set, the `/voice/join` endpoint returns 503 and the frontend hides voice UI when not configured.

Optional environment variables:

- `LIVEKIT_URL` – LiveKit server URL (e.g. `https://livekit.example.com` or `wss://livekit.example.com`). The API returns the WebSocket URL to the client (http(s) is converted to ws(s)).
- `LIVEKIT_API_KEY` – LiveKit API key (e.g. `devkey` for local dev).
- `LIVEKIT_API_SECRET` – LiveKit API secret (e.g. `secret` for local dev).

Run LiveKit locally: `livekit-server --dev` (see [LiveKit docs](https://docs.livekit.io)). Then set `LIVEKIT_URL=http://localhost:7880` (or your LiveKit HTTP URL). Only community members (subscribers) can obtain a token to join a community’s voice channels.

## Example

Start up the Go API (if you're on OSX, the example below needs to run the noniod-osx binary), then jump into the example directory and start up a dev server (example below uses PHP 🤔) to see how this works. There's a very basic HTML file in there that uses vue.js to make a few AJAX requests.

```
# from the project root
APP_KEY=asdfasdfasdfasdf DB_USER=root DB_PASSWORD=secret dist/noniod &

cd example/
php -S localhost:8888
```
