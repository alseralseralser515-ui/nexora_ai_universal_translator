import { describe, expect, it } from "vitest";

import { ProviderFactory } from "../lib/services/providers/factory";
import { MockLanguageDetectionProvider } from "../lib/services/providers/mock";

describe("ProviderFactory", () => {
  it("selects mock providers by default", () => {
    const factory = new ProviderFactory();
    factory.initialize();
    expect(factory.getMode()).toEqual({ speech: "mock", textToSpeech: "mock", translation: "mock" });
  });

  it("falls back to mock speech and TTS if native modules are unavailable in tests", () => {
    const factory = new ProviderFactory();
    factory.initialize({ speechProvider: "native", textToSpeechProvider: "native", translationProvider: "mock" });
    expect(factory.getMode().speech).toBe("mock");
    expect(factory.getMode().textToSpeech).toBe("mock");
  });

  it("selects backend translation provider when configured", () => {
    const factory = new ProviderFactory();
    factory.initialize({ translationProvider: "backend" });
    expect(factory.getMode().translation).toBe("backend");
  });

  it("uses backend language detection when backend translation is configured", () => {
    const factory = new ProviderFactory();
    factory.initialize({ translationProvider: "backend" });
    expect(factory.getLanguageDetection()).not.toBeInstanceOf(MockLanguageDetectionProvider);
  });
});
