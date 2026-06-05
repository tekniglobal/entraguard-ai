import { createAzure } from "@ai-sdk/azure";

export function azureConfigured(): boolean {
  return Boolean(
    process.env.AZURE_OPENAI_RESOURCE &&
      process.env.AZURE_OPENAI_API_KEY &&
      process.env.AZURE_OPENAI_DEPLOYMENT
  );
}

export function getInvestigatorModel() {
  if (!azureConfigured()) {
    throw new Error("Azure OpenAI is not configured");
  }
  const azure = createAzure({
    resourceName: process.env.AZURE_OPENAI_RESOURCE!,
    apiKey: process.env.AZURE_OPENAI_API_KEY!,
    apiVersion: process.env.AZURE_OPENAI_API_VERSION || "2024-10-21",
  });
  return azure(process.env.AZURE_OPENAI_DEPLOYMENT!);
}
