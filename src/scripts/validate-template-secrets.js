import fs from "node:fs";
import path from "node:path";

const templatePath = path.resolve(process.cwd(), ".env.example");
if (!fs.existsSync(templatePath)) {
  throw new Error("Missing .env.example template file.");
}

const content = fs.readFileSync(templatePath, "utf8");
const lines = content.split(/\r?\n/);

const errors = [];
for (const line of lines) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
    continue;
  }

  const [key, ...rest] = trimmed.split("=");
  const value = rest.join("=").trim();
  if (!value) {
    continue;
  }

  if (looksLikeRealSecret(value) || looksLikeCompanySpecificValue(key, value)) {
    errors.push(`${key} appears to contain a real value`);
  }
}

if (errors.length > 0) {
  console.error("Template secret check failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("Template secret check passed.");

function looksLikeRealSecret(value) {
  const lower = value.toLowerCase();
  if (lower.includes("your_") || lower.includes("example") || lower.includes("company.com")) {
    return false;
  }

  if (value.startsWith("ATAT") || value.startsWith("sk-") || value.startsWith("ghp_") || value.startsWith("github_pat_")) {
    return true;
  }

  if (value.length > 50 && /[A-Za-z]/.test(value) && /\d/.test(value)) {
    return true;
  }

  return false;
}

function looksLikeCompanySpecificValue(key, value) {
  if (key.endsWith("_BASE_URL") && value.includes("digital400")) {
    return true;
  }

  if (key.endsWith("_EMAIL") && !value.includes("your.email@company.com")) {
    return true;
  }

  return false;
}
