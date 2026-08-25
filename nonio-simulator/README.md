# nonio-simulator

Dev-only activity simulator for the `nonio` stack.

## What it does

- Bootstraps **multiple users** (register/login)
- Sets each user’s **subscription amount** (dev-only backend endpoint)
- Every **1 minute**, performs one action:
  - **5%**: create a post (blog/rant/joke) OR generate an image via fal.ai and post it
  - **95%**: interact with an existing post by adding/upvoting a tag; optionally read/upvote/reply to comments
- Uses **Grok (xAI)** to pick actions/content and **fal.ai Z-Image Turbo** for image generation.

## Prereqs (local dev)

- `nonio-backend` running (default `http://localhost:4201`)
- `nonio-image-cdn` running (default `http://localhost:4203`)
- Enable dev tools + dev subscription payouts in `nonio-backend` (see below)

### Backend dev flags

In the environment for `nonio-backend` set:

- `DEV_TOOLS_ENABLED=true` (enables `POST /dev/user/set-subscription`)
- `DEV_SUBSCRIPTION_PAYOUTS=true` (enables periodic generation of payout rows from `subscription_amount`)
- `PAYOUT_CYCLE_DAYS=1` (daily payout cycle for dev)

## Configure (env vars)

Set these env vars when you run the simulator:

- **Required**
  - `XAI_API_KEY`: Grok API key (used via `https://api.x.ai/v1/chat/completions`) [docs](https://docs.x.ai/llms.txt)
  - `FAL_KEY`: fal.ai key (used via `https://fal.run/fal-ai/z-image/turbo`) [docs](https://fal.ai/models/fal-ai/z-image/turbo/llms.txt)

- **Optional**
  - `XAI_MODEL` (default: `grok-4-latest`)
  - `BACKEND_BASE_URL` (default: `http://localhost:4201`)
  - `IMAGE_HOST` (default: `http://localhost:4203`)
  - `AVATAR_HOST` (default: `http://localhost:4202`)
  - `SIM_USER_COUNT` (default: `12`)
  - `SIM_EMAIL_PREFIX` (default: `sim`)
  - `SIM_EMAIL_DOMAIN` (default: `example.com`)
  - `SIM_PASSWORD` (default: `change-me`)
  - `SIM_SUBSCRIPTION_AMOUNTS` (default: `5,7,10,15,20,30,50`)

## Run

From repo root:

```bash
cd nonio-simulator
npm start
```

Useful modes:

```bash
# create/login users and set subscriptions, then exit
npm run bootstrap

# run exactly one activity tick, then exit
npm run once
```

### Scoping activity to a community

Pass `--community` to simulate activity only inside a specific community. The simulator will **not** create the community (it must already exist).

Examples:

```bash
# run simulator activity in @cats
npm start -- --community cats

# same, with @ prefix
npm start -- --community @cats

# bootstrap users/personas for a community
npm run bootstrap -- --community cats
```


