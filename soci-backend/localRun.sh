cd cmd
go build -o ../dist/socid
export APP_KEY="asdfa323faefjifajwiefawef"
export WEB_HOST="http://localhost:4200"
export DB_HOST="127.0.0.1"
export DB_PORT="3306"
export DB_DATABASE="socidb"
export DB_USER="dbuser"
export DB_PASSWORD="password"
export APP_PORT="4201"
# Gmail App Password for sending emails (forgot password, etc.)
# Generate at: https://myaccount.google.com/apppasswords (requires 2FA enabled)
export ADMIN_EMAIL="nonio@non.io"
export ADMIN_EMAIL_PASSWORD="Some password here"
export STRIPE_SECRET_KEY="sk_test_51EpA4oH4gvdXgbs5rBv4JI29C38uWuNEGuB8Agt5hfya1fjgVGOQePyfj7x6ANDPE7hyYNZEMRWwkP93NAa7QTCl00GPr79F0w"
export STRIPE_PUBLISHABLE_KEY="pk_test_51EpA4oH4gvdXgbs5r0aq0i3U6IzOwbWRVYaBYXMFLLHvihVHGHotHPAi2EJ7Km9JqudFZyLE30kt2YQSUOSK88Xx00Q6eEqxmS"
export WEBHOOK_ENDPOINT_SECRET=""
export LIVEKIT_URL="http://localhost:7880"
export LIVEKIT_API_KEY="devkey"
export LIVEKIT_API_SECRET="secret"

# Dev-only: enable simulator support (safe for local dev only)
export DEV_TOOLS_ENABLED="true"
export DEV_SUBSCRIPTION_PAYOUTS="true"
export PAYOUT_CYCLE_DAYS="1"

cd ../migrations
goose mysql "${DB_USER}:${DB_PASSWORD}@tcp(${DB_HOST}:${DB_PORT})/${DB_DATABASE}" up

../dist/socid

