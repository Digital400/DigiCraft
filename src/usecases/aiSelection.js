import { chooseFromList } from "../utils/io.js";

export function discoverConfiguredAiProviders(config) {
  const modelMap = config?.ai?.models || {};
  const providers = [];

  const openAiKey = normalizeKey(process.env.OPENAI_API_KEY);
  if (isOpenAiKey(openAiKey)) {
    providers.push({
      provider: "openai",
      label: "OpenAI",
      apiKey: openAiKey,
      model: modelMap.openai || "gpt-4.1-mini"
    });
  }

  const openRouterKey = normalizeKey(process.env.OPENROUTER_API_KEY);
  if (isOpenRouterKey(openRouterKey)) {
    providers.push({
      provider: "openrouter",
      label: "OpenRouter",
      apiKey: openRouterKey,
      model: modelMap.openrouter || "openai/gpt-4.1-mini"
    });
  }

  const anthropicKey = normalizeKey(process.env.ANTHROPIC_API_KEY);
  if (isAnthropicKey(anthropicKey)) {
    providers.push({
      provider: "anthropic",
      label: "Claude (Anthropic)",
      apiKey: anthropicKey,
      model: modelMap.anthropic || "claude-3-5-sonnet-latest"
    });
  }

  const githubToken = normalizeKey(process.env.GITHUB_TOKEN);
  if (isGitHubToken(githubToken)) {
    providers.push({
      provider: "github",
      label: "GitHub Models (Copilot-compatible)",
      apiKey: githubToken,
      model: modelMap.github || "gpt-4.1-mini"
    });
  }

  return providers;
}

export async function pickAiProviderForRun(config) {
  if (config?.ai?.enabled === false) {
    return null;
  }

  const providers = discoverConfiguredAiProviders(config);
  if (providers.length === 0) {
    return null;
  }

  if (!config?.ai?.promptOnStart) {
    const preferred = config?.ai?.provider;
    if (preferred && preferred !== "auto") {
      const match = providers.find((item) => item.provider === preferred);
      if (match) {
        return match;
      }
    }
    return providers[0];
  }

  const selectionItems = [
    ...providers,
    { provider: "none", label: "Run without AI", apiKey: "", model: "" }
  ];

  const selected = await chooseFromList(
    "AI Provider for this run",
    selectionItems,
    (item) => `${item.label}${item.model ? ` (${item.model})` : ""}`
  );

  if (selected.provider === "none") {
    return null;
  }

  return selected;
}

function normalizeKey(value) {
  if (typeof value !== "string") {
    return "";
  }

  const key = value.trim();
  if (!key) {
    return "";
  }

  const lower = key.toLowerCase();
  const placeholderHints = ["your_", "replace", "example", "token_here", "paste"];
  if (placeholderHints.some((hint) => lower.includes(hint))) {
    return "";
  }

  return key;
}

function isOpenAiKey(key) {
  if (!key) {
    return false;
  }

  // OpenRouter keys should not be used against OpenAI endpoint.
  if (key.startsWith("sk-or-v1") || key.startsWith("sk-or-")) {
    return false;
  }

  return key.startsWith("sk-");
}

function isOpenRouterKey(key) {
  if (!key) {
    return false;
  }
  return key.startsWith("sk-or-v1") || key.startsWith("sk-or-");
}

function isAnthropicKey(key) {
  if (!key) {
    return false;
  }
  return key.startsWith("sk-ant-");
}

function isGitHubToken(key) {
  if (!key) {
    return false;
  }
  return key.startsWith("github_pat_") || key.startsWith("ghp_") || key.length > 20;
}
