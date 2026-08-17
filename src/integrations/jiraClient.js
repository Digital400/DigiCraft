import { createBasicAuthHeader, httpRequest } from "./http.js";

export class JiraClient {
  constructor({ baseUrl, email, apiToken }) {
    if (!baseUrl || !email || !apiToken) {
      throw new Error("Jira credentials are incomplete. Check .env values.");
    }

    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.authHeader = createBasicAuthHeader(email, apiToken);
  }

  async testConnection() {
    const url = `${this.baseUrl}/rest/api/3/myself`;
    return httpRequest({
      url,
      headers: this.#headers()
    });
  }

  async listProjects() {
    const url = `${this.baseUrl}/rest/api/3/project/search?maxResults=100`;
    const data = await httpRequest({
      url,
      headers: this.#headers()
    });
    return data?.values || [];
  }

  async createIssue({ projectKey, issueTypeName, summary, description, parentKey }) {
    const payload = {
      fields: {
        project: { key: projectKey },
        summary,
        issuetype: { name: issueTypeName },
        description: {
          type: "doc",
          version: 1,
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: description || "" }]
            }
          ]
        }
      }
    };

    if (parentKey) {
      payload.fields.parent = { key: parentKey };
    }

    return httpRequest({
      url: `${this.baseUrl}/rest/api/3/issue`,
      method: "POST",
      headers: this.#headers(),
      body: payload
    });
  }

  async listFields() {
    const url = `${this.baseUrl}/rest/api/3/field`;
    return httpRequest({
      url,
      headers: this.#headers()
    });
  }

  async updateIssueFields(issueKey, fields) {
    const url = `${this.baseUrl}/rest/api/3/issue/${issueKey}`;
    return httpRequest({
      url,
      method: "PUT",
      headers: this.#headers(),
      body: { fields }
    });
  }

  async createIssueLink({ inwardIssueKey, outwardIssueKey, linkTypeName = "Relates" }) {
    const url = `${this.baseUrl}/rest/api/3/issueLink`;
    return httpRequest({
      url,
      method: "POST",
      headers: this.#headers(),
      body: {
        type: { name: linkTypeName },
        inwardIssue: { key: inwardIssueKey },
        outwardIssue: { key: outwardIssueKey }
      }
    });
  }

  async findEpicLinkFieldId() {
    const fields = await this.listFields();
    const exact = fields.find((field) => field.name === "Epic Link");
    if (exact?.id) {
      return exact.id;
    }

    const fallback = fields.find((field) =>
      typeof field.name === "string" && field.name.toLowerCase().includes("epic link")
    );
    return fallback?.id || null;
  }

  async createSprint({ boardId, name, goal, startDate, endDate }) {
    const url = `${this.baseUrl}/rest/agile/1.0/sprint`;
    return httpRequest({
      url,
      method: "POST",
      headers: this.#headers(),
      body: {
        name,
        goal,
        startDate,
        endDate,
        originBoardId: Number(boardId)
      }
    });
  }

  async startSprint({ sprintId, startDate, endDate }) {
    const url = `${this.baseUrl}/rest/agile/1.0/sprint/${sprintId}`;
    return httpRequest({
      url,
      method: "PUT",
      headers: this.#headers(),
      body: {
        state: "active",
        startDate,
        endDate
      }
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
