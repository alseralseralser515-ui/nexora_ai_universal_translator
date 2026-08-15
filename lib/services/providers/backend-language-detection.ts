import Constants from "expo-constants";
import { Platform } from "react-native";
import type { LanguageDetectionProvider } from "./interfaces";

function getDefaultApiBaseUrl(): string {
  const configured = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (configured) return configured;

  const hostUri = Constants.expoConfig?.hostUri ?? Constants.manifest2?.extra?.expoGo?.debuggerHost;
  const host = typeof hostUri === "string" ? hostUri.split(":")[0] : undefined;

  if (Platform.OS === "android") return "http://10.0.2.2:3000";
  if (host) return `http://${host}:3000`;
  return "http://localhost:3000";
}

export class BackendLanguageDetectionProvider implements LanguageDetectionProvider {
  constructor(private readonly apiBaseUrl = getDefaultApiBaseUrl()) {}

  async detectLanguage(text: string, signal?: AbortSignal): Promise<string> {
    const response = await fetch(`${this.apiBaseUrl}/api/detect-language`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal,
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Language detection request failed (${response.status}): ${detail}`);
    }

    const data = await response.json();
    const language = typeof data.language === "string" ? data.language.trim() : "";

    if (!language) {
      throw new Error("Language detection response did not include language");
    }

    return language;
  }
}
