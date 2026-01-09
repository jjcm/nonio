import crypto from "node:crypto";
import { config, requireKeysForRun } from "./config.js";
import { loadState, saveState } from "./state.js";
import * as soci from "./soci.js";
import { grokJson } from "./grok.js";
import { downloadBytes, generateImage } from "./fal.js";
import { HttpError } from "./http.js";

const args = new Set(process.argv.slice(2));
const regenPersonas = args.has("--regen-personas");
const simCommunity = parseArgValue("--community");

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function slug(prefix = "p") {
  return `${prefix}-${crypto.randomBytes(6).toString("hex")}`;
}

function nonce() {
  return crypto.randomBytes(8).toString("hex");
}

function parseArgValue(flag) {
  // Supports: --flag=value OR --flag value
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === flag) return argv[i + 1] || "";
    if (a.startsWith(flag + "=")) return a.slice((flag + "=").length);
  }
  return "";
}

function normalizeCommunity(v) {
  const slug = String(v || "").trim();
  if (!slug) return "";
  return slug.replace(/^@/, "");
}

async function validateCommunity({ community }) {
  const slug = normalizeCommunity(community);
  if (!slug) return;
  try {
    await soci.getCommunity({ community: slug });
    return;
  } catch (e) {
    // Per requirements: simulator should NOT create communities.
    // We'll warn and let subsequent posting attempts fail with the backend's error if the community is missing/inaccessible.
    console.error(`[bootstrap] community validation failed for @${slug}:`, e?.message || e);
  }
}

async function bootstrapUsers(state) {
  const desired = config.userCount;
  while (state.users.length < desired) {
    const idx = state.users.length + 1;
    const username = `${config.emailPrefix}_${String(idx).padStart(3, "0")}`;
    const email = `${config.emailPrefix}+${String(idx).padStart(3, "0")}@${config.emailDomain}`;
    state.users.push({ email, username, token: "", persona: null, avatarSet: false, descriptionSet: false });
  }

  for (let i = 0; i < state.users.length; i++) {
    const u = state.users[i];
    // Validate any persisted token; if the user was deleted, token will 401 and we must re-login/register.
    if (u.token) {
      try {
        await soci.tokenDetails({ token: u.token });
      } catch (e) {
        if (e instanceof HttpError && e.status === 401) {
          u.token = "";
          u.avatarSet = false;
          u.descriptionSet = false;
        }
      }
      saveState(state);
    }

    if (!u.token) {
      // Prefer login if user exists; otherwise register.
      try {
        const login = await soci.login({ email: u.email, password: config.password });
        u.token = login.accessToken;
        console.log(`[bootstrap] logged in ${u.username}`);
      } catch {
        const reg = await soci.register({ email: u.email, username: u.username, password: config.password });
        u.token = reg.accessToken;
        console.log(`[bootstrap] registered ${u.username}`);
      }
      saveState(state);
    }

    // Validate the target community (once) if --community was provided.
    if (i === 0 && simCommunity) {
      await validateCommunity({ community: simCommunity });
    }

    // Set varying subscription amounts (dev-only endpoint)
    const amount = config.subscriptionAmounts[i % config.subscriptionAmounts.length];
    try {
      await soci.setSubscription({ token: u.token, amount });
      u.subscriptionAmount = amount;
    } catch (e) {
      // If dev tools aren't enabled, this will fail; simulator can still run activity.
      u.subscriptionAmount = amount;
    }
    saveState(state);

    // Persona + interests (once)
    if (regenPersonas) {
      u.persona = null;
      u.descriptionSet = false;
    }

    if (!u.persona) {
      requireKeysForRun({ needFal: false });
      const system = "Generate a distinct simulated user persona for a dev social site. Return ONLY JSON. No markdown.";
      const user =
        `Create a unique personality/background/interests profile for username "${u.username}".\n` +
        `Nonce: ${nonce()}\n` +
        `Return JSON with keys:\n` +
        `{"background":"...","personality":["..."],"interests":["..."],"writing_style":"...","avatar_prompt":"...","tag_preferences":["..."]}\n` +
        `Rules:\n` +
        `- Keep it safe/PG\n` +
        `- Make interests specific\n` +
        `- avatar_prompt should describe a portrait suitable for a circular avatar\n` +
        `- tag_preferences should be 5-12 lowercase tags (no spaces; use _)\n`;
      try {
        u.persona = await grokJson({ system, user, temperature: 0.9 });
      } catch (e) {
        console.error(`[bootstrap] grok persona failed for ${u.username}:`, e?.message || e);
        u.persona = {
          background: "night shift NOC engineer who sketches sci-fi worldbuilding on breaks",
          personality: ["dry humor", "curious", "helpful"],
          interests: ["networking", "sci_fi_art", "coffee", "linux", "urban_photography"],
          writing_style: "short, witty, slightly technical",
          avatar_prompt: "a clean stylized portrait of a person with short hair and glasses, soft rim lighting, solid background, modern minimal illustration, centered face",
          tag_preferences: ["linux", "coffee", "sci_fi", "networks", "photography"]
        };
      }
      saveState(state);
    }

    // Write persona into profile description (once)
    if (!u.descriptionSet) {
      const p = u.persona || {};
      const lines = [
        p.background ? `Background: ${String(p.background).trim()}` : "",
        Array.isArray(p.personality) ? `Personality: ${p.personality.map(String).join(", ")}` : "",
        Array.isArray(p.interests) ? `Interests: ${p.interests.map(String).join(", ")}` : "",
        p.writing_style ? `Writing style: ${String(p.writing_style)}` : ""
      ].filter(Boolean);
      const description = lines.join("\n");
      try {
        await soci.updateDescription({ token: u.token, description });
        u.descriptionSet = true;
      } catch {
        // ignore
      }
      saveState(state);
    }

    // Avatar upload (once) - stored by username in avatar-cdn
    if (!u.avatarSet) {
      requireKeysForRun({ needFal: true });
      const prompt = String(u.persona?.avatar_prompt || "a clean friendly portrait illustration, centered, solid background, high quality");
      try {
        const img = await generateImage({ prompt });
        const { bytes, contentType } = await downloadBytes(img.url);
        const cropSize = Math.min(512, img.width || 512, img.height || 512);
        const xoffset = Math.max(0, Math.floor(((img.width || cropSize) - cropSize) / 2));
        const yoffset = Math.max(0, Math.floor(((img.height || cropSize) - cropSize) / 2));
        await soci.uploadAvatarToCdn({ token: u.token, bytes, contentType, crop: { xoffset, yoffset, size: cropSize } });
        u.avatarSet = true;
      } catch {
        // ignore; can retry later
      }
      saveState(state);
    }
  }

  return state;
}

