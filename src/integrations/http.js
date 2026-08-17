export async function httpRequest({ url, method = "GET", headers = {}, body }) {
  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    const message = extractErrorMessage(data) || response.statusText;
    throw new Error(`HTTP ${response.status} ${method} ${url}: ${message}`);
  }

  return data;
}

function extractErrorMessage(data) {
  if (!data) {
    return "";
  }

  if (typeof data === "string") {
    return data;
  }

  if (Array.isArray(data?.errorMessages) && data.errorMessages.length > 0) {
    return data.errorMessages.join("; ");
  }

  if (typeof data?.message === "string" && data.message.trim()) {
    return data.message;
  }

  if (typeof data?.error?.message === "string" && data.error.message.trim()) {
    return data.error.message;
  }

  if (typeof data?.error === "string" && data.error.trim()) {
    return data.error;
  }

  try {
    return JSON.stringify(data);
  } catch {
    return "";
  }
}

export function createBasicAuthHeader(email, apiToken) {
  if (!email || !apiToken) {
    throw new Error("Missing email or API token for basic auth.");
  }

  const encoded = Buffer.from(`${email}:${apiToken}`).toString("base64");
  return `Basic ${encoded}`;
}
