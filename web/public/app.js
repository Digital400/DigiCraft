const configForm = document.getElementById("config-form");
const configStatus = document.getElementById("config-status");
const projectsSection = document.getElementById("projects-section");
const projectsList = document.getElementById("projects-list");
const resultsSection = document.getElementById("results-section");
const resultsContainer = document.getElementById("results");
const approveButton = document.getElementById("approve-button");
const approveStatus = document.getElementById("approve-status");

configForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  configStatus.textContent = "Validating connections...";
  configStatus.className = "";

  const formData = new FormData(configForm);
  const payload = Object.fromEntries(formData.entries());

  try {
    const response = await fetch("/api/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await response.json();

    if (!data.ok) {
      configStatus.textContent = `Error: ${data.error}`;
      configStatus.className = "error";
      return;
    }

    configStatus.textContent = `Connected as ${data.user}. Select a Jira space below.`;
    configStatus.className = "success";
    renderProjects(data.projects);
  } catch (error) {
    configStatus.textContent = `Request failed: ${error.message}`;
    configStatus.className = "error";
  }
});

function renderProjects(projects) {
  projectsList.innerHTML = "";
  projects.forEach((project) => {
    const item = document.createElement("li");
    item.textContent = `${project.key} - ${project.name}`;
    item.addEventListener("click", () => selectProject(project, item));
    projectsList.appendChild(item);
  });
  projectsSection.hidden = false;
}

async function selectProject(project, item) {
  document.querySelectorAll("#projects-list li").forEach((li) => li.classList.remove("selected"));
  item.classList.add("selected");

  resultsSection.hidden = false;
  approveButton.hidden = true;
  approveStatus.textContent = "";
  resultsContainer.innerHTML = "<p>Generating preview...</p>";

  try {
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectKey: project.key })
    });
    const data = await response.json();

    if (!data.ok) {
      resultsContainer.innerHTML = `<p class="error">Error: ${data.error}</p>`;
      return;
    }

    renderResults(data.blueprint, data.blueprintSource);
    approveButton.hidden = false;
    approveButton.disabled = false;
  } catch (error) {
    resultsContainer.innerHTML = `<p class="error">Request failed: ${error.message}</p>`;
  }
}

approveButton.addEventListener("click", async () => {
  approveButton.disabled = true;
  approveStatus.textContent = "Creating Epics/Stories/Tasks in Jira...";
  approveStatus.className = "";

  try {
    const response = await fetch("/api/approve", { method: "POST" });
    const data = await response.json();

    if (!data.ok) {
      approveStatus.textContent = `Error: ${data.error}`;
      approveStatus.className = "error";
      approveButton.disabled = false;
      return;
    }

    const { epics, stories, tasks } = data.created;
    approveStatus.textContent = `Created ${epics.length} epic(s), ${stories.length} stor${stories.length === 1 ? "y" : "ies"}, ${tasks.length} task(s) in Jira.`;
    approveStatus.className = "success";
    approveButton.hidden = true;
  } catch (error) {
    approveStatus.textContent = `Request failed: ${error.message}`;
    approveStatus.className = "error";
    approveButton.disabled = false;
  }
});

function renderResults(blueprint, blueprintSource) {
  resultsContainer.innerHTML = "";

  const heading = document.createElement("p");
  heading.textContent = `HLD: ${blueprint.hldTitle} (source: ${blueprintSource || "n/a"})`;
  resultsContainer.appendChild(heading);

  blueprint.epics.forEach((epic) => {
    const epicDiv = document.createElement("div");
    epicDiv.className = "epic";

    const epicTitle = document.createElement("h3");
    epicTitle.textContent = `Epic: ${epic.title}`;
    epicDiv.appendChild(epicTitle);

    (epic.stories || []).forEach((story) => {
      const storyDiv = document.createElement("div");
      storyDiv.className = "story";
      storyDiv.textContent = `Story: ${story.title}`;
      epicDiv.appendChild(storyDiv);

      (story.tasks || []).forEach((taskName) => {
        const taskDiv = document.createElement("div");
        taskDiv.className = "task";
        taskDiv.textContent = `Task: ${taskName}`;
        epicDiv.appendChild(taskDiv);
      });
    });

    resultsContainer.appendChild(epicDiv);
  });
}
