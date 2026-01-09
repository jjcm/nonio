export const config = {
  backendBaseUrl: process.env.BACKEND_BASE_URL || "http://localhost:4201",
  imageHost: process.env.IMAGE_HOST || "http://localhost:4203",
  avatarHost: process.env.AVATAR_HOST || "http://localhost:4202",

  xaiApiKey: process.env.XAI_API_KEY || "",
  xaiModel: process.env.XAI_MODEL || "grok-4-latest",

  falKey: process.env.FAL_KEY || "",

  userCount: parseInt(process.env.SIM_USER_COUNT || "12", 10),
  emailPrefix: process.env.SIM_EMAIL_PREFIX || "sim",
  emailDomain: process.env.SIM_EMAIL_DOMAIN || "example.com",
  password: process.env.SIM_PASSWORD || "change-me",
  subscriptionAmounts: (process.env.SIM_SUBSCRIPTION_AMOUNTS || "5,7,10,15,20,30,50")
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0),

  tickMs: 60_000
};

export function requireKeysForRun({ needFal = true } = {}) {
  if (!config.xaiApiKey) {
    throw new Error("Missing XAI_API_KEY");
  }
  if (needFal && !config.falKey) {
    throw new Error("Missing FAL_KEY");
  }
}


