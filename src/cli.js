#!/usr/bin/env node

import { COMMANDS } from "./constants.js";
import { loadDotEnv } from "./utils/env.js";
import { loadConfig, getConfluenceCredentials, getJiraCredentials } from "./config.js";
import { buildHldProvider } from "./providers/hldProvider.js";
import { JiraClient } from "./integrations/jiraClient.js";
import { listJiraProjects, runSetup, runStoryCraftFlow } from "./usecases/storycraft.js";
import { printHeader } from "./utils/io.js";
import { pickAiProviderForRun } from "./usecases/aiSelection.js";
import { initProjectTemplates } from "./usecases/initProject.js";

async function main() {
  try {
    const command = process.argv[2] || COMMANDS.RUN;
    const forceInit = process.argv.includes("--force");

    if (command === COMMANDS.INIT) {
      const result = initProjectTemplates({ force: forceInit });
      printHeader("StoryCraft Project Init");
      console.log(`.env: ${result.env.status} (${result.env.path})`);
      console.log(`.env.example: ${result.envExample.status} (${result.envExample.path})`);
      console.log(`config/default.config.json: ${result.config.status} (${result.config.path})`);
      console.log("Use --force to overwrite existing files.");
      return;
    }

    loadDotEnv();
    const config = loadConfig();

    const jiraClient = new JiraClient(getJiraCredentials());
    const hldProvider = buildHldProvider(config, getConfluenceCredentials());

    printHeader(`${config.app.toolName} - ${config.app.company}`);

    if (command === COMMANDS.SETUP) {
      await runSetup({ hldProvider, jiraClient });
      return;
    }

    if (command === COMMANDS.PROJECTS) {
      const projects = await listJiraProjects(jiraClient);
      printHeader("Jira Projects (Spaces)");
      projects.forEach((project) => {
        console.log(`${project.key} - ${project.name}`);
      });
      return;
    }

    if (command === COMMANDS.DRY_RUN) {
      const aiRuntime = await pickAiProviderForRun(config);
      await runStoryCraftFlow({
        jiraClient,
        hldProvider,
        config,
        aiRuntime,
        dryRun: true
      });
      return;
    }

    if (command === COMMANDS.RUN) {
      const aiRuntime = await pickAiProviderForRun(config);
      await runStoryCraftFlow({
        jiraClient,
        hldProvider,
        config,
        aiRuntime,
        dryRun: false
      });
      return;
    }

    throw new Error(`Unsupported command: ${command}`);
  } catch (error) {
    console.error("Error:", error.message);
    process.exitCode = 1;
  }
}

main();
