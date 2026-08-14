import { describe, expect, it } from "vitest";

import { ProviderFactory } from "../lib/services/providers/factory";

describe("ProviderFactory", () => {
  it("selects mock providers by default", () => {
    const factory = new ProviderFactory();
    factory.initialize();
    expect(factory.getMode()).toEqual({ speech: "mock", textToSpeech: "mock", translation: "mock" });
  });

  it("does not silently replace explicitly requested native providers with mocks", () => {
    const factory = new ProviderFactory();
    factory.initialize({ speechProvider: "native", textToSpeechProvider: "native", translationProvider: "mock" });
    expect(factory.getMode().speech).toBe("native");
    expect(factory.getMode().textToSpeech).toBe("native");
  });
});
