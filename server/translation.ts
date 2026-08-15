import type { Express, Request, Response } from "express";
import { z } from "zod";

const translationRequestSchema = z.object({
  text: z.string().trim().min(1).max(4000),
  sourceLanguage: z.string().trim().min(2).max(16),
  targetLanguage: z.string().trim().min(2).max(16),
});

const languageDetectionRequestSchema = z.object({
  text: z.string().trim().min(1).max(4000),
});

export function registerTranslationRoutes(app: Express): void {
  app.post("/api/detect-language", async (req: Request, res: Response) => {
    const parsed = languageDetectionRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid language detection request", issues: parsed.error.flatten() });
      return;
    }

    const provider = (process.env.TRANSLATION_PROVIDER ?? process.env.EXPO_PUBLIC_TRANSLATION_PROVIDER ?? "mock").toLowerCase();
    const { text } = parsed.data;

    if (provider === "mock") {
      const detectedLanguage = /[іїєґ]/i.test(text) ? "uk" : /[а-яё]/i.test(text) ? "ru" : "en";
      res.json({ language: detectedLanguage, provider });
      return;
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      res.status(503).json({ error: "OPENAI_API_KEY is not configured on the server" });
      return;
    }

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_TRANSLATION_MODEL ?? "gpt-4.1-mini",
        input: [
          {
            role: "system",
            content: "Detect the language of the user's text and return only the ISO language code, such as en, uk, or ru.",
          },
          {
            role: "user",
            content: `Text: ${text}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      res.status(response.status).json({ error: "Language detection provider failed", detail });
      return;
    }

    const data = await response.json();
    const language =
      typeof data.output_text === "string"
        ? data.output_text.trim()
        : Array.isArray(data.output) && data.output.length > 0
        ? String(data.output[0]?.content?.[0]?.text ?? "").trim()
        : "";

    res.json({ language, provider: "openai" });
  });

  app.post("/api/translate", async (req: Request, res: Response) => {
    const parsed = translationRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid translation request", issues: parsed.error.flatten() });
      return;
    }

    const provider = (process.env.TRANSLATION_PROVIDER ?? process.env.EXPO_PUBLIC_TRANSLATION_PROVIDER ?? "mock").toLowerCase();
    const { text, sourceLanguage, targetLanguage } = parsed.data;

    if (provider === "mock") {
      res.json({
        translatedText: `[${sourceLanguage} -> ${targetLanguage}] ${text}`,
        provider,
      });
      return;
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      res.status(503).json({ error: "OPENAI_API_KEY is not configured on the server" });
      return;
    }

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_TRANSLATION_MODEL ?? "gpt-4.1-mini",
        input: [
          {
            role: "system",
            content:
              "Translate the user's text. Return only the translated text, with no commentary, markdown, or quotes.",
          },
          {
            role: "user",
            content: `Source language: ${sourceLanguage}
Target language: ${targetLanguage}
Text: ${text}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      res.status(response.status).json({ error: "Translation provider failed", detail });
      return;
    }

    const data = await response.json();
    const translatedText =
      typeof data.output_text === "string"
        ? data.output_text.trim()
        : Array.isArray(data.output) && data.output.length > 0
        ? String(data.output[0]?.content?.[0]?.text ?? "").trim()
        : "";

    res.json({ translatedText, provider: "openai" });
  });
}
