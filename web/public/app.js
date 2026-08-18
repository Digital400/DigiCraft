const configForm = document.getElementById("config-form");
const configStatus = document.getElementById("config-status");
const projectsSection = document.getElementById("projects-section");
const projectsList = document.getElementById("projects-list");
const resultsSection = document.getElementById("results-section");
const resultsContainer = document.getElementById("results");

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

    renderResults(data.result);
  } catch (error) {
    resultsContainer.innerHTML = `<p class="error">Request failed: ${error.message}</p>`;
  }
}

function renderResults(result) {
  const { blueprint } = result;

  resultsContainer.innerHTML = "";

  const heading = document.createElement("p");
  heading.textContent = `HLD: ${blueprint.hldTitle}`;
  resultsContainer.appendChild(heading);

  // Render straight from the blueprint tree; dry-run issue keys are placeholders and not unique per epic.
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
