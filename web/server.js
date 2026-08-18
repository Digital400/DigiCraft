#!/usr/bin/env node
// Standalone web preview for StoryCraft. Reuses src/ business logic read-only; does not modify CLI behavior.
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { fileURLToPath } from "node:url";

import { JiraClient } from "../src/integrations/jiraClient.js";
import { ConfluenceHldProvider } from "../src/providers/confluenceProvider.js";
import { runStoryCraftFlow } from "../src/usecases/storycraft.js";
import { pickAiProviderForRun } from "../src/usecases/aiSelection.js";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, "..");
const publicDir = path.join(currentDir, "public");
const defaultConfigPath = path.join(repoRoot, "config", "default.config.json");

const PORT = process.env.WEB_PREVIEW_PORT || 4000;

// In-memory session for this local preview process only (single user at a time).
let session = null;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8"
};

function loadBaseConfig() {
  const raw = fs.readFileSync(defaultConfigPath, "utf8");
  return JSON.parse(raw);
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(body);
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) {
    return {};
  }
  return JSON.parse(raw);
}

async function handleVerify(req, res) {
  const body = await readJsonBody(req);
  const {
    jiraBaseUrl,
    jiraEmail,
    jiraApiToken,
    confluenceBaseUrl,
    confluenceEmail,
    confluenceApiToken,
    confluenceSpaceKey,
    confluenceHldPageId
  } = body;

  const required = {
    jiraBaseUrl,
    jiraEmail,
    jiraApiToken,
    confluenceBaseUrl,
    confluenceEmail,
    confluenceApiToken,
    confluenceHldPageId
  };
  const missing = Object.entries(required)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    sendJson(res, 400, { ok: false, error: `Missing required fields: ${missing.join(", ")}` });
    return;
  }

  const config = loadBaseConfig();
  config.source.provider = "confluence";
  config.source.confluence.hldPageId = confluenceHldPageId;
  if (confluenceSpaceKey) {
    config.source.confluence.spaceKey = confluenceSpaceKey;
  }

  try {
    const jiraClient = new JiraClient({ baseUrl: jiraBaseUrl, email: jiraEmail, apiToken: jiraApiToken });
    const hldProvider = new ConfluenceHldProvider(
      { baseUrl: confluenceBaseUrl, email: confluenceEmail, apiToken: confluenceApiToken },
      config.source.confluence
    );

    await hldProvider.testSetup();
    const profile = await jiraClient.testConnection();
    const projects = await jiraClient.listProjects();

    session = { config, jiraClient, hldProvider };

    sendJson(res, 200, { ok: true, user: profile.displayName, projects });
  } catch (error) {
    sendJson(res, 400, { ok: false, error: error.message });
  }
}

async function handleGenerate(req, res) {
  if (!session) {
    sendJson(res, 400, { ok: false, error: "Confirm configuration before generating a preview." });
    return;
  }

  const { projectKey } = await readJsonBody(req);
  if (!projectKey) {
    sendJson(res, 400, { ok: false, error: "projectKey is required." });
    return;
  }

  const runConfig = {
    ...session.config,
    jira: { ...session.config.jira, defaultProjectKey: projectKey },
    ai: { ...session.config.ai, promptOnStart: false }
  };

  try {
    const aiRuntime = await pickAiProviderForRun(runConfig);
    const result = await runStoryCraftFlow({
      jiraClient: session.jiraClient,
      hldProvider: session.hldProvider,
      config: runConfig,
      aiRuntime,
      dryRun: true
    });
    sendJson(res, 200, { ok: true, result });
  } catch (error) {
    sendJson(res, 500, { ok: false, error: error.message });
  }
}

function serveStatic(req, res) {
  const requestedPath = req.url === "/" ? "/index.html" : req.url;
  const filePath = path.join(publicDir, path.normalize(requestedPath));

  if (!filePath.startsWith(publicDir)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { "Content-Type": MIME_TYPES[ext] || "application/octet-stream" });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "POST" && req.url === "/api/verify") {
      await handleVerify(req, res);
      return;
    }

    if (req.method === "POST" && req.url === "/api/generate") {
      await handleGenerate(req, res);
      return;
    }

    if (req.method === "GET") {
      serveStatic(req, res);
      return;
    }

    res.writeHead(404);
    res.end("Not found");
  } catch (error) {
    sendJson(res, 500, { ok: false, error: error.message });
  }
});

server.listen(PORT, () => {
  console.log(`StoryCraft web preview running at http://localhost:${PORT}`);
});
