import fs from "node:fs";
import path from "node:path";

const STATE_PATH = path.join(process.cwd(), ".sim-state.json");

export function loadState() {
  try {
    const raw = fs.readFileSync(STATE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return { users: [] };
    if (!Array.isArray(parsed.users)) parsed.users = [];
    return parsed;
  } catch {
    return { users: [] };
  }
}

export function saveState(state) {
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2) + "\n", "utf8");
}


