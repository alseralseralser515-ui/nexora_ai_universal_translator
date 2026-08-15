import { afterEach, describe, expect, it, vi } from "vitest";

import { BackendLanguageDetectionProvider } from "../lib/services/providers/backend-language-detection";

describe("BackendLanguageDetectionProvider", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("parses language from the backend response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({ language: "ru" }),
    })));

    const provider = new BackendLanguageDetectionProvider("https://example.com");
    const language = await provider.detectLanguage("Привет");

    expect(language).toBe("ru");
  });

  it("throws when the backend response is invalid", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({ language: null }),
    })));

    const provider = new BackendLanguageDetectionProvider("https://example.com");
    await expect(provider.detectLanguage("Hello")).rejects.toThrow("Language detection response did not include language");
  });
});
