/**
 * Custom environment loader that prioritizes system environment variables
 * over .env file values.
 */
import fs from "fs";
import path from "path";

const envPath = path.resolve(process.cwd(), ".env");

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8");
  const lines = envContent.split("\n");

  lines.forEach((line) => {
    // Skip comments and empty lines
    if (!line || line.trim().startsWith("#")) return;

    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^["']|["']$/g, ""); // Remove quotes

      // Only set if not already defined in environment
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  });
}

// Keep the backend URL/configuration public, but never map secret API keys to Expo.
const mappings = {
  API_BASE_URL: "EXPO_PUBLIC_API_BASE_URL",
  TRANSLATION_PROVIDER: "EXPO_PUBLIC_TRANSLATION_PROVIDER",
};

for (const [systemVar, expoVar] of Object.entries(mappings)) {
  if (process.env[systemVar] && !process.env[expoVar]) {
    process.env[expoVar] = process.env[systemVar];
  }
}
