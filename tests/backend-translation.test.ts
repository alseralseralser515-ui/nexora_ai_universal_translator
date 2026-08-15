import { afterEach, describe, expect, it, vi } from "vitest";

import { BackendTranslationProvider } from "../lib/services/providers/backend-translation";

describe("BackendTranslationProvider", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("parses output_text from the OpenAI responses API", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({ output_text: "Hello from OpenAI" }),
    })));

    const provider = new BackendTranslationProvider("https://example.com");
    const translated = await provider.translate("Привіт", "uk", "en");

    expect(translated).toBe("Hello from OpenAI");
  });

  it("parses response content when output_text is absent", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({ output: [{ content: [{ text: "Hello from array" }] }] }),
    })));

    const provider = new BackendTranslationProvider("https://example.com");
    const translated = await provider.translate("Привіт", "uk", "en");

    expect(translated).toBe("Hello from array");
  });
});
