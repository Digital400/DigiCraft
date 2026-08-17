import { ConfluenceHldProvider } from "./confluenceProvider.js";
import { MockHldProvider } from "./mockProvider.js";

export function buildHldProvider(config, confluenceCredentials) {
  const provider = config?.source?.provider;

  if (provider === "confluence") {
    return new ConfluenceHldProvider(confluenceCredentials, config?.source?.confluence);
  }

  if (provider === "mock") {
    return new MockHldProvider(config?.source?.mock);
  }

  throw new Error(`Unsupported source provider: ${provider}`);
}
