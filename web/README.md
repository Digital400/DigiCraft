# StoryCraft Web Preview (separate from CLI)

This is a standalone, read-only preview UI on top of the existing StoryCraft
business logic in `src/`. It does not change CLI behavior in any way and is
not published to npm (see `.npmignore`/`package.json#files`).

Intended use: another developer's web system (Product Discovery / Solution
Discovery / HLD) plugs into this preview, or embeds it, to visualize the
Epic/Story/Task breakdown that StoryCraft would generate from an HLD before
running the real Jira `run` command from the CLI.

## Run locally

```bash
node web/server.js
```

Open http://localhost:4000

Optional port override:
```bash
WEB_PREVIEW_PORT=5000 node web/server.js
```

## Flow

1. Fill in Jira + Confluence connection details and the Confluence HLD Page ID.
2. Click **Confirm** — this validates both connections and lists Jira spaces (projects).
3. Select a Jira space — this runs the same dry-run blueprint generation used by
   `npx storycraft dry-run`, and renders the Epic/Story/Task tree.

## Notes

- This server keeps configuration in memory for a single local session; it is
  not intended for multi-user/production use as-is.
- No new npm dependencies were added; the server uses Node's built-in `http`
  module only, consistent with the rest of this project.
- Nothing in `src/` was modified to build this; it only imports existing
  usecases/integrations read-only.
