import { config } from "./config.js";
import { httpJson } from "./http.js";

export async function grokJson({ system, user, temperature = 0.7 }) {
  const modelsToTry = [config.xaiModel, "grok-4-latest", "grok-2-latest"].filter((m, i, a) => a.indexOf(m) === i);
  let lastErr;

  for (const model of modelsToTry) {
    try {
      const data = await httpJson("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.xaiApiKey}`
        },
        body: {
          model,
          temperature,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user }
          ]
        }
      });

      const text = data?.choices?.[0]?.message?.content;
      if (!text) {
        throw new Error(`Grok response missing choices[0].message.content: ${JSON.stringify(data).slice(0, 400)}`);
      }
      return extractJson(text);
    } catch (e) {
      lastErr = e;
      // If it's a model-not-found style error, try the next model.
      // Otherwise, fail fast (auth/rate-limit/etc should be fixed rather than retried blindly).
      const msg = String(e?.message || "");
      if (msg.includes("does not exist") || msg.includes("model") && msg.includes("does not have access") || msg.includes("404 Not Found")) {
        continue;
      }
      throw e;
    }
  }

  throw lastErr || new Error("Grok request failed");
}

function extractJson(text) {
  const trimmed = String(text).trim();
  // Best case: pure JSON
  try {
    return JSON.parse(trimmed);
  } catch {
    // Try to find first JSON object in the string
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      const slice = trimmed.slice(start, end + 1);
      return JSON.parse(slice);
    }
    throw new Error(`Grok did not return JSON. Got: ${trimmed.slice(0, 400)}`);
  }
}


