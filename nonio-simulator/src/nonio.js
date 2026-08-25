import { config } from "./config.js";
import { httpJson, httpForm } from "./http.js";

function authHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function register({ email, username, password }) {
  return await httpJson(`${config.backendBaseUrl}/user/register`, {
    method: "POST",
    body: { email, username, password }
  });
}

export async function login({ email, password }) {
  return await httpJson(`${config.backendBaseUrl}/user/login`, {
    method: "POST",
    body: { email, password }
  });
}

export async function tokenDetails({ token }) {
  return await httpJson(`${config.backendBaseUrl}/protected`, {
    method: "GET",
    headers: authHeaders(token)
  });
}

export async function setSubscription({ token, amount }) {
  return await httpJson(`${config.backendBaseUrl}/dev/user/set-subscription`, {
    method: "POST",
    headers: authHeaders(token),
    body: { amount }
  });
}

export async function updateDescription({ token, description }) {
  return await httpJson(`${config.backendBaseUrl}/user/update-description`, {
    method: "POST",
    headers: authHeaders(token),
    body: { description }
  });
}

export async function getCommunity({ community }) {
  const slug = String(community || "").replace(/^@/, "").trim();
  return await httpJson(`${config.backendBaseUrl}/communities/${encodeURIComponent(slug)}`, {
    method: "GET"
  });
}

export async function createCommunity({ token, name, url, description = "", privacyType = "public" }) {
  return await httpJson(`${config.backendBaseUrl}/community/create`, {
    method: "POST",
    headers: authHeaders(token),
    body: { name, url, description, privacyType }
  });
}

export async function getPosts({ time = "all", sort = "new", offset = 0, community = "" } = {}) {
  const params = new URLSearchParams();
  params.set("time", time);
  params.set("sort", sort);
  if (offset) params.set("offset", String(offset));
  if (community) params.set("community", community);
  return await httpJson(`${config.backendBaseUrl}/posts?${params.toString()}`);
}

export async function getComments({ postUrl, time = "all", sort = "top", community = "" } = {}) {
  const params = new URLSearchParams();
  params.set("post", postUrl);
  params.set("time", time);
  params.set("sort", sort);
  if (community) params.set("community", community);
  return await httpJson(`${config.backendBaseUrl}/comments?${params.toString()}`);
}

export async function createPost({ token, title, url, content, type, link = "", tags = [], community = "" }) {
  return await httpJson(`${config.backendBaseUrl}/post/create`, {
    method: "POST",
    headers: authHeaders(token),
    body: {
      title,
      url,
      link,
      content,
      type,
      width: 0,
      height: 0,
      tags,
      community
    }
  });
}

export async function createPostTag({ token, postUrl, tag, community = "" }) {
  return await httpJson(`${config.backendBaseUrl}/posttag/create`, {
    method: "POST",
    headers: authHeaders(token),
    body: { post: postUrl, tag, community }
  });
}

export async function addPostTagVote({ token, postUrl, tag, community = "" }) {
  return await httpJson(`${config.backendBaseUrl}/posttag/add-vote`, {
    method: "POST",
    headers: authHeaders(token),
    body: { post: postUrl, tag, community }
  });
}

export async function createComment({ token, postUrl, content, parentId = null, community = "" }) {
  return await httpJson(`${config.backendBaseUrl}/comment/create`, {
    method: "POST",
    headers: authHeaders(token),
    body: { post: postUrl, content, parent: parentId, community }
  });
}

export async function addCommentVote({ token, commentId, upvoted = true }) {
  return await httpJson(`${config.backendBaseUrl}/comment/add-vote`, {
    method: "POST",
    headers: authHeaders(token),
    body: { id: commentId, upvoted }
  });
}

export async function uploadImageToCdn({ token, urlSlug, bytes, contentType = "image/png" }) {
  const form = new FormData();
  form.append("url", urlSlug);
  form.append("files", new Blob([bytes], { type: contentType }), "image.png");

  const uploadUrl = `${config.imageHost}/upload`;
  const resText = await httpForm(uploadUrl, {
    headers: authHeaders(token),
    formData: form
  });

  // image-cdn returns plain text filename (url slug)
  return resText.replaceAll('"', "").trim();
}

export async function uploadAvatarToCdn({
  token,
  bytes,
  contentType = "image/png",
  crop: { xoffset = 0, yoffset = 0, size = 512 } = {}
}) {
  // Avatar CDN names the file based on token username; no url field needed.
  const form = new FormData();
  form.append("files", new Blob([bytes], { type: contentType }), "avatar.png");
  form.append("xoffset", String(Math.max(0, Math.floor(xoffset))));
  form.append("yoffset", String(Math.max(0, Math.floor(yoffset))));
  form.append("size", String(Math.max(32, Math.floor(size))));

  const uploadUrl = `${config.avatarHost}/upload`;
  const resText = await httpForm(uploadUrl, {
    headers: authHeaders(token),
    formData: form
  });

  return resText.replaceAll('"', "").trim();
}