async function chooseAndRunTick(state) {
  const actor = pick(state.users);
  const roll = Math.random();
  const isPost = roll < 0.05;

  const postsData = await soci.getPosts({
    time: "all",
    sort: "new",
    offset: 0,
    community: simCommunity ? `@${normalizeCommunity(simCommunity)}` : ""
  });
  const posts = postsData?.posts || [];

  if (isPost || posts.length < 3) {
    await doPostAction(actor, posts);
  } else {
    await doInteractAction(actor, posts);
  }
}

async function doPostAction(actor, posts) {
  requireKeysForRun({ needFal: true });

  const system =
    "You are controlling a dev activity simulator for a link/blog/image site. " +
    "Return ONLY JSON. No markdown.";

  const interests = Array.isArray(actor.persona?.interests) ? actor.persona.interests.map(String).slice(0, 8) : [];
  const style = actor.persona?.writing_style ? String(actor.persona.writing_style) : "";

  const user =
    `Create a new post. Choose either:\n` +
    `- type "blog" with a blog/rant/joke in plain text\n` +
    `- type "image" with an image generation prompt\n\n` +
    `Rules:\n` +
    `- Title must be short (<=80 chars)\n` +
    `- For blog content/description, you MAY use light markdown for emphasis (e.g. *italics*, **bold**, short lists, \`inline code\`) when it makes sense, but don't overdo it (aim for helpful reddit-comment formatting)\n` +
    `- Provide 2-5 simple lowercase tags\n` +
    `- Avoid slurs/sexual content\n` +
    (interests.length ? `- Prefer topics aligned with this user's interests: ${interests.join(", ")}\n` : "") +
    (style ? `- Writing style: ${style}\n` : "") +
    `- Nonce: ${nonce()}\n` +
    `\n` +
    `Recent posts (for variety, don't duplicate titles):\n` +
    JSON.stringify(
      posts.slice(0, 8).map((p) => ({ title: p.title, url: p.url, type: p.type, tags: (p.tags || []).slice(0, 5) }))
    ) +
    `\n\nReturn JSON like:\n` +
    `{"type":"blog","title":"...","content":"...","tags":["tag1","tag2"]}\n` +
    `or\n` +
    `{"type":"image","title":"...","description":"...","image_prompt":"...","tags":["tag1","tag2"]}`;

  let plan;
  try {
    plan = await grokJson({ system, user, temperature: 0.9 });
  } catch (e) {
    console.error(`[tick] grok post-plan failed for ${actor.username}:`, e?.message || e);
    plan = { type: "blog", title: "a small dev rant", content: "why do bugs only appear after lunch?", tags: ["dev", "rant"] };
  }

  const type = plan.type === "image" ? "image" : "blog";
  const title = String(plan.title || "untitled").slice(0, 80);
  const tags = Array.isArray(plan.tags) ? plan.tags.map((t) => String(t).toLowerCase().replace(/[^a-z0-9_-]/g, "")).filter(Boolean).slice(0, 5) : [];

  if (type === "blog") {
    const content = String(plan.content || plan.description || "").slice(0, 4000);
    const url = slug("blog");
    const created = await soci.createPost({
      token: actor.token,
      title,
      url,
      content,
      type: "blog",
      tags,
      community: simCommunity ? `@${normalizeCommunity(simCommunity)}` : ""
    });
    console.log(`[tick] ${actor.username} posted blog /${created.url || url}`);
    return;
  }

  const imagePrompt = String(plan.image_prompt || "a cinematic photograph of a cozy desk setup, warm lighting, shallow depth of field");
  const description = String(plan.description || "").slice(0, 2000);
  const img = await generateImage({ prompt: imagePrompt });
  const { bytes, contentType } = await downloadBytes(img.url);

  const url = slug("img");
  await soci.uploadImageToCdn({ token: actor.token, urlSlug: url, bytes, contentType });
  const created = await soci.createPost({
    token: actor.token,
    title,
    url,
    content: description,
    type: "image",
    tags,
    community: simCommunity ? `@${normalizeCommunity(simCommunity)}` : ""
  });
  console.log(`[tick] ${actor.username} posted image /${created.url || url}`);
}

