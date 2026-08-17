import { httpRequest } from "./http.js";

export async function generateBlueprintWithAi({ provider, apiKey, model, hldTitle, hldText }) {
  const prompt = buildPrompt({ hldTitle, hldText });

  if (provider === "openai") {
    const data = await httpRequest({
      url: "https://api.openai.com/v1/chat/completions",
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: {
        model,
        temperature: 0.2,
        messages: [
          { role: "system", content: "You are an expert agile analyst. Return only valid JSON." },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" }
      }
    });

    const content = data?.choices?.[0]?.message?.content;
    return parseBlueprintJson(content);
  }

  if (provider === "openrouter") {
    const data = await httpRequest({
      url: "https://openrouter.ai/api/v1/chat/completions",
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: {
        model,
        temperature: 0.2,
        messages: [
          { role: "system", content: "You are an expert agile analyst. Return only valid JSON." },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" }
      }
    });

    const content = data?.choices?.[0]?.message?.content;
    return parseBlueprintJson(content);
  }

  if (provider === "anthropic") {
    const data = await httpRequest({
      url: "https://api.anthropic.com/v1/messages",
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json"
      },
      body: {
        model,
        max_tokens: 4000,
        temperature: 0.2,
        system: "You are an expert agile analyst. Return only valid JSON.",
        messages: [{ role: "user", content: prompt }]
      }
    });

    const contentBlock = data?.content?.find((part) => part.type === "text");
    return parseBlueprintJson(contentBlock?.text);
  }

  if (provider === "github") {
    const data = await httpRequest({
      url: "https://models.inference.ai.azure.com/chat/completions",
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: {
        model,
        temperature: 0.2,
        messages: [
          { role: "system", content: "You are an expert agile analyst. Return only valid JSON." },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" }
      }
    });

    const content = data?.choices?.[0]?.message?.content;
    return parseBlueprintJson(content);
  }

  throw new Error(`Unsupported AI provider: ${provider}`);
}

function buildPrompt({ hldTitle, hldText }) {
  return [
    "Convert this HLD into Jira-ready backlog.",
    "Return STRICT JSON with this shape:",
    '{"hldTitle":"...","epics":[{"title":"...","description":"...","stories":[{"title":"...","description":"...","tasks":["...","..."]}]}]}',
    "Rules:",
    "1) Use multiple epics if needed.",
    "2) Create clear user-value stories, not section-title stories.",
    "3) Tasks must be concrete engineering actions.",
    "4) Do not include markdown, only JSON.",
    "5) Avoid duplicates.",
    `HLD Title: ${hldTitle}`,
    "HLD Content:",
    hldText
  ].join("\n");
}

function parseBlueprintJson(content) {
  if (!content) {
    throw new Error("AI returned empty response.");
  }

  const cleaned = content
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  const parsed = JSON.parse(cleaned);
  validateBlueprint(parsed);
  return parsed;
}

function validateBlueprint(blueprint) {
  if (!blueprint || typeof blueprint !== "object") {
    throw new Error("AI blueprint is not an object.");
  }
  if (!Array.isArray(blueprint.epics) || blueprint.epics.length === 0) {
    throw new Error("AI blueprint must contain at least one epic.");
  }

  for (const epic of blueprint.epics) {
    if (!epic.title || !Array.isArray(epic.stories)) {
      throw new Error("AI epic must contain title and stories.");
    }
    for (const story of epic.stories) {
      if (!story.title || !Array.isArray(story.tasks)) {
        throw new Error("AI story must contain title and tasks.");
      }
    }
  }
}
