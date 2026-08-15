import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../server/_core/index";

describe("/api/translate", () => {
  const originalProvider = process.env.TRANSLATION_PROVIDER;
  const originalPublicProvider = process.env.EXPO_PUBLIC_TRANSLATION_PROVIDER;
  const originalKey = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    process.env.TRANSLATION_PROVIDER = "mock";
    process.env.EXPO_PUBLIC_TRANSLATION_PROVIDER = "mock";
    delete process.env.OPENAI_API_KEY;
  });

  afterEach(() => {
    if (originalProvider === undefined) {
      delete process.env.TRANSLATION_PROVIDER;
    } else {
      process.env.TRANSLATION_PROVIDER = originalProvider;
    }

    if (originalPublicProvider === undefined) {
      delete process.env.EXPO_PUBLIC_TRANSLATION_PROVIDER;
    } else {
      process.env.EXPO_PUBLIC_TRANSLATION_PROVIDER = originalPublicProvider;
    }

    if (originalKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = originalKey;
    }
  });

  it("returns mock translations", async () => {
    const response = await request(createApp())
      .post("/api/translate")
      .send({ text: "Привіт", sourceLanguage: "uk", targetLanguage: "en" })
      .expect(200);

    expect(response.body).toEqual({
      translatedText: "[uk -> en] Привіт",
      provider: "mock",
    });
  });

  it("rejects invalid payloads", async () => {
    await request(createApp()).post("/api/translate").send({ text: "" }).expect(400);
  });

  it("reports missing server API key for real provider mode", async () => {
    const previousProvider = process.env.TRANSLATION_PROVIDER;
    const previousKey = process.env.OPENAI_API_KEY;
    process.env.TRANSLATION_PROVIDER = "openai";
    delete process.env.OPENAI_API_KEY;

    const response = await request(createApp())
      .post("/api/translate")
      .send({ text: "Hello", sourceLanguage: "en", targetLanguage: "uk" })
      .expect(503);

    expect(response.body.error).toContain("OPENAI_API_KEY");
    process.env.TRANSLATION_PROVIDER = previousProvider;
    if (previousKey) process.env.OPENAI_API_KEY = previousKey;
  });
});
