import { createBasicAuthHeader, httpRequest } from "./http.js";

export class ConfluenceClient {
  constructor({ baseUrl, email, apiToken }) {
    if (!baseUrl || !email || !apiToken) {
      throw new Error("Confluence credentials are incomplete. Check .env values.");
    }

    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.authHeader = createBasicAuthHeader(email, apiToken);
  }

  async testConnection() {
    const url = `${this.baseUrl}/rest/api/space?limit=1`;
    return httpRequest({
      url,
      headers: this.#headers()
    });
  }

  async getPage(pageId) {
    if (!pageId) {
      throw new Error("Confluence pageId is required.");
    }

    const url = `${this.baseUrl}/rest/api/content/${pageId}?expand=body.storage,title`;
    return httpRequest({
      url,
      headers: this.#headers()
    });
  }

  #headers() {
    return {
      Authorization: this.authHeader,
      Accept: "application/json",
      "Content-Type": "application/json"
    };
  }
}
