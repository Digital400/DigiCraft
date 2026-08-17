import fs from "node:fs";
import path from "node:path";
import { DEFAULT_CONFIG_PATH } from "./constants.js";

export function loadConfig(configPath = DEFAULT_CONFIG_PATH) {
  const fullPath = path.resolve(process.cwd(), configPath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Config file not found: ${fullPath}`);
  }

  const raw = fs.readFileSync(fullPath, "utf8");
  const config = JSON.parse(raw);

  validateConfig(config);
  return config;
}

function validateConfig(config) {
  if (!config?.source?.provider) {
    throw new Error("Invalid config: source.provider is required.");
  }
  if (!config?.jira?.issueTypes?.epic || !config?.jira?.issueTypes?.story || !config?.jira?.issueTypes?.task) {
    throw new Error("Invalid config: jira.issueTypes.epic/story/task are required.");
  }

  const epicToStoryMode = config?.jira?.linking?.epicToStoryMode;
  if (epicToStoryMode && !["auto", "issueLink", "none"].includes(epicToStoryMode)) {
    throw new Error("Invalid config: jira.linking.epicToStoryMode must be auto, issueLink, or none.");
  }

  const taskToStoryMode = config?.jira?.linking?.taskToStoryMode;
  if (taskToStoryMode && !["subTask", "issueLink", "none"].includes(taskToStoryMode)) {
    throw new Error("Invalid config: jira.linking.taskToStoryMode must be subTask, issueLink, or none.");
  }

  const aiProvider = config?.ai?.provider;
  if (aiProvider && !["auto", "openai", "openrouter", "anthropic", "github"].includes(aiProvider)) {
    throw new Error("Invalid config: ai.provider must be auto, openai, openrouter, anthropic, or github.");
  }
}

export function getJiraCredentials() {
  return {
    baseUrl: process.env.JIRA_BASE_URL,
    email: process.env.JIRA_EMAIL,
    apiToken: process.env.JIRA_API_TOKEN
  };
}

export function getConfluenceCredentials() {
  return {
    baseUrl: process.env.CONFLUENCE_BASE_URL,
    email: process.env.CONFLUENCE_EMAIL,
    apiToken: process.env.CONFLUENCE_API_TOKEN
  };
}
