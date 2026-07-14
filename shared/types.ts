export * from "./_core/errors";

export interface TranslationResponse {
  translatedText: string;
  provider: "mock" | "openai";
}
