# Digital400 StoryCraft (MVP)

Simple, cross-platform CLI tool for Digital400 (Pvt) Ltd to:
- verify Confluence setup before planning starts,
- list Jira projects (spaces) and let user select one,
- create Epics, Stories, and Tasks in Jira,
- optionally create and start a sprint.

This MVP is intentionally minimal and configurable so it can evolve when your process or source systems change.

## Works on
- macOS
- Windows
- Linux

## Requirements
- Node.js 18+
- Jira Cloud API token
- Confluence Cloud API token

## Quick Start
1. Install dependencies (none required for this MVP):
   ```bash
   npm install
   ```
2. Copy env template:
   - macOS/Linux:
     ```bash
     cp .env.example .env
     ```
   - Windows PowerShell:
     ```powershell
     Copy-Item .env.example .env
     ```
3. Update `.env` and `config/default.config.json`.
4. Run:
   ```bash
   npm run storycraft -- setup
   npm run storycraft -- run
   ```

## Commands
- `setup` : validates Confluence and Jira connections.
- `projects` : lists Jira projects/spaces.
- `run` : guided flow (project selection -> create epic/story/task -> optional sprint).
- `dry-run` : same as `run` but only prints what would be created.

## AI-Assisted Story Crafting
At run start, the tool can prompt for AI provider selection (if keys exist) and generate structured Epics/Stories/Tasks from HLD content.

Supported providers:
- OpenAI (`OPENAI_API_KEY`)
- OpenRouter (`OPENROUTER_API_KEY`)
- Claude via Anthropic (`ANTHROPIC_API_KEY`)
- GitHub Models (`GITHUB_TOKEN`) as a Copilot-compatible route

AI settings in `config/default.config.json`:
- `ai.enabled` : enable/disable AI path
- `ai.promptOnStart` : show provider selection menu at startup
- `ai.provider` : `auto`, `openai`, `openrouter`, `anthropic`, `github`
- `ai.models` : model per provider
- `ai.maxInputChars` : HLD content limit sent to model

If no AI keys are configured, the tool falls back to heuristic parsing.

Troubleshooting AI 401:
- Ensure key is in the correct env variable for the provider.
- OpenAI key must be in `OPENAI_API_KEY`.
- OpenRouter key must be in `OPENROUTER_API_KEY` (often starts with `sk-or-v1-`).
- Claude key must be in `ANTHROPIC_API_KEY`.
- If AI call fails, tool now falls back to heuristic mode and continues.

## Jira Hierarchy Linking
Different Jira projects enforce hierarchy differently (parent field, Epic Link, or generic issue links).

Use `config/default.config.json`:
- `jira.linking.epicToStoryMode`
   - `auto` (default): try parent, then Epic Link field, then issue link.
   - `issueLink`: always use issue links for epic-story relation.
   - `none`: do not link epic and story.
- `jira.linking.taskToStoryMode`
   - `subTask`: create sub-tasks under story (requires `issueTypes.subTask`).
   - `issueLink` (default): create tasks and link to story.
   - `none`: do not link task and story.
- `jira.linking.issueLinkType` : Jira link type name, e.g. `Relates`, `Blocks`.

Recommended first try:
- keep `epicToStoryMode = auto`
- set `taskToStoryMode = subTask` if your project supports sub-tasks
- run `dry-run` before `run`

## Architecture (for future merge with other tools)
- `src/providers/` : source providers (Confluence now, others later)
- `src/integrations/` : external APIs (Jira, Confluence)
- `src/usecases/` : business workflows (story crafting)
- `config/` : runtime configuration

You can add additional providers for Problem Discovery, Solution Discovery, HLD generation, etc., and keep one unified orchestration flow.

## Private npm Registry (GitHub Packages)

Package name:
- `@digital400/storycraft`

Repository:
- `https://github.com/Digital400/DigiCraft.git`

### 1) Push this project to GitHub
```bash
git init
git add .
git commit -m "Initial StoryCraft CLI"
git branch -M main
git remote add origin https://github.com/Digital400/DigiCraft.git
git push -u origin main
```

### 2) Create a GitHub token for packages
Create a Personal Access Token with scopes:
- `write:packages`
- `read:packages`
- `repo` (if repository is private)

### 3) Authenticate npm for GitHub Packages
Add to your user-level `.npmrc`:
```ini
@digital400:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=YOUR_GITHUB_TOKEN
```

### 4) Publish package
```bash
npm publish
```

### 5) Install in other project repositories
In any team project, add to `.npmrc`:
```ini
@digital400:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=YOUR_GITHUB_TOKEN
```

Install:
```bash
npm install --save-dev @digital400/storycraft
```

Run:
```bash
npx storycraft setup
npx storycraft dry-run
npx storycraft run
```
