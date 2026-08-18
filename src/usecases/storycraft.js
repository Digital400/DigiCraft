import { chooseFromList, printHeader } from "../utils/io.js";
import { buildBlueprint } from "./aiBlueprint.js";

export async function runSetup({ hldProvider, jiraClient }) {
  printHeader("1) Checking Confluence setup");
  await hldProvider.testSetup();
  console.log("Confluence/source setup is valid.");

  printHeader("2) Checking Jira setup");
  const profile = await jiraClient.testConnection();
  console.log(`Jira setup is valid. Connected as: ${profile.displayName}`);
}

export async function listJiraProjects(jiraClient) {
  const projects = await jiraClient.listProjects();
  if (projects.length === 0) {
    throw new Error("No Jira projects found for this account.");
  }
  return projects;
}

export async function selectJiraProject(jiraClient, defaultProjectKey) {
  const projects = await listJiraProjects(jiraClient);

  if (defaultProjectKey) {
    const match = projects.find((project) => project.key === defaultProjectKey);
    if (match) {
      console.log(`Using default Jira project from config: ${match.key} - ${match.name}`);
      return match;
    }
  }

  return chooseFromList(
    "Available Jira Projects (Spaces)",
    projects,
    (project) => `${project.key} - ${project.name}`
  );
}

export async function runStoryCraftFlow({
  jiraClient,
  hldProvider,
  config,
  aiRuntime = null,
  dryRun = false
}) {
  const selectedProject = await selectJiraProject(jiraClient, config?.jira?.defaultProjectKey);
  const maxInputChars = config?.ai?.maxInputChars || 16000;
  const blueprintResult = await buildBlueprint({
    hldProvider,
    aiRuntime,
    maxInputChars
  });
  const blueprint = blueprintResult.blueprint;

  printHeader("Blueprint Summary");
  console.log(`HLD: ${blueprint.hldTitle}`);
  console.log(`Blueprint source: ${blueprintResult.source}`);
  console.log(`Epics to create: ${blueprint.epics.length}`);

  const created = await createIssuesFromBlueprint({
    jiraClient,
    config,
    blueprint,
    projectKey: selectedProject.key,
    dryRun
  });

  return {
    project: selectedProject,
    blueprint,
    blueprintSource: blueprintResult.source,
    created
  };
}

// Shared by CLI (runStoryCraftFlow) and the web preview approve step, so an
// approved preview creates exactly the blueprint that was shown to the user.
export async function createIssuesFromBlueprint({ jiraClient, config, blueprint, projectKey, dryRun = false }) {
  const created = {
    epics: [],
    stories: [],
    tasks: []
  };

  for (const [epicIndex, epic] of blueprint.epics.entries()) {
    if (dryRun) {
      console.log(`[DRY-RUN] Epic: ${epic.title}`);
      created.epics.push({ key: `DRY-EPIC-${epicIndex}`, title: epic.title });
    } else {
      const epicIssue = await jiraClient.createIssue({
        projectKey,
        issueTypeName: config.jira.issueTypes.epic,
        summary: epic.title,
        description: epic.description || `Epic generated from HLD ${blueprint.hldTitle}`
      });
      console.log(`Created Epic: ${epicIssue.key} - ${epic.title}`);
      created.epics.push({ key: epicIssue.key, title: epic.title });
    }

    const parentEpicKey = created.epics[created.epics.length - 1].key;

    for (const [storyIndex, story] of (epic.stories || []).entries()) {
      if (dryRun) {
        console.log(`  [DRY-RUN] Story: ${story.title}`);
        created.stories.push({ key: `DRY-STORY-${epicIndex}-${storyIndex}`, title: story.title, parentKey: parentEpicKey });
      } else {
        const storyIssue = await createStoryUnderEpic({
          jiraClient,
          projectKey,
          storyIssueTypeName: config.jira.issueTypes.story,
          story,
          parentEpicKey,
          linkingConfig: config?.jira?.linking || {}
        });

        console.log(`  Created Story: ${storyIssue.key} - ${story.title}`);
        created.stories.push({ key: storyIssue.key, title: story.title, parentKey: parentEpicKey });
      }

      const parentStoryKey = created.stories[created.stories.length - 1].key;

      for (const taskName of story.tasks || []) {
        if (dryRun) {
          console.log(`    [DRY-RUN] Task: ${taskName}`);
          created.tasks.push({ key: "DRY-TASK", title: taskName, parentKey: parentStoryKey });
          continue;
        }

        const taskIssue = await createTaskUnderStory({
          jiraClient,
          projectKey,
          taskIssueTypeName: config.jira.issueTypes.task,
          subTaskIssueTypeName: config?.jira?.issueTypes?.subTask,
          taskName,
          parentStoryKey,
          linkingConfig: config?.jira?.linking || {}
        });

        console.log(`    Created Task: ${taskIssue.key} - ${taskName}`);
        created.tasks.push({ key: taskIssue.key, title: taskName, parentKey: parentStoryKey });
      }
    }
  }

  if (!dryRun && config?.jira?.sprint?.autoStart) {
    await maybeCreateAndStartSprint(jiraClient, config, created.epics[0]?.title || blueprint.hldTitle);
  }

  return created;
}

