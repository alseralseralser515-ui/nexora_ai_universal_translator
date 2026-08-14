import type { Express, Request, Response } from "express";
import { z } from "zod";

const translationRequestSchema = z.object({
  text: z.string().trim().min(1).max(4000),
  sourceLanguage: z.string().trim().min(2).max(16),
  targetLanguage: z.string().trim().min(2).max(16),
});
const detectionRequestSchema = z.object({ text: z.string().trim().min(1).max(4000) });

function isTestRuntime(): boolean {
  return process.env.NODE_ENV === "test";
}

async function openAiText(input: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured on the server");
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: process.env.OPENAI_TRANSLATION_MODEL ?? "gpt-4.1-mini",
      input,
    }),
  });
  if (!response.ok) throw new Error(`Translation provider failed (${response.status}): ${await response.text()}`);
  const data = (await response.json()) as { output_text?: string };
  const text = data.output_text?.trim();
  if (!text) throw new Error("AI provider returned an empty response");
  return text;
}

export function registerTranslationRoutes(app: Express): void {
  app.post("/api/translate", async (req: Request, res: Response) => {
    const parsed = translationRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid translation request", issues: parsed.error.flatten() });
      return;
    }

    const provider = process.env.TRANSLATION_PROVIDER ?? (isTestRuntime() ? "mock" : "openai");
    const { text, sourceLanguage, targetLanguage } = parsed.data;
    if (sourceLanguage === targetLanguage) {
      res.json({ translatedText: text, provider: "identity" });
      return;
    }
    if (provider === "mock") {
      res.json({ translatedText: `[${sourceLanguage} -> ${targetLanguage}] ${text}`, provider });
      return;
    }

    try {
      const translatedText = await openAiText(
        `Translate the following text from ${sourceLanguage} to ${targetLanguage}. Return only the translation, with no commentary, markdown, or quotes.\n\n${text}`,
      );
      res.json({ translatedText, provider: "openai" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Translation provider failed";
      res.status(message.includes("OPENAI_API_KEY") ? 503 : 502).json({ error: message });
    }
  });

  app.post("/api/detect-language", async (req: Request, res: Response) => {
    const parsed = detectionRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid language detection request", issues: parsed.error.flatten() });
      return;
    }
    if (isTestRuntime() || process.env.TRANSLATION_PROVIDER === "mock") {
      res.json({ language: "uk", provider: "mock" });
      return;
    }
    try {
      const language = await openAiText(
        `Identify the language of this text. Return only its ISO 639-1 two-letter code from this set: uk, ru, en, de, pl, fr, es, it, pt, tr, ar, zh, ja, ko.\n\n${parsed.data.text}`,
      );
      res.json({ language: language.toLowerCase().slice(0, 2), provider: "openai" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Language detection provider failed";
      res.status(message.includes("OPENAI_API_KEY") ? 503 : 502).json({ error: message });
    }
  });
}
