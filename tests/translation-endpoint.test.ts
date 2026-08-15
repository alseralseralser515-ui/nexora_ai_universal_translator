import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../server/_core/index";

describe("/api/translate", () => {
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

  it("accepts an explicit translation style while preserving the mock response contract", async () => {
    const response = await request(createApp())
      .post("/api/translate")
      .send({ text: "Привіт", sourceLanguage: "uk", targetLanguage: "en", style: "natural" })
      .expect(200);

    expect(response.body.provider).toBe("mock");
    expect(response.body.translatedText).toContain("uk -> en");
  });

  it("rejects invalid payloads", async () => {
    await request(createApp()).post("/api/translate").send({ text: "" }).expect(400);
  });

  it("detects language through the backend endpoint in explicit test mode", async () => {
    const response = await request(createApp())
      .post("/api/detect-language")
      .send({ text: "Привіт" })
      .expect(200);

    expect(response.body).toEqual({ language: "uk", provider: "mock" });
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
