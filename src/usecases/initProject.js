import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function initProjectTemplates({ force = false } = {}) {
  const currentFile = fileURLToPath(import.meta.url);
  const packageRoot = path.resolve(path.dirname(currentFile), "..", "..");
  const targetRoot = process.cwd();

  const templateEnv = path.join(packageRoot, ".env.example");
  const targetEnv = path.join(targetRoot, ".env");
  const targetEnvExample = path.join(targetRoot, ".env.example");

  const templateConfig = path.join(packageRoot, "config", "default.config.json");
  const targetConfigDir = path.join(targetRoot, "config");
  const targetConfig = path.join(targetConfigDir, "default.config.json");

  if (!fs.existsSync(templateEnv) || !fs.existsSync(templateConfig)) {
    throw new Error("Package templates not found. Reinstall digital400-storycraft.");
  }

  if (!fs.existsSync(targetConfigDir)) {
    fs.mkdirSync(targetConfigDir, { recursive: true });
  }

  const results = {
    env: copyTemplate(templateEnv, targetEnv, force),
    envExample: copyTemplate(templateEnv, targetEnvExample, force),
    config: copyTemplate(templateConfig, targetConfig, force)
  };

  return results;
}

function copyTemplate(source, destination, force) {
  if (fs.existsSync(destination) && !force) {
    return { path: destination, status: "skipped" };
  }

  fs.copyFileSync(source, destination);
  return { path: destination, status: "created" };
}