async function createStoryUnderEpic({
  jiraClient,
  projectKey,
  storyIssueTypeName,
  story,
  parentEpicKey,
  linkingConfig
}) {
  const summary = story.title;
  const description = story.description || `Story generated under Epic ${parentEpicKey}`;

  try {
    return await jiraClient.createIssue({
      projectKey,
      issueTypeName: storyIssueTypeName,
      summary,
      description,
      parentKey: parentEpicKey
    });
  } catch (error) {
    const fallbackIssue = await jiraClient.createIssue({
      projectKey,
      issueTypeName: storyIssueTypeName,
      summary,
      description
    });

    const epicLinkMode = linkingConfig?.epicToStoryMode || "auto";
    const linkTypeName = linkingConfig?.issueLinkType || "Relates";

    if (epicLinkMode === "issueLink") {
      await jiraClient.createIssueLink({
        inwardIssueKey: fallbackIssue.key,
        outwardIssueKey: parentEpicKey,
        linkTypeName
      });
      return fallbackIssue;
    }

    if (epicLinkMode === "none") {
      return fallbackIssue;
    }

    const epicLinkFieldId = await jiraClient.findEpicLinkFieldId();
    if (epicLinkFieldId) {
      await jiraClient.updateIssueFields(fallbackIssue.key, {
        [epicLinkFieldId]: parentEpicKey
      });
      return fallbackIssue;
    }

    await jiraClient.createIssueLink({
      inwardIssueKey: fallbackIssue.key,
      outwardIssueKey: parentEpicKey,
      linkTypeName
    });
    return fallbackIssue;
  }
}

async function createTaskUnderStory({
  jiraClient,
  projectKey,
  taskIssueTypeName,
  subTaskIssueTypeName,
  taskName,
  parentStoryKey,
  linkingConfig
}) {
  const taskMode = linkingConfig?.taskToStoryMode || "issueLink";
  const linkTypeName = linkingConfig?.issueLinkType || "Relates";

  if (taskMode === "subTask" && subTaskIssueTypeName) {
    return jiraClient.createIssue({
      projectKey,
      issueTypeName: subTaskIssueTypeName,
      summary: taskName,
      description: `Sub-task generated under Story ${parentStoryKey}`,
      parentKey: parentStoryKey
    });
  }

  const taskIssue = await jiraClient.createIssue({
    projectKey,
    issueTypeName: taskIssueTypeName,
    summary: taskName,
    description: `Task generated under Story ${parentStoryKey}`
  });

  if (taskMode !== "none") {
    await jiraClient.createIssueLink({
      inwardIssueKey: taskIssue.key,
      outwardIssueKey: parentStoryKey,
      linkTypeName
    });
  }

  return taskIssue;
}

async function maybeCreateAndStartSprint(jiraClient, config, epicTitle) {
  const boardId = config?.jira?.sprint?.boardId || process.env.JIRA_BOARD_ID;
  if (!boardId) {
    console.log("Sprint auto-start is enabled but boardId is missing. Skipping sprint creation.");
    return;
  }

  const sprintNameTemplate = config?.jira?.sprint?.nameTemplate || "Sprint for {{epicTitle}}";
  const sprintGoalTemplate = config?.jira?.sprint?.goalTemplate || "Deliver stories for {{epicTitle}}";
  const sprintName = sprintNameTemplate.replace("{{epicTitle}}", epicTitle);
  const sprintGoal = sprintGoalTemplate.replace("{{epicTitle}}", epicTitle);

  const startDate = new Date();
  const endDate = new Date(startDate.getTime() + 14 * 24 * 60 * 60 * 1000);

  const sprint = await jiraClient.createSprint({
    boardId,
    name: sprintName,
    goal: sprintGoal,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString()
  });

  await jiraClient.startSprint({
    sprintId: sprint.id,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString()
  });

  console.log(`Started Sprint: ${sprintName} (ID: ${sprint.id})`);
}
