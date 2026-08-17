import { ConfluenceClient } from "../integrations/confluenceClient.js";

export class ConfluenceHldProvider {
  constructor(credentials, providerConfig) {
    this.client = new ConfluenceClient(credentials);
    this.providerConfig = providerConfig || {};
  }

  async testSetup() {
    await this.client.testConnection();
  }

  async getBlueprint() {
    const pageId = this.providerConfig.hldPageId;
    if (!pageId) {
      throw new Error("Confluence source requires source.confluence.hldPageId in config/default.config.json");
    }

    const page = await this.client.getPage(pageId);
    const title = page?.title || "Untitled HLD";
    const html = page?.body?.storage?.value || "";
    const sections = extractSections(html);
    const stories = sectionsToStories(sections, title);

    return {
      hldTitle: title,
      epics: [
        {
          title,
          description: `Generated from Confluence page ${pageId}`,
          stories
        }
      ]
    };
  }

  async getRawHldContext() {
    const pageId = this.providerConfig.hldPageId;
    if (!pageId) {
      throw new Error("Confluence source requires source.confluence.hldPageId in config/default.config.json");
    }

    const page = await this.client.getPage(pageId);
    const title = page?.title || "Untitled HLD";
    const html = page?.body?.storage?.value || "";
    const sections = extractSections(html);
    const text = sections
      .map((section) => `${section.heading}\n${section.points.join("\n")}`)
      .join("\n\n")
      .trim();

    return {
      title,
      text
    };
  }
}

function extractSections(html) {
  const text = html
    .replace(/<\/?h[1-6][^>]*>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&ndash;|&#8211;/g, "-")
    .replace(/&mdash;|&#8212;/g, "-")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\r/g, "")
    .replace(/\n{2,}/g, "\n")
    .trim();

  const lines = text
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .filter((line) => line.length >= 3);

  const sections = [];
  let currentSection = {
    heading: "Overview",
    points: []
  };

  for (const line of lines) {
    if (isLikelySectionHeading(line)) {
      if (currentSection.points.length > 0 || currentSection.heading !== "Overview") {
        sections.push(currentSection);
      }

      currentSection = {
        heading: cleanHeading(line),
        points: []
      };
      continue;
    }

    if (line.length >= 5) {
      currentSection.points.push(line);
    }
  }

  if (currentSection.points.length > 0 || currentSection.heading !== "Overview") {
    sections.push(currentSection);
  }

  return sections;
}

function sectionsToStories(sections, hldTitle) {
  const capabilities = extractCapabilities(sections);

  if (!capabilities.length) {
    return [
      {
        title: `As a team, we can implement ${hldTitle}`,
        description: `Derived from HLD: ${hldTitle}`,
        tasks: [
          "Review HLD details and extract user-facing capabilities",
          "Define acceptance criteria for first implementation slice",
          "Create implementation and test task breakdown"
        ]
      }
    ];
  }

  return capabilities.slice(0, 20).map((capability) => {
    const storyTitle = toUserStoryTitle(capability);
    return {
      title: storyTitle,
      description: `Derived from HLD capability: ${capability}`,
      tasks: buildCapabilityTasks(capability)
    };
  });
}

function extractCapabilities(sections) {
  const candidates = [];

  for (const section of sections) {
    for (const point of section.points || []) {
      const normalized = normalizeCapabilityCandidate(point);
      if (!normalized) {
        continue;
      }
      if (isCapabilityLine(normalized)) {
        candidates.push(normalized);
      }
    }
  }

  return dedupe(candidates);
}

function normalizeCapabilityCandidate(line) {
  const clean = line
    .replace(/^[-*]\s+/, "")
    .replace(/^\d+(\.\d+){0,3}\s+/, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!clean) {
    return "";
  }

  if (isMetadataLine(clean)) {
    return "";
  }

  return clean;
}

function isMetadataLine(line) {
  return /^(Version|Status|Architecture Style|Primary Views|Future Direction|Purpose|Scope)\s*:/i.test(line);
}

function isCapabilityLine(line) {
  if (line.length < 8 || line.length > 180) {
    return false;
  }

  if (/[?]$/.test(line)) {
    return false;
  }

  const verbs = [
    "create",
    "manage",
    "define",
    "import",
    "design",
    "configure",
    "generate",
    "search",
    "view",
    "review",
    "report",
    "ask",
    "export",
    "assign",
    "track",
    "update",
    "approve",
    "visualize"
  ];

  const startsWithVerb = verbs.some((verb) => new RegExp(`^${verb}\\b`, "i").test(line));
  const containsCan = /^as\s+/i.test(line) || /^the solution will provide/i.test(line);

  return startsWithVerb || containsCan;
}

function toUserStoryTitle(capability) {
  const action = capability.replace(/[.:]$/, "").trim();
  return `As a warehouse user, I want to ${lowercaseFirst(action)} so that warehouse planning and operations are improved`;
}

function buildCapabilityTasks(capability) {
  const short = capability.replace(/[.:]$/, "").trim();
  return [
    `Define acceptance criteria for: ${short}`,
    `Design UX and data validations for: ${short}`,
    `Implement API/domain logic for: ${short}`,
    `Add unit/integration tests and QA scenarios for: ${short}`
  ];
}

function lowercaseFirst(value) {
  if (!value) {
    return value;
  }
  return value.charAt(0).toLowerCase() + value.slice(1);
}

function isLikelySectionHeading(line) {
  const numbered = /^\d+(\.\d+){0,3}\s+.+/.test(line);
  const keyword = /^(Purpose|Scope|Architecture|Requirements|Functional Requirements|Non-Functional Requirements|Security|Deployment|Integration|Data Model|Risks|Assumptions|Constraints|Out of Scope|Future Direction)\b/i.test(line);
  const shortLine = line.length <= 90;
  const sentenceLike = /[.:]$/.test(line);
  return numbered || (keyword && shortLine) || (!sentenceLike && shortLine && /^[A-Z][A-Za-z0-9\s+\-()&/]+$/.test(line));
}

function cleanHeading(line) {
  return line.replace(/^\d+(\.\d+){0,3}\s*/, "").trim();
}

function dedupe(items) {
  const seen = new Set();
  const output = [];
  for (const item of items) {
    if (seen.has(item)) {
      continue;
    }
    seen.add(item);
    output.push(item);
  }
  return output;
}