async function doInteractAction(actor, posts) {
  requireKeysForRun({ needFal: false });

  const target = pick(posts.slice(0, 30));
  const tags = Array.isArray(target.tags) ? target.tags : [];
  const community = simCommunity ? `@${normalizeCommunity(simCommunity)}` : (target.community || target.communityURL || "");

  const system =
    "You are controlling a dev activity simulator. Return ONLY JSON. No markdown.";

  const prefs = Array.isArray(actor.persona?.tag_preferences) ? actor.persona.tag_preferences.map(String).slice(0, 12) : [];

  const user =
    `Pick one interaction for this user on the target post.\n\n` +
    `Target post:\n` +
    JSON.stringify({
      url: target.url,
      title: target.title,
      type: target.type,
      tags: tags.map((t) => (typeof t === "string" ? t : t.tag)).slice(0, 12)
    }) +
    `\n\nYou can do one of:\n` +
    `- upvote an existing tag (tag_action="upvote", tag="existing")\n` +
    `- add a new tag (tag_action="create", tag="new")\n\n` +
    (prefs.length ? `Tag preferences for this user: ${prefs.join(", ")}\n\n` : "") +
    `Also decide whether to read comments: read_comments true/false.\n\n` +
    `Return JSON like:\n` +
    `{"tag_action":"upvote","tag":"ai","read_comments":true}\n` +
    `or\n` +
    `{"tag_action":"create","tag":"spicy_take","read_comments":false}`;

  let plan;
  try {
    plan = await grokJson({ system, user, temperature: 0.6 });
  } catch {
    console.error(`[tick] grok interact-plan failed for ${actor.username}:`, e?.message || e);
    plan = { tag_action: tags.length ? "upvote" : "create", tag: tags.length ? (tags[0].tag || tags[0]) : "interesting", read_comments: Math.random() < 0.3 };
  }

  const tag = String(plan.tag || "interesting").toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 24);
  const readComments = plan.read_comments === true || (plan.read_comments !== false && Math.random() < 0.3);

  // Ensure the tag exists on the post, then vote for it.
  if (plan.tag_action === "create") {
    try {
      await soci.createPostTag({ token: actor.token, postUrl: target.url, tag, community });
      console.log(`[tick] ${actor.username} added tag "${tag}" on /${target.url}`);
    } catch (e) {
      // If tag already exists, fall back to upvote.
      await soci.addPostTagVote({ token: actor.token, postUrl: target.url, tag, community });
      console.log(`[tick] ${actor.username} upvoted tag "${tag}" on /${target.url}`);
    }
  } else {
    // If tag isn't on the post yet, create it first (so upvote works).
    try {
      await soci.addPostTagVote({ token: actor.token, postUrl: target.url, tag, community });
      console.log(`[tick] ${actor.username} upvoted tag "${tag}" on /${target.url}`);
    } catch (e) {
      await soci.createPostTag({ token: actor.token, postUrl: target.url, tag, community });
      console.log(`[tick] ${actor.username} added+voted tag "${tag}" on /${target.url}`);
    }
  }

  if (!readComments) return;

  const commentsData = await soci.getComments({ postUrl: target.url, time: "all", sort: "top", community });
  const comments = commentsData?.comments || [];
  if (!comments.length) {
    // If there are no comments yet, bots should be able to start a thread with a top-level comment.
    if (Math.random() >= 0.3) return;

    const system0 = "You are writing a top-level comment on a post in a dev activity simulator. Return ONLY JSON. No markdown.";
    const user0 =
      `Write a helpful/funny top-level comment on this post.\n` +
      `You MAY use light markdown for emphasis (\`inline code\`, *italics*, **bold**, short lists) but keep it subtle (helpful reddit-comment formatting).\n\n` +
      `Post:\n` +
      JSON.stringify({
        url: target.url,
        title: target.title,
        type: target.type,
        tags: tags.map((t) => (typeof t === "string" ? t : t.tag)).slice(0, 12)
      }) +
      `\n\nReturn JSON like: {"content":"..."}\n` +
      `Nonce: ${nonce()}`;

    try {
      const plan0 = await grokJson({ system: system0, user: user0, temperature: 0.7 });
      const content0 = String(plan0?.content || "").trim().slice(0, 800);
      if (content0) {
        await soci.createComment({ token: actor.token, postUrl: target.url, parentId: null, content: content0, community });
        console.log(`[tick] ${actor.username} commented (top-level) on /${target.url}`);
      }
    } catch (e) {
      console.error(`[tick] grok top-level-comment failed for ${actor.username}:`, e?.message || e);
    }

    return;
  }

  // Ask Grok which comments are "interesting" to upvote and whether to reply.
  const system2 = "You are choosing comment interactions. Return ONLY JSON. No markdown.";
  const user2 =
    `Given these comments, choose 0-3 to upvote (by id), and optionally reply to one (parent_id + content).\n\n` +
    `If you reply, you MAY use light markdown for emphasis (\`inline code\`, *italics*, **bold**, short lists) but keep it subtle (helpful reddit-comment formatting).\n\n` +
    `You may ALSO optionally leave a new top-level comment (new_comment.content).\n\n` +
    `Comments:\n` +
    JSON.stringify(
      comments.slice(0, 12).map((c) => ({
        id: c.ID || c.id,
        author: c.author || c.authorName || c.author_id,
        content: String(c.content || "").slice(0, 200)
      }))
    ) +
    `\n\nReturn JSON like:\n` +
    `{"upvote_ids":[1,2],"reply":{"parent_id":2,"content":"..."}}\n` +
    `or {"upvote_ids":[3]} or {"upvote_ids":[]}\n` +
    `or {"upvote_ids":[1],"new_comment":{"content":"..."}}`;

  let plan2;
  try {
    plan2 = await grokJson({ system: system2, user: user2, temperature: 0.7 });
  } catch {
    console.error(`[tick] grok comment-plan failed for ${actor.username}:`, e?.message || e);
    plan2 = { upvote_ids: [comments[0].ID || comments[0].id].filter(Boolean) };
  }

  const upvoteIds = Array.isArray(plan2.upvote_ids) ? plan2.upvote_ids.slice(0, 3).filter((n) => Number.isFinite(n)) : [];
  for (const id of upvoteIds) {
    try {
      await soci.addCommentVote({ token: actor.token, commentId: id, upvoted: true });
      console.log(`[tick] ${actor.username} upvoted comment ${id} on /${target.url}`);
    } catch {
      // ignore
    }
  }

  if (plan2.new_comment && String(plan2.new_comment.content || "").trim()) {
    try {
      await soci.createComment({
        token: actor.token,
        postUrl: target.url,
        parentId: null,
        content: String(plan2.new_comment.content).slice(0, 800),
        community
      });
      console.log(`[tick] ${actor.username} commented (top-level) on /${target.url}`);
    } catch {
      // ignore
    }
  }

  if (plan2.reply && Number.isFinite(plan2.reply.parent_id) && String(plan2.reply.content || "").trim()) {
    try {
      await soci.createComment({
        token: actor.token,
        postUrl: target.url,
        parentId: plan2.reply.parent_id,
        content: String(plan2.reply.content).slice(0, 800),
        community
      });
      console.log(`[tick] ${actor.username} replied to comment ${plan2.reply.parent_id} on /${target.url}`);
    } catch {
      // ignore
    }
  }
}

async function main() {
  const state = await bootstrapUsers(loadState());

  if (args.has("--bootstrap-only")) {
    console.log("[bootstrap] done");
    return;
  }

  const runOnce = args.has("--once");

  do {
    try {
      await chooseAndRunTick(state);
    } catch (e) {
      console.error("[tick] error:", e?.message || e);
    }
    saveState(state);
    if (runOnce) break;
    await sleep(config.tickMs);
  } while (true);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


