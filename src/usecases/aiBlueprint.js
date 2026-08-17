import { generateBlueprintWithAi } from "../integrations/aiClient.js";

export async function buildBlueprint({ hldProvider, aiRuntime, maxInputChars = 16000 }) {
  const heuristicBlueprint = await hldProvider.getBlueprint();

  if (!aiRuntime) {
    return {
      blueprint: heuristicBlueprint,
      source: "heuristic"
    };
  }

  const raw = await getRawInputForAi(hldProvider, heuristicBlueprint);
  const compactText = raw.text.slice(0, maxInputChars);

  let aiBlueprint;
  try {
    aiBlueprint = await generateBlueprintWithAi({
      provider: aiRuntime.provider,
      apiKey: aiRuntime.apiKey,
      model: aiRuntime.model,
      hldTitle: raw.title,
      hldText: compactText
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const hint = buildAiFailureHint(aiRuntime.provider, message);
    console.warn(`AI generation failed (${aiRuntime.provider}). Falling back to heuristic mode. Reason: ${message}${hint}`);
    return {
      blueprint: heuristicBlueprint,
      source: "heuristic-fallback"
    };
  }

  return {
    blueprint: normalizeBlueprint(aiBlueprint, heuristicBlueprint.hldTitle),
    source: `ai:${aiRuntime.provider}`
  };
}

function buildAiFailureHint(provider, message) {
  if (provider === "openrouter" && /HTTP 402/i.test(message)) {
    return " | Hint: OpenRouter returned 402 (usually insufficient credits or billing not enabled for selected model).";
  }
  return "";
}

async function getRawInputForAi(hldProvider, heuristicBlueprint) {
  if (typeof hldProvider.getRawHldContext === "function") {
    return hldProvider.getRawHldContext();
  }

  const storyLines = [];
  for (const epic of heuristicBlueprint.epics || []) {
    storyLines.push(`Epic: ${epic.title}`);
    for (const story of epic.stories || []) {
      storyLines.push(`Story: ${story.title}`);
      for (const task of story.tasks || []) {
        storyLines.push(`Task: ${task}`);
      }
    }
  }

  return {
    title: heuristicBlueprint.hldTitle,
    text: storyLines.join("\n")
  };
}

function normalizeBlueprint(blueprint, fallbackTitle) {
  return {
    hldTitle: String(blueprint.hldTitle || fallbackTitle || "HLD").trim(),
    epics: (blueprint.epics || []).map((epic) => ({
      title: String(epic.title || "Untitled Epic").trim(),
      description: String(epic.description || "").trim(),
      stories: (epic.stories || []).map((story) => ({
        title: String(story.title || "Untitled Story").trim(),
        description: String(story.description || "").trim(),
        tasks: (story.tasks || [])
          .map((task) => String(task || "").trim())
          .filter(Boolean)
      }))
    }))
  };
}
