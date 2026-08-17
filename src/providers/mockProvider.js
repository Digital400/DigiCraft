export class MockHldProvider {
  constructor(mockConfig) {
    this.mockConfig = mockConfig || {};
  }

  async testSetup() {
    return;
  }

  async getBlueprint() {
    const features = Array.isArray(this.mockConfig.features) ? this.mockConfig.features : [];

    return {
      hldTitle: this.mockConfig.hldTitle || "Sample HLD",
      epics: features.map((feature) => ({
        title: feature.title,
        description: feature.description || "",
        stories: (feature.stories || []).map((story) => ({
          title: story.title,
          description: story.description || "",
          tasks: story.tasks || []
        }))
      }))
    };
  }

  async getRawHldContext() {
    const blueprint = await this.getBlueprint();
    const lines = [];
    for (const epic of blueprint.epics || []) {
      lines.push(`Feature: ${epic.title}`);
      lines.push(epic.description || "");
      for (const story of epic.stories || []) {
        lines.push(`Story: ${story.title}`);
        for (const task of story.tasks || []) {
          lines.push(`- ${task}`);
        }
      }
    }

    return {
      title: blueprint.hldTitle,
      text: lines.join("\n")
    };
  }
}
