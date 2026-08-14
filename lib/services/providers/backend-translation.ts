import Constants from "expo-constants";
import { Platform } from "react-native";
import { normalizeLanguageCode } from "@/lib/config/languages";
import type { LanguageDetectionProvider, TranslationProvider } from "./interfaces";

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
    const data = (await response.json()) as { language?: string };
    if (!data.language) throw new Error("Language detection response did not include language");
    return normalizeLanguageCode(data.language);
  }
}

export class BackendTranslationProvider implements TranslationProvider {
  constructor(private readonly apiBaseUrl = getDefaultApiBaseUrl()) {}

  async translate(text: string, sourceLanguage: string, targetLanguage: string, signal?: AbortSignal): Promise<string> {
    if (sourceLanguage === targetLanguage) return text;
    const response = await fetch(`${this.apiBaseUrl}/api/translate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, sourceLanguage, targetLanguage }),
      signal,
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Translation request failed (${response.status}): ${detail}`);
    }

    const data = (await response.json()) as { translatedText?: string };
    if (!data.translatedText) throw new Error("Translation response did not include translatedText");
    return data.translatedText;
  }
}
