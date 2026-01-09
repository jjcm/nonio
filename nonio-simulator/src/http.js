export class HttpError extends Error {
  constructor({ method, url, status, statusText, data }) {
    const msg = typeof data === "string" ? data : JSON.stringify(data);
    super(`${method} ${url} -> ${status} ${statusText}: ${msg}`);
    this.name = "HttpError";
    this.method = method;
    this.url = url;
    this.status = status;
    this.statusText = statusText;
    this.data = data;
  }
}

export async function httpJson(url, { method = "GET", headers = {}, body } = {}) {
  const res = await fetch(url, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...headers
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    throw new HttpError({ method, url, status: res.status, statusText: res.statusText, data });
  }
  return data;
}

export async function httpForm(url, { method = "POST", headers = {}, formData } = {}) {
  const res = await fetch(url, { method, headers, body: formData });
  const text = await res.text();
  if (!res.ok) {
    throw new HttpError({ method, url, status: res.status, statusText: res.statusText, data: text });
  }
  return text;
}


